import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { findSubscriptionPlanByPlanId } from "@/lib/config/whop";
import { reportBillingError } from "@/lib/server/billing-alerts";
import { CONTACT_EMAIL } from "@/lib/constants";

type AdminClient = ReturnType<typeof createAdminClient>;

/** The fields of Whop's payment.failed `data` this module reads. */
export interface FailedPaymentLike {
  id: string;
  billing_reason?: string | null;
  metadata?: { [key: string]: unknown } | null;
  membership?: { id: string } | null;
  plan?: { id: string } | null;
  user?: { email?: string | null } | null;
  usd_total?: number | null;
  total?: number | null;
  currency?: string | null;
  card_brand?: string | null;
  card_last4?: string | null;
}

/**
 * Renewals are the payments a customer doesn't watch happen. A declined first
 * checkout (`subscription_create`) or credit pack (`one_time`) is shown to
 * the customer on Whop's checkout as it happens, so emailing them about it
 * minutes later -- possibly after they've retried and paid -- only confuses.
 */
const RENEWAL_REASONS = new Set(["subscription_cycle", "subscription", "subscription_update"]);

export const PAYMENT_FAILED_NOTICE_TYPE = "notice.payment_failed";
export const paymentFailedNoticeId = (paymentId: string) => `notice:payment.failed:${paymentId}`;

export type PaymentFailedNoticeStatus = "sending" | "sent" | "failed";

const SITE_ORIGIN = "https://verlab.io";

/**
 * Emails the customer, once per failed payment, when a renewal charge fails.
 * Runs after the webhook has already answered Whop (inside after()), so it
 * never slows the 200.
 *
 * Idempotency, in two layers:
 *   1. A claim row `notice:payment.failed:<pay_id>` in whop_webhook_events
 *      (the same id-keyed pattern recordReconciledEvent uses) is inserted
 *      before sending; a second payment.failed for the same payment -- a
 *      Whop redelivery, or Whop's later automatic retries of that charge,
 *      which reuse the payment id -- hits the unique id and sends nothing.
 *   2. Resend's Idempotency-Key, keyed the same way, so even a duplicate API
 *      call inside Resend's window delivers one email.
 * No email address is stored in the claim row; it's resolved at send time.
 *
 * Inert until RESEND_API_KEY is set: logs and returns without claiming, so
 * nothing is marked as sent that wasn't.
 */
export async function notifyPaymentFailed(admin: AdminClient, payment: FailedPaymentLike): Promise<void> {
  const billingReason = payment.billing_reason ?? null;
  if (!billingReason || !RENEWAL_REASONS.has(billingReason)) return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[payment-failed] RESEND_API_KEY not set; no email for failed payment ${payment.id}`);
    return;
  }

  const userId = await resolveUserId(admin, payment);
  const noticeId = paymentFailedNoticeId(payment.id);

  const { error: claimError } = await admin.from("whop_webhook_events").insert({
    id: noticeId,
    type: PAYMENT_FAILED_NOTICE_TYPE,
    payload: noticePayload(payment, userId, "sending"),
  });
  if (claimError) {
    if (claimError.code === "23505") return; // already emailed for this payment
    await reportBillingError({
      source: "payment_failed_email",
      stage: "claim_notice",
      error: claimError,
      eventType: "payment.failed",
      objectId: payment.id,
      userId,
    });
    return;
  }

  try {
    const { email, manageUrl } = await resolveRecipient(admin, payment, userId);
    if (!email) throw new Error("No email address for this customer");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `payment-failed/${payment.id}`,
      },
      body: JSON.stringify({
        // The sender has to stay on a domain verified in Resend (verlab.io) --
        // Resend can't send *from* a gmail.com address. Replies go to the one
        // contact inbox instead.
        from: process.env.RESEND_FROM_EMAIL ?? "Verlab <billing@verlab.io>",
        reply_to: CONTACT_EMAIL,
        to: [email],
        subject: "Your Verlab payment didn't go through",
        html: renderHtml(payment, manageUrl),
        text: renderText(payment, manageUrl),
        tags: [{ name: "category", value: "payment_failed" }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`Resend answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    const { id: resendId } = (await response.json()) as { id?: string };

    await admin
      .from("whop_webhook_events")
      .update({ payload: noticePayload(payment, userId, "sent", { resend_id: resendId ?? null }), processed_at: new Date().toISOString() })
      .eq("id", noticeId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // The claim stays, marked failed, so it shows on the admin and isn't
    // retried into a duplicate; a person can follow up by hand.
    await admin
      .from("whop_webhook_events")
      .update({ payload: noticePayload(payment, userId, "failed", { error: message }) })
      .eq("id", noticeId);
    await reportBillingError({
      source: "payment_failed_email",
      stage: "send_email",
      error,
      eventType: "payment.failed",
      objectId: payment.id,
      userId,
    });
  }
}

