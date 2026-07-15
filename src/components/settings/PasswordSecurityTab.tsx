import { Lock, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SettingsCardHeader } from "@/components/settings/SettingsCardHeader";

export function PasswordSecurityTab() {
  return (
    <Card className="max-w-2xl">
      <SettingsCardHeader
        icon={ShieldCheck}
        title="Password & security"
        description="Keep your account protected with a strong password."
      />

      <div className="mt-6 flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium text-body">
          Password
        </label>
        <div className="relative max-w-sm">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            id="password"
            type="password"
            value="********"
            disabled
            readOnly
            className="w-full rounded-xl border border-hairline bg-app py-2.5 pl-10 pr-3.5 text-sm text-heading"
          />
        </div>
        <button type="button" className="mt-1 w-fit text-sm font-medium text-primary hover:underline">
          Set a password
        </button>
      </div>

      <div className="mt-8 flex justify-end border-t border-hairline pt-6">
        <Button variant="primary" size="md">
          Save
        </Button>
      </div>
    </Card>
  );
}
