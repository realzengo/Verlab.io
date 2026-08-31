"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkPasswordStrength } from "@/lib/validation";
import { Skeleton } from "@/components/ui/Skeleton";

type StrengthLevel = "empty" | "weak" | "fair" | "strong";

function strengthLevel(password: string, email: string | null): StrengthLevel {
  if (!password) return "empty";
  const { valid, issues } = checkPasswordStrength(password, email);
  if (valid) return "strong";
  // Length + class checks are the two "structural" issues -- anything left
  // once those pass (common-password, contains-email) is a fair password
  // with a specific, fixable problem rather than an outright weak one.
  const structural = issues.some((issue) => issue.startsWith("Use at least") || issue.startsWith("Mix at least"));
  return structural ? "weak" : "fair";
}

const STRENGTH_COPY: Record<StrengthLevel, { label: string; className: string; bars: number }> = {
  empty: { label: "", className: "bg-hairline", bars: 0 },
  weak: { label: "Weak", className: "bg-danger", bars: 1 },
  fair: { label: "Fair", className: "bg-warning", bars: 2 },
  strong: { label: "Strong", className: "bg-success", bars: 3 },
};

function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="w-full rounded-md border border-hairline bg-surface px-3 py-2 pr-10 sm:py-1.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-subtle hover:text-heading"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function PasswordSecurityTab() {
  const [email, setEmail] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  const [editing, setEditing] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setHasPassword(data.user?.identities?.some((identity) => identity.provider === "email") ?? false);
    });
  }, []);

  function resetForm() {
    setEditing(false);
    setError(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (hasPassword && !currentPassword) {
      setError("Enter your current password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    const strength = checkPasswordStrength(newPassword, email);
    if (!strength.valid) {
      setError(strength.issues[0]);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error ?? "Failed to update password.");
        return;
      }

      // The server route updates the session cookie but this tab's own
      // Supabase client still has the pre-change user cached -- refresh so
      // `hasPassword` (and any other identity state) reflects reality.
      const supabase = createClient();
      await supabase.auth.refreshSession();

      setHasPassword(true);
      setSaved(true);
      resetForm();
    } finally {
      setIsSaving(false);
    }
  }

  const strength = strengthLevel(newPassword, email);
  const strengthInfo = STRENGTH_COPY[strength];

  return (
    <div>
      <h2 className="font-bold text-lg mb-6 mt-10 first:mt-0 text-heading">Security</h2>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-hairline last:border-0">
        <div className="flex-1">
          <p className="font-medium text-heading text-sm sm:text-base">Password</p>
          <p className="text-body text-xs sm:text-sm mt-0.5">
            {hasPassword === false
              ? "You currently sign in with Google. Set a password to also sign in with your email."
              : "Keep your account protected with a strong, unique password."}
          </p>

          {hasPassword === null ? (
            <Skeleton className="mt-3 h-9 w-64 rounded-md" />
          ) : editing ? (
            <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2.5 max-w-sm">
              {hasPassword && (
                <PasswordInput
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  placeholder="Current password"
                  autoComplete="current-password"
                  autoFocus
                />
              )}
              <PasswordInput
                value={newPassword}
                onChange={setNewPassword}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                autoFocus={!hasPassword}
              />

              {newPassword && (
                <div className="flex flex-col gap-1">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i < strengthInfo.bars ? strengthInfo.className : "bg-hairline"
                        }`}
                      />
                    ))}
                  </div>
                  {strengthInfo.label && (
                    <span
                      className={`text-xs font-medium ${
                        strength === "strong" ? "text-success" : strength === "fair" ? "text-warning" : "text-danger"
                      }`}
                    >
                      {strengthInfo.label}
                    </span>
                  )}
                </div>
              )}

              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Re-enter your new password"
                autoComplete="new-password"
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
                  onClick={resetForm}
                  className="px-4 py-2 sm:py-1.5 border border-hairline rounded-md text-sm font-medium hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              {hasPassword ? (
                <p className="mt-2 text-heading text-sm tracking-widest">••••••••</p>
              ) : (
                <p className="mt-2 text-subtle text-sm italic">No password set</p>
              )}
              {saved && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Password updated. You&apos;ve been kept signed in here; other devices were signed out.
                </p>
              )}
            </>
          )}
        </div>

        {hasPassword !== null && !editing && (
          <button
            type="button"
            onClick={() => {
              setSaved(false);
              setEditing(true);
            }}
            className="mt-3 sm:mt-0 self-start px-4 py-2 sm:py-1.5 border border-hairline rounded-md text-sm font-medium hover:bg-surface transition-colors"
          >
            {hasPassword ? "Change" : "Set password"}
          </button>
        )}
      </div>
    </div>
  );
}
