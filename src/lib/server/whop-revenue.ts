import "server-only";
import { getWhopClient, getWhopCompanyId, findSubscriptionPlanByPlanId } from "@/lib/config/whop";
import type { RevenueDailyPoint, RevenueTransaction, WhopBalance } from "@/lib/types";

/**
 * The admin's money figures, read straight from Whop instead of rebuilt from
 * webhook rows: the same balance, the same after-fee amounts and the same
 * payments the Whop dashboard shows. Our own tables only ever saw what the
 * webhook delivered, and Whop silently disabled that webhook for three
 * months in 2026, so they can't be the record of money.
 */

const PLAN_NAME = { core: "Core", pro: "Pro", scale: "Scale" } as const;

// Whop's PaymentsAPI.BillingReasons values.
const BILLING_REASON_LABEL: Record<string, string> = {
  one_time: "Credit top-up",
  subscription_create: "New subscription",
  subscription_cycle: "Renewal",
  subscription_update: "Plan change",
  subscription: "Subscription",
  manual: "Manual charge",
};

/** Enough for the transactions table's pages; the 30-day sums page further. */
const MAX_PAYMENTS = 500;

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface WhopMoney {
  balance: WhopBalance | null;
  /** After Whop's fees, minus refunds, over the 30 days in `days`. */
  netLast30d: number;
  dailySeries: RevenueDailyPoint[];
  transactions: RevenueTransaction[];
}

function itemLabel(planId: string | undefined, productTitle: string | null | undefined, isSubscription: boolean): string {
  // Our own plan names: Whop product titles go stale (Core's still reads
  // "legacy $19" after the move to $25).
  const plan = planId ? findSubscriptionPlanByPlanId(planId) : null;
  if (plan) return `${PLAN_NAME[plan.planId]}, ${plan.period}`;
  return productTitle ?? (isSubscription ? "Subscription" : "Credits");
}

/** `days` are UTC dates (YYYY-MM-DD), oldest first. */
export async function getWhopMoney(days: string[]): Promise<WhopMoney> {
  const client = getWhopClient();
  const companyId = getWhopCompanyId();
  const since = `${days[0]}T00:00:00.000Z`;
  const byDay = new Map(days.map((d) => [d, 0]));

  const [payments, refunds, ledger] = await Promise.all([
    (async () => {
      const list = [];
      for await (const p of client.payments.list({ company_id: companyId, statuses: ["paid"], order: "created_at", direction: "desc" })) {
        list.push(p);
        if (list.length >= MAX_PAYMENTS) break;
      }
      return list;
    })(),
    (async () => {
      const list = [];
      for await (const r of client.refunds.list({ company_id: companyId, created_after: since })) {
        if (r.status === "succeeded") list.push(r);
      }
      return list;
    })(),
    client.ledgerAccounts.retrieve(companyId).catch(() => null),
  ]);

  const transactions: RevenueTransaction[] = [];

  for (const p of payments) {
    const at = p.paid_at ?? p.created_at;
    const net = p.amount_after_fees ?? p.usd_total ?? p.total ?? 0;
    const day = at.slice(0, 10);
    if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + net);
    transactions.push({
      id: p.id,
      type: "order.paid",
      userName: p.user?.name || p.user?.username || p.user?.email || "Unknown",
      userEmail: p.user?.email ?? "N/A",
      itemLabel: itemLabel(p.plan?.id, p.product?.title, Boolean(p.membership)),
      billingReason: p.billing_reason ? (BILLING_REASON_LABEL[p.billing_reason] ?? p.billing_reason) : null,
      amount: p.usd_total ?? p.total ?? 0,
      net,
      currency: (p.currency ?? "usd").toUpperCase(),
      createdAt: at,
    });
  }

  const paymentById = new Map(payments.map((p) => [p.id, p]));
  for (const r of refunds) {
    const refunded = r.payment?.id ? paymentById.get(r.payment.id) : undefined;
    const day = r.created_at.slice(0, 10);
    if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) - r.amount);
    transactions.push({
      id: r.id,
      type: "order.refunded",
      userName: refunded?.user?.name || refunded?.user?.username || refunded?.user?.email || "Unknown",
      userEmail: refunded?.user?.email ?? "N/A",
      itemLabel: refunded ? itemLabel(refunded.plan?.id, refunded.product?.title, Boolean(refunded.membership)) : "Refund",
      billingReason: null,
      amount: -r.amount,
      net: -r.amount,
      currency: (r.currency ?? "usd").toUpperCase(),
      createdAt: r.created_at,
    });
  }

  transactions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const usd = ledger?.balances.find((b) => b.currency === "usd");
  const balance = usd
    ? { available: round2(usd.balance), pending: round2(usd.pending_balance), total: round2(usd.balance + usd.pending_balance) }
    : null;

  const dailySeries = days.map((date) => ({ date, collected: round2(byDay.get(date) ?? 0) }));
  return {
    balance,
    netLast30d: round2(dailySeries.reduce((s, p) => s + p.collected, 0)),
    dailySeries,
    transactions,
  };
}
