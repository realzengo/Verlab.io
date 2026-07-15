import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function PasswordSecurityTab() {
  return (
    <Card className="max-w-xl">
      <h2 className="text-lg font-semibold text-heading">Password &amp; Security</h2>
      <div className="mt-4 border-b border-hairline" />

      <div className="mt-6 flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium text-body">
          Password
        </label>
        <input
          id="password"
          type="password"
          value="********"
          disabled
          readOnly
          className="w-full max-w-sm rounded-md border border-hairline bg-app px-3 py-2 text-sm text-heading"
        />
        <button type="button" className="w-fit text-sm text-primary hover:underline">
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
