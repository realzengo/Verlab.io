"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MOCK_USER } from "@/lib/mock-data";

export default function AccountSettingsPage() {
  return (
    <Card className="max-w-xl">
      <h2 className="text-lg font-semibold text-heading">Account</h2>
      <div className="mt-4 border-b border-hairline" />

      <form className="mt-6 flex flex-col gap-5">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-body">
          Full name
          <input
            type="text"
            defaultValue={MOCK_USER.name}
            className="rounded-lg border border-hairline bg-surface px-3.5 py-2.5 text-sm text-heading placeholder:text-body focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-body">
          Email
          <input
            type="email"
            defaultValue={MOCK_USER.email}
            className="rounded-lg border border-hairline bg-surface px-3.5 py-2.5 text-sm text-heading placeholder:text-body focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <div>
          <Button type="submit" variant="primary" size="md">
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}
