import { CreditCard } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

// No Stripe (or any payment provider) is wired up yet — rather than fake
// MRR/churn/transactions numbers, this page honestly says so. Once billing
// lands, this becomes real queries against subscription/transaction tables
// the same way src/app/admin/usage/page.tsx reads usage_events today.
export default function AdminRevenuePage() {
  return (
    <div className="flex flex-col gap-6 pt-2">
      <Card>
        <EmptyState
          icon={CreditCard}
          title="Billing isn't connected yet"
          description="Revenue, MRR, churn, and transaction data will appear here once a payment provider (e.g. Stripe) is wired up. Plan pricing itself is still editable from Admin → Plans."
          action={{ label: "Edit plan pricing", href: "/admin/plans" }}
        />
      </Card>
    </div>
  );
}
