import { CreditCard } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SettingsCardHeader } from "@/components/settings/SettingsCardHeader";

export function SubscriptionTab() {
  return (
    <Card className="max-w-2xl">
      <SettingsCardHeader
        icon={CreditCard}
        title="Subscription"
        description="Billing is handled securely through our payments partner."
      />

      <div className="mt-8 flex flex-col items-center gap-3 rounded-card-sm border border-dashed border-hairline bg-app py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-hover text-white shadow-blue">
          <CreditCard className="h-6 w-6" />
        </span>
        <h3 className="mt-1 text-lg font-semibold text-heading">Manage your subscription</h3>
        <p className="max-w-sm text-sm text-body">
          To manage or upgrade your account, click the link below.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="primary" size="md">
            Manage subscription
          </Button>
          <Button variant="secondary" size="md">
            Cancel subscription
          </Button>
        </div>
      </div>
    </Card>
  );
}
