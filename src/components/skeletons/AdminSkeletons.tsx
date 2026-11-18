import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/admin/PageHeader";
import { cn } from "@/lib/utils";

// Route-level loading screens for the admin. The router shows these the
// instant a sidebar link is clicked (they're prefetched with the link), so a
// page never sits frozen while its queries run. Each one keeps the page's real
// header -- title and description are static, so they're shown for real --
// and mirrors its grid with placeholder panels so the data swaps in without
// the layout moving. If a page's layout changes, update its skeleton too.

function Shell({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-label="Loading" aria-busy="true" className="flex flex-col gap-6">
      {children}
    </div>
  );
}

function SkKpis({ count = 4 }: { count?: number }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-px overflow-hidden rounded-card border border-hairline bg-hairline shadow-card",
        count === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4"
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex min-w-0 flex-col justify-between gap-4 bg-surface p-5">
          <Skeleton className="h-3.5 w-28 rounded-full" />
          <div className="flex items-end justify-between gap-3">
            <Skeleton className="h-7 w-24 rounded-md" />
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>
          <Skeleton className="h-3 w-32 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** A Panel's chrome with a placeholder header; children fill the body. */
function SkPanel({ className, children, hero = false }: { className?: string; children?: ReactNode; hero?: boolean }) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-card border border-hairline bg-surface shadow-card", className)}>
      <header className="px-5 pt-5">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="mt-2 h-3.5 w-56 max-w-full rounded-full" />
      </header>
      <div className="flex-1 px-5 pb-5 pt-4">
        {hero && (
          <div className="mb-5">
            <Skeleton className="h-10 w-36 rounded-lg sm:h-12" />
            <Skeleton className="mt-3 h-3.5 w-48 rounded-full" />
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

function SkChart({ height = 200 }: { height?: number }) {
  return <Skeleton className="w-full rounded-lg" style={{ height }} />;
}

function SkBars({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3.5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-3.5 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-2 flex-1 rounded-full" style={{ maxWidth: `${92 - i * 14}%` }} />
          <Skeleton className="h-3.5 w-8 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function SkShare() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-2.5 w-full rounded-full" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <Skeleton className="h-3.5 w-20 rounded-full" />
          <Skeleton className="h-3.5 w-10 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function SkMiniStats({ count = 2 }: { count?: number }) {
  return (
    <div className={cn("grid gap-3", count === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2")}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-lg bg-(--admin-fill) px-3.5 py-3">
          <Skeleton className="h-3 w-16 rounded-full" />
          <Skeleton className="mt-2 h-5 w-12 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function SkTable({ rows = 8, toolbar = false }: { rows?: number; toolbar?: boolean }) {
  return (
    <section className="flex min-w-0 flex-col rounded-card border border-hairline bg-surface shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          <Skeleton className="h-4 w-32 rounded-full" />
          <Skeleton className="mt-2 h-3.5 w-48 rounded-full" />
        </div>
        {toolbar && (
          <div className="flex gap-2">
            <Skeleton className="h-8 w-52 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        )}
      </header>
      <div className="mt-4 border-t border-hairline">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-hairline px-5 py-3 last:border-b-0">
            <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3.5 w-36 max-w-full rounded-full" />
              <Skeleton className="mt-1.5 h-3 w-48 max-w-full rounded-full" />
            </div>
            <Skeleton className="hidden h-3.5 w-16 rounded-full sm:block" />
            <Skeleton className="hidden h-3.5 w-20 rounded-full md:block" />
            <Skeleton className="h-3.5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

function SkHeader({ title, description, chip = false }: { title: string; description: string; chip?: boolean }) {
  return (
    <PageHeader title={title} description={description}>
      {chip ? <Skeleton className="h-6 w-16 rounded-full" /> : null}
    </PageHeader>
  );
}

export function AdminOverviewSkeleton() {
  return (
    <Shell>
      <SkHeader title="Overview" description="Accounts, revenue, product usage and job health across the workspace." chip />
      <SkKpis />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SkPanel className="xl:col-span-2" hero>
          <SkChart />
        </SkPanel>
        <SkPanel>
          <SkShare />
          <div className="mt-6">
            <SkMiniStats />
          </div>
        </SkPanel>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SkPanel>
          <SkChart height={180} />
        </SkPanel>
        <SkPanel>
          <SkBars rows={6} />
        </SkPanel>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SkPanel className="xl:col-span-2">
          <SkBars rows={7} />
        </SkPanel>
        <SkPanel>
          <SkShare />
        </SkPanel>
      </div>
    </Shell>
  );
}

export function AdminUsersSkeleton() {
  return (
    <Shell>
      <SkHeader title="Users" description="Every account, its plan and how much it uses the product." />
      <SkKpis />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SkPanel className="xl:col-span-2">
          <SkChart />
        </SkPanel>
        <div className="flex flex-col gap-6">
          <SkPanel>
            <Skeleton className="h-2.5 w-full rounded-full" />
          </SkPanel>
          <SkPanel>
            <Skeleton className="h-2.5 w-full rounded-full" />
          </SkPanel>
        </div>
      </div>
      <SkTable rows={10} toolbar />
    </Shell>
  );
}

export function AdminRevenueSkeleton() {
  return (
    <Shell>
      <SkHeader title="Revenue" description="MRR, subscribers and transactions, straight from Whop billing." chip />
      <SkKpis />
      <SkPanel hero>
        <SkChart />
      </SkPanel>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SkPanel>
          <SkShare />
        </SkPanel>
        <SkPanel className="xl:col-span-2">
          <SkMiniStats count={4} />
        </SkPanel>
      </div>
      <SkTable rows={3} toolbar />
      <SkTable rows={6} />
    </Shell>
  );
}

export function AdminCreditsSkeleton() {
  return (
    <Shell>
      <SkHeader title="Credits" description="Balances, daily spend and manual grants across every account." />
      <SkKpis />
      <SkPanel hero>
        <SkChart />
      </SkPanel>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SkPanel>
          <SkBars rows={6} />
        </SkPanel>
        <div className="xl:col-span-2">
          <SkTable rows={5} />
        </div>
      </div>
      <SkTable rows={4} toolbar />
    </Shell>
  );
}

export function AdminUsageSkeleton() {
  return (
    <Shell>
      <SkHeader title="Usage & tools" description="Which tools people run, how often, and who runs them most." />
      <SkKpis />
      <SkPanel>
        <SkChart height={220} />
      </SkPanel>
      <SkPanel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-lg border border-hairline p-4">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-3.5 w-24 rounded-full" />
                <Skeleton className="h-3.5 w-12 rounded-full" />
              </div>
              <Skeleton className="h-14 w-full rounded-md" />
            </div>
          ))}
        </div>
      </SkPanel>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SkPanel>
          <SkBars rows={6} />
        </SkPanel>
        <div className="xl:col-span-2">
          <SkTable rows={6} />
        </div>
      </div>
    </Shell>
  );
}

export function AdminSystemSkeleton() {
  return (
    <Shell>
      <SkHeader title="System" description="Job queue, endpoint latency and uptime." chip />
      <SkKpis />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SkPanel>
          <SkShare />
        </SkPanel>
        <SkPanel>
          <SkBars rows={5} />
        </SkPanel>
        <SkPanel>
          <SkBars rows={5} />
        </SkPanel>
      </div>
      <SkTable rows={5} />
      <SkTable rows={8} toolbar />
    </Shell>
  );
}

export function AdminSettingsSkeleton() {
  return (
    <Shell>
      <SkHeader title="Settings" description="Feature rollouts and who can reach this dashboard." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <SkPanel className="xl:col-span-3">
          <div className="flex flex-col gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-3.5 w-36 rounded-full" />
                  <Skeleton className="mt-1.5 h-3 w-64 max-w-full rounded-full" />
                </div>
                <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </SkPanel>
        <div className="xl:col-span-2">
          <SkTable rows={3} />
        </div>
      </div>
    </Shell>
  );
}

export function AdminPlansSkeleton() {
  return (
    <Shell>
      <SkHeader
        title="Plans"
        description="Pricing, copy and feature bullets. Saving publishes straight to the pricing page and every in-app upgrade prompt."
        chip
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <SkPanel key={i}>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <SkBars rows={4} />
            </div>
          </SkPanel>
        ))}
      </div>
    </Shell>
  );
}

/** A header with an action button, optional KPIs, then one table. */
function TablePageSkeleton({ title, description, kpis }: { title: string; description: string; kpis?: number }) {
  return (
    <Shell>
      <PageHeader title={title} description={description}>
        <Skeleton className="h-8 w-28 rounded-lg" />
      </PageHeader>
      {kpis ? <SkKpis count={kpis} /> : null}
      <SkTable rows={8} />
    </Shell>
  );
}

export function AdminPromoCodesSkeleton() {
  return <TablePageSkeleton title="Promo codes" description="Codes that grant credits or a discount at checkout." kpis={3} />;
}

export function AdminApiCostsSkeleton() {
  return (
    <TablePageSkeleton
      title="API costs"
      description="Every third-party API the product calls, and what each one costs per month."
    />
  );
}