function noticePayload(
  payment: FailedPaymentLike,
  userId: string | null,
  status: PaymentFailedNoticeStatus,
  extra: Record<string, unknown> = {},
) {
  return {
    source: "dunning",
    data: { id: payment.id, user_id: userId, membership_id: payment.membership?.id ?? null, status, ...extra },
  };
}

/** Our user id: the checkout's metadata, else the profile holding this membership. */
async function resolveUserId(admin: AdminClient, payment: FailedPaymentLike): Promise<string | null> {
  const fromMetadata = payment.metadata?.user_id;
  if (typeof fromMetadata === "string" && fromMetadata) return fromMetadata;
  const membershipId = payment.membership?.id;
  if (!membershipId) return null;
  const { data } = await admin.from("profiles").select("id").eq("subscription_id", membershipId).maybeSingle();
  return data?.id ?? null;
}

/**
 * The Verlab account's email first (the address they know us by), else the
 * one they paid with on Whop. The link goes straight to Whop's hosted page
 * for updating the card when we have it.
 */
async function resolveRecipient(
  admin: AdminClient,
  payment: FailedPaymentLike,
  userId: string | null,
): Promise<{ email: string | null; manageUrl: string }> {
  let email: string | null = null;
  let manageUrl: string | null = null;
  if (userId) {
    const [{ data: auth }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin.from("profiles").select("whop_manage_url").eq("id", userId).maybeSingle(),
    ]);
    email = auth.user?.email ?? null;
    manageUrl = profile?.whop_manage_url ?? null;
  }
  return {
    email: email ?? payment.user?.email ?? null,
    manageUrl: manageUrl ?? `${SITE_ORIGIN}/app/settings/subscription`,
  };
}

function planName(payment: FailedPaymentLike): string {
  const plan = payment.plan?.id ? findSubscriptionPlanByPlanId(payment.plan.id) : null;
  return plan ? `Verlab ${plan.planId.charAt(0).toUpperCase()}${plan.planId.slice(1)}` : "your Verlab subscription";
}

function amountLabel(payment: FailedPaymentLike): string | null {
  const amount = payment.usd_total ?? payment.total;
  if (typeof amount !== "number" || amount <= 0) return null;
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function cardLabel(payment: FailedPaymentLike): string | null {
  if (!payment.card_last4) return null;
  const brand = payment.card_brand ? payment.card_brand.charAt(0).toUpperCase() + payment.card_brand.slice(1) : "Card";
  return `${brand} ending in ${payment.card_last4}`;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function renderText(payment: FailedPaymentLike, manageUrl: string): string {
  const amount = amountLabel(payment);
  const card = cardLabel(payment);
  return [
    "Hi,",
    "",
    `We couldn't renew ${planName(payment)}${amount ? ` (${amount})` : ""}${card ? ` on your ${card}` : ""}.`,
    "Whop will retry the charge over the next few days.",
    "",
    "To keep everything running, update your payment method here:",
    manageUrl,
    "",
    "If you've already sorted it out, you can ignore this email.",
    "",
    "The Verlab team",
  ].join("\n");
}

function renderHtml(payment: FailedPaymentLike, manageUrl: string): string {
  const amount = amountLabel(payment);
  const card = cardLabel(payment);
  const details = [planName(payment), amount, card].filter(Boolean).map((v) => escapeHtml(v as string));
  const href = escapeHtml(manageUrl);
  return `<!doctype html>
<html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e4e4e7;border-radius:14px">
<tr><td style="padding:28px 28px 8px">
<img src="${SITE_ORIGIN}/logo-icon.png" width="32" height="32" alt="Verlab" style="display:block;border-radius:8px">
</td></tr>
<tr><td style="padding:12px 28px 0">
<h1 style="margin:0;font-size:20px;line-height:28px;font-weight:600;letter-spacing:-0.01em">Your payment didn't go through</h1>
<p style="margin:12px 0 0;font-size:15px;line-height:24px;color:#3f3f46">We couldn't renew your subscription. Whop will retry the charge over the next few days; updating your card now keeps your plan from lapsing.</p>
</td></tr>
<tr><td style="padding:20px 28px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #f0f0f1;border-radius:10px">
${details.map((d) => `<tr><td style="padding:10px 14px;font-size:14px;line-height:20px;color:#27272a">${d}</td></tr>`).join("")}
</table>
</td></tr>
<tr><td style="padding:24px 28px 0">
<a href="${href}" style="display:inline-block;background:#335cff;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;line-height:20px;padding:12px 20px;border-radius:10px">Update payment method</a>
</td></tr>
<tr><td style="padding:24px 28px 28px">
<p style="margin:0;font-size:13px;line-height:20px;color:#71717a">Already sorted it out? You can ignore this email.</p>
</td></tr>
</table>
<p style="margin:16px 0 0;font-size:12px;color:#a1a1aa">Verlab · verlab.io</p>
</td></tr></table>
</body></html>`;
}
