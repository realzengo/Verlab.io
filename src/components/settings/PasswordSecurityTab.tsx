"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function PasswordSecurityTab() {
  const [editing, setEditing] = useState(false);
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
    setEditing(false);
  }

  return (
    <div>
      <h2 className="font-bold text-lg mb-6 mt-10 first:mt-0 text-heading">Security</h2>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-hairline last:border-0">
        <div className="flex-1">
          <p className="font-medium text-heading text-sm sm:text-base">Password</p>
          <p className="text-body text-xs sm:text-sm mt-0.5">Keep your account protected with a strong password.</p>

          {editing ? (
            <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 max-w-sm">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                autoFocus
                className="rounded-md border border-hairline bg-surface px-3 py-2 sm:py-1.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                className="rounded-md border border-hairline bg-surface px-3 py-2 sm:py-1.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />

              {error && <p className="text-sm text-danger">{error}</p>}

              <div className="flex items-center gap-2 mt-1">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 sm:py-1.5 bg-heading text-app rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                    setPassword("");
                    setConfirmPassword("");
                  }}
                  className="px-4 py-2 sm:py-1.5 border border-hairline rounded-md text-sm font-medium hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="mt-2 text-heading text-sm tracking-widest">••••••••</p>
              {saved && <p className="mt-1 text-xs text-body">Password updated.</p>}
            </>
          )}
        </div>

        {!editing && (
          <button
            type="button"
            onClick={() => {
              setSaved(false);
              setEditing(true);
            }}
            className="mt-3 sm:mt-0 self-start px-4 py-2 sm:py-1.5 border border-hairline rounded-md text-sm font-medium hover:bg-surface transition-colors"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
