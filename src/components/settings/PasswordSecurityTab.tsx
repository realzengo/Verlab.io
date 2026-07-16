"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SettingsCardHeader } from "@/components/settings/SettingsCardHeader";
import { createClient } from "@/lib/supabase/client";

export function PasswordSecurityTab() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setSaved(true);
  }

  return (
    <Card className="max-w-2xl">
      <SettingsCardHeader
        icon={ShieldCheck}
        title="Password & security"
        description="Keep your account protected with a strong password."
      />

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-body">
          New password
          <div className="relative max-w-sm">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className="w-full rounded-xl border border-hairline bg-surface py-2.5 pl-10 pr-3.5 text-sm text-heading placeholder:text-subtle transition-colors focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-body">
          Confirm new password
          <div className="relative max-w-sm">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              className="w-full rounded-xl border border-hairline bg-surface py-2.5 pl-10 pr-3.5 text-sm text-heading placeholder:text-subtle transition-colors focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            />
          </div>
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}
        {saved && !error && (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Password updated.
          </p>
        )}

        <div className="mt-2 flex justify-end border-t border-hairline pt-6">
          <Button type="submit" variant="primary" size="md" disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
