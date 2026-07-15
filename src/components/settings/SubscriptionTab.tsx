import { CreditCard } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function SubscriptionTab() {
  return (
    <Card className="max-w-xl">
      <h2 className="text-lg font-semibold text-heading">Subscription</h2>
      <div className="mt-4 border-b border-hairline" />

      <div className="mt-10 flex flex-col items-center gap-3 py-10 text-center">
        <CreditCard className="h-8 w-8 text-body" />
        <h3 className="text-lg font-medium text-heading">Manage your Subscription</h3>
        <p className="max-w-sm text-sm text-body">
          To manage or upgrade your account click the link below.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="primary" size="md">
            Manage Subscription
          </Button>
          <Button variant="secondary" size="md">
            Cancel Subscription
          </Button>
        </div>
      </div>
    </Card>
  );
}
