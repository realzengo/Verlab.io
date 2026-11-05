"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CurrentPlanRow } from "@/components/settings/PlanTab";
import { RedeemCodeRow } from "@/components/settings/RedeemCodeSection";
import { SettingsRow, SettingsSection, settingsButton, settingsInput } from "@/components/settings/SettingsSection";
import { EMAIL_MAX, NAME_MAX, isValidEmail, isValidName } from "@/lib/validation";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AccountSettingsPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const fullName = (data.user?.user_metadata?.full_name as string | undefined) ?? "";
      const meta = data.user?.user_metadata as { avatar_url?: string; picture?: string } | undefined;
      setName(fullName);
      setEmail(data.user?.email ?? "");
      setAvatarUrl(meta?.avatar_url ?? meta?.picture ?? null);
    });
  }, []);

  async function handleSaveName(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNameError(null);

    if (!isValidName(nameDraft)) {
      setNameError(`Name must be 1-${NAME_MAX} characters, letters/numbers/basic punctuation only.`);
      return;
    }

    setSavingName(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      data: { full_name: nameDraft },
    });

    setSavingName(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setName(nameDraft);
    setEditingName(false);
  }

  async function handleSaveEmail(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setEmailNotice(null);
    setEmailError(null);

    if (!isValidEmail(emailDraft)) {
      setEmailError("Enter a valid email address");
      return;
    }

    setSavingEmail(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ email: emailDraft });

    setSavingEmail(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setEmailNotice("Check your inbox to confirm the new email address.");
    setEditingEmail(false);
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    setIsDeleting(true);

    const response = await fetch("/api/account", { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setDeleteError(body.error ?? "Failed to delete account");
      setIsDeleting(false);
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-10">
      {error && <p className="-mb-6 text-sm text-danger">{error}</p>}

      <SettingsSection title="Profile" description="Your name and sign-in email">
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-heading text-sm font-semibold text-surface">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name || email || "Profile photo"}
                referrerPolicy="no-referrer"
                onError={() => setAvatarUrl(null)}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              initials(name || email || "?")
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-5 text-heading">{name || "No name set"}</p>
            <p className="truncate text-sm leading-5 text-subtle">{email}</p>
          </div>
        </div>

        <SettingsRow
          label="Full name"
          description="The name shown on your account"
          control={
            !editingName && (
              <button
                type="button"
                onClick={() => {
                  setNameDraft(name);
                  setNameError(null);
                  setEditingName(true);
                }}
                className={settingsButton()}
              >
                Edit
              </button>
            )
          }
        >
          {editingName && (
            <form onSubmit={handleSaveName} className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  aria-label="Full name"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  placeholder="Your name"
                  maxLength={NAME_MAX}
                  autoFocus
                  className={`${settingsInput({ invalid: !!nameError })} sm:w-72`}
                />
                <button type="submit" disabled={savingName} className={settingsButton("primary", "md")}>
                  {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingName(false);
                    setNameError(null);
                  }}
                  className={settingsButton("secondary", "md")}
                >
                  Cancel
                </button>
              </div>
              {nameError && <p className="mt-2 text-sm text-danger">{nameError}</p>}
            </form>
          )}
        </SettingsRow>

        <SettingsRow
          label="Email"
          description="Used to sign in and for account emails"
          control={
            !editingEmail && (
              <button
                type="button"
                onClick={() => {
                  setEmailDraft(email);
                  setEmailError(null);
                  setEditingEmail(true);
                }}
                className={settingsButton()}
              >
                Edit
              </button>
            )
          }
        >
          {editingEmail && (
            <form onSubmit={handleSaveEmail} className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  aria-label="Email"
                  value={emailDraft}
                  onChange={(event) => setEmailDraft(event.target.value)}
                  placeholder="you@example.com"
                  maxLength={EMAIL_MAX}
                  autoFocus
                  className={`${settingsInput({ invalid: !!emailError })} sm:w-72`}
                />
                <button type="submit" disabled={savingEmail} className={settingsButton("primary", "md")}>
                  {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingEmail(false);
                    setEmailError(null);
                  }}
                  className={settingsButton("secondary", "md")}
                >
                  Cancel
                </button>
              </div>
              {emailError && <p className="mt-2 text-sm text-danger">{emailError}</p>}
            </form>
          )}
          {!editingEmail && emailNotice && <p className="mt-2 text-sm text-heading">{emailNotice}</p>}
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Plan">
        <CurrentPlanRow />
        <RedeemCodeRow />
      </SettingsSection>

      <SettingsSection title="Account">
        <SettingsRow
          label="Log out"
          description="Sign out of Verlab on this device"
          control={
            <button type="button" onClick={handleLogout} disabled={isLoggingOut} className={settingsButton()}>
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log out"}
            </button>
          }
        />
        <SettingsRow
          label="Delete account"
          description="Permanently delete your account and all of its data. This can't be undone."
          control={
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className={settingsButton("danger")}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete account"}
            </button>
          }
        >
          {deleteError && <p className="mt-2 text-sm text-danger">{deleteError}</p>}
        </SettingsRow>
      </SettingsSection>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
        title="Delete your account?"
        description="This permanently deletes your account and all associated data. This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
