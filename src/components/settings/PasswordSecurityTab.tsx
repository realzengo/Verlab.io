"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { checkPasswordStrength } from "@/lib/validation";
import { Skeleton } from "@/components/ui/Skeleton";
import { SettingsRow, SettingsSection, settingsButton, settingsInput } from "@/components/settings/SettingsSection";

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

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete: string;
  autoFocus?: boolean;
  children?: React.ReactNode;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium leading-5 text-heading">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className={cn(settingsInput(), "pr-10")}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-subtle transition-colors duration-150 hover:text-heading"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
        </button>
      </div>
      {children}
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
      setError("Enter your current password");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
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
    <SettingsSection title="Sign-in" description="How you sign in to Verlab">
      <SettingsRow
        label="Password"
        description={
          hasPassword === null ? (
            <Skeleton className="mt-1 h-3.5 w-64 max-w-full rounded-full" />
          ) : hasPassword ? (
            "Use a strong password you don't use anywhere else"
          ) : (
            "You sign in with Google. Set a password to also sign in with your email."
          )
        }
        control={
          hasPassword === null ? (
            <Skeleton className="h-8 w-20 rounded-lg" />
          ) : (
            !editing && (
              <button
                type="button"
                onClick={() => {
                  setSaved(false);
                  setEditing(true);
                }}
                className={settingsButton()}
              >
                {hasPassword ? "Change password" : "Set password"}
              </button>
            )
          )
        }
      >
        {editing && (
          <form onSubmit={handleSubmit} className="mt-4 flex max-w-sm flex-col gap-4">
            {hasPassword && (
              <PasswordField
                label="Current password"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
                autoFocus
              />
            )}
            <PasswordField
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              autoFocus={!hasPassword}
            >
              {newPassword && (
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex flex-1 gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-colors duration-150",
                          i < strengthInfo.bars ? strengthInfo.className : "bg-hairline"
                        )}
                      />
                    ))}
                  </div>
                  {strengthInfo.label && (
                    <span
                      className={cn(
                        "w-12 text-right text-xs font-medium",
                        strength === "strong" ? "text-success" : strength === "fair" ? "text-warning" : "text-danger"
                      )}
                    >
                      {strengthInfo.label}
                    </span>
                  )}
                </div>
              )}
            </PasswordField>
            <PasswordField
              label="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex items-center gap-2">
              <button type="submit" disabled={isSaving} className={settingsButton("primary", "md")}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save password"}
              </button>
              <button type="button" onClick={resetForm} className={settingsButton("secondary", "md")}>
                Cancel
              </button>
            </div>
          </form>
        )}
        {!editing && saved && (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-success">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            Password updated. You stayed signed in here, and other devices were signed out.
          </p>
        )}
      </SettingsRow>
    </SettingsSection>
  );
}
