import { AlertTriangle, ArrowRight } from "lucide-react";

interface LowCreditBannerProps {
  balance: number;
  cost: number;
  onTopUp: () => void;
}

export function LowCreditBanner({ balance, cost, onTopUp }: LowCreditBannerProps) {
  return (
    <div
      role="alert"
      className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/20 dark:bg-amber-500/10"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Low credit balance</p>
          <p className="text-sm text-amber-700 dark:text-amber-300/80">
            You have {balance} credit{balance === 1 ? "" : "s"} left, this generation needs {cost}.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onTopUp}
        className="flex shrink-0 items-center justify-center gap-1.5 self-start rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 sm:self-auto"
      >
        Top up credits <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
