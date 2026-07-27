"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Image must be smaller than 5MB.");
      return;
    }

    setError(null);
    setUploadingAvatar(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      setUploadingAvatar(false);
      setError("You must be signed in to change your photo.");
      return;
    }

    const extension = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { cacheControl: "3600", upsert: true });

    if (uploadError) {
      setUploadingAvatar(false);
      setError(uploadError.message);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error: updateError } = await supabase.auth.updateUser({
      data: { avatar_url: publicUrlData.publicUrl },
    });

    setUploadingAvatar(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setAvatarUrl(publicUrlData.publicUrl);
  }

  async function handleSaveName(event: FormEvent) {
    event.preventDefault();
    setError(null);
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
    const confirmed = window.confirm(
      "This permanently deletes your account and all associated data. This cannot be undone. Continue?"
    );
    if (!confirmed) return;

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
        <div className="relative w-16 h-16 shrink-0 group">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-900 text-white flex items-center justify-center text-lg font-semibold">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name || email || "Profile photo"}
                referrerPolicy="no-referrer"
                onError={() => setAvatarUrl(null)}
                className="w-full h-full object-cover"
              />
            ) : (
              initials(name || email || "?")
            )}
          </div>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Change profile photo"
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity disabled:opacity-100"
          >
            {uploadingAvatar ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
        <div>
          <p className="font-semibold text-lg text-heading">{name || "Unnamed"}</p>
          <p className="text-body text-sm">{email}</p>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="text-primary text-sm font-medium hover:underline disabled:opacity-50"
          >
            {uploadingAvatar ? "Uploading…" : "Edit"}
          </button>
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
              <form onSubmit={handleSaveName} className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  placeholder="Your name"
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
                  onClick={() => setEditingName(false)}
                  className="px-4 py-2 sm:py-1.5 border border-hairline rounded-md text-sm font-medium hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <p className="mt-2 text-heading text-sm">{name || "—"}</p>
            )}
          </div>
          {!editingName && (
            <button
              type="button"
              onClick={() => {
                setNameDraft(name);
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
              <form onSubmit={handleSaveEmail} className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  value={emailDraft}
                  onChange={(event) => setEmailDraft(event.target.value)}
                  placeholder="you@example.com"
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
                  onClick={() => setEditingEmail(false)}
                  className="px-4 py-2 sm:py-1.5 border border-hairline rounded-md text-sm font-medium hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <p className="mt-2 text-heading text-sm">{email || "—"}</p>
                {emailNotice && <p className="mt-1 text-xs text-body">{emailNotice}</p>}
              </>
            )}
          </div>
          {!editingEmail && (
            <button
              type="button"
              onClick={() => {
                setEmailDraft(email);
                setEditingEmail(true);
              }}
              className="mt-3 sm:mt-0 self-start px-4 py-2 sm:py-1.5 border border-hairline rounded-md text-sm font-medium hover:bg-surface transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

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
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="mt-3 sm:mt-0 self-start px-4 py-2 sm:py-1.5 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete account"}
          </button>
        </div>
      </div>
    </div>
  );
}
