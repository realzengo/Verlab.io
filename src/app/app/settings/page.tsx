"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PlanTab } from "@/components/settings/PlanTab";
import { RedeemCodeSection } from "@/components/settings/RedeemCodeSection";
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
      setEmailError("Please enter a valid email address.");
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
    <div>
      {/* Profile avatar section */}
      <div className="flex items-center gap-4 mb-10">
        <div className="w-16 h-16 shrink-0 rounded-full overflow-hidden bg-gray-900 text-white flex items-center justify-center text-lg font-semibold">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name || email || "Profile photo"}
              referrerPolicy="no-referrer"
              onError={() => setAvatarUrl(null)}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          ) : (
            initials(name || email || "?")
          )}
        </div>
        <div>
          <p className="font-semibold text-lg text-heading">{name || "Unnamed"}</p>
          <p className="text-body text-sm">{email}</p>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {/* Profile section */}
      <div>
        <h2 className="font-bold text-lg mb-6 mt-10 text-heading">Profile</h2>

        {/* Full name row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-hairline last:border-0">
          <div>
            <p className="font-medium text-heading text-sm sm:text-base">Full name</p>
            <p className="text-body text-xs sm:text-sm mt-0.5">The name displayed on your account.</p>
            {editingName ? (
              <form onSubmit={handleSaveName} className="mt-2 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    placeholder="Your name"
                    maxLength={NAME_MAX}
                    autoFocus
                    className="rounded-md border border-hairline bg-surface px-3 py-2 sm:py-1.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={savingName}
                    className="px-4 py-2 sm:py-1.5 bg-heading text-app rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingName(false);
                      setNameError(null);
                    }}
                    className="px-4 py-2 sm:py-1.5 border border-hairline rounded-md text-sm font-medium hover:bg-surface transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                {nameError && <p className="text-sm text-danger">{nameError}</p>}
              </form>
            ) : (
              <p className="mt-2 text-heading text-sm">{name || "N/A"}</p>
            )}
          </div>
          {!editingName && (
            <button
              type="button"
              onClick={() => {
                setNameDraft(name);
                setNameError(null);
                setEditingName(true);
              }}
              className="mt-3 sm:mt-0 self-start px-4 py-2 sm:py-1.5 border border-hairline rounded-md text-sm font-medium hover:bg-surface transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {/* Email row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-hairline last:border-0">
          <div>
            <p className="font-medium text-heading text-sm sm:text-base">Email</p>
            <p className="text-body text-xs sm:text-sm mt-0.5">Used for login and notifications.</p>
            {editingEmail ? (
              <form onSubmit={handleSaveEmail} className="mt-2 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="email"
                    value={emailDraft}
                    onChange={(event) => setEmailDraft(event.target.value)}
                    placeholder="you@example.com"
                    maxLength={EMAIL_MAX}
                    autoFocus
                    className="rounded-md border border-hairline bg-surface px-3 py-2 sm:py-1.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={savingEmail}
                    className="px-4 py-2 sm:py-1.5 bg-heading text-app rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEmail(false);
                      setEmailError(null);
                    }}
                    className="px-4 py-2 sm:py-1.5 border border-hairline rounded-md text-sm font-medium hover:bg-surface transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                {emailError && <p className="text-sm text-danger">{emailError}</p>}
              </form>
            ) : (
              <>
                <p className="mt-2 text-heading text-sm">{email || "N/A"}</p>
                {emailNotice && <p className="mt-1 text-xs text-body">{emailNotice}</p>}
              </>
            )}
          </div>
          {!editingEmail && (
            <button
              type="button"
              onClick={() => {
                setEmailDraft(email);
                setEmailError(null);
                setEditingEmail(true);
              }}
              className="mt-3 sm:mt-0 self-start px-4 py-2 sm:py-1.5 border border-hairline rounded-md text-sm font-medium hover:bg-surface transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <PlanTab />

      <RedeemCodeSection />

      {/* Account actions section */}
      <div>
        <h2 className="font-bold text-lg mb-6 mt-10 text-heading">Account</h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-hairline last:border-0">
          <div>
            <p className="font-medium text-heading text-sm sm:text-base">Log out</p>
            <p className="text-body text-xs sm:text-sm mt-0.5">Sign out of your account on this device.</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="mt-3 sm:mt-0 self-start px-4 py-2 sm:py-1.5 border border-hairline rounded-md text-sm font-medium hover:bg-surface transition-colors disabled:opacity-50"
          >
            {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log out"}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-hairline last:border-0">
          <div>
            <p className="font-medium text-heading text-sm sm:text-base">Delete account</p>
            <p className="text-body text-xs sm:text-sm mt-0.5">
              Permanently delete your account and all associated data. This cannot be undone.
            </p>
            {deleteError && <p className="mt-2 text-sm text-danger">{deleteError}</p>}
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            className="mt-3 sm:mt-0 self-start px-4 py-2 sm:py-1.5 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete account"}
          </button>
        </div>
      </div>

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
