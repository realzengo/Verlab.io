"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { CheckCircle2, Loader2, Mail, User as UserIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { SettingsCardHeader } from "@/components/settings/SettingsCardHeader";
import { createClient } from "@/lib/supabase/client";

export default function AccountSettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setName((data.user?.user_metadata?.full_name as string | undefined) ?? "");
      setEmail(data.user?.email ?? "");
    });
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSaving(true);

    const supabase = createClient();
    const { data, error: updateError } = await supabase.auth.updateUser({
      email: email !== user?.email ? email : undefined,
      data: { full_name: name },
    });

    setIsSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setUser(data.user);
    setSaved(true);
  }

  return (
    <Card className="max-w-2xl">
      <SettingsCardHeader
        icon={UserIcon}
        title="Account"
        description="Your personal information and how it appears across Clypa."
      />

      <div className="mt-6 flex items-center gap-4">
        <Avatar name={name || email || "?"} size="lg" className="text-base" />
        <div>
          <p className="text-sm font-semibold text-heading">{name || "Unnamed"}</p>
          <p className="text-sm text-body">{email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-5">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-body">
          Full name
          <div className="relative">
            <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border border-hairline bg-surface py-2.5 pl-10 pr-3.5 text-sm text-heading placeholder:text-subtle transition-colors focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-body">
          Email
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-hairline bg-surface py-2.5 pl-10 pr-3.5 text-sm text-heading placeholder:text-subtle transition-colors focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            />
          </div>
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}
        {saved && !error && (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Saved. {email !== user?.email && "Check your inbox to confirm the new email address."}
          </p>
        )}

        <div className="flex justify-end border-t border-hairline pt-6">
          <Button type="submit" variant="primary" size="md" disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
