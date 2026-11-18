"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { ShieldCheck, UserPlus, Users as UsersIcon } from "lucide-react";
import type { AdminRole, AdminTeamMember } from "@/lib/types";
import { Panel } from "@/components/admin/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { ADMIN_BUTTON, ADMIN_FIELD, ADMIN_HINT, ADMIN_LABEL, AdminDialog, AdminDialogBody, AdminDialogFooter } from "@/components/admin/AdminDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";
import { EMAIL_MAX, NAME_MAX, isValidEmail, isValidName } from "@/lib/validation";
import { AdminSelect } from "@/components/admin/AdminSelect";

const ROLE_VARIANT: Record<AdminRole, "success" | "default" | "warning"> = {
  owner: "success",
  admin: "default",
  support: "warning",
};

const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "support", label: "Support" },
  { value: "owner", label: "Owner" },
];

const inputClass = ADMIN_FIELD;
const labelClass = ADMIN_LABEL;

export function AdminTeamCard({ initialTeam }: { initialTeam: AdminTeamMember[] }) {
  const [team, setTeam] = useState(initialTeam);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("admin");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function closeModal() {
    setIsOpen(false);
    setName("");
    setEmail("");
    setRole("admin");
    setError(null);
  }

  async function handleInvite(event: FormEvent) {
    event.preventDefault();

    if (!isValidName(name, NAME_MAX)) {
      setError("Name is required and contains invalid characters or is too long");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid email address");
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to invite admin");
      return;
    }

    setTeam((prev) => [...prev, data.member]);
    closeModal();
  }

  return (
    <Panel
      className="h-full"
      bodyClassName="flex flex-col"
      title="Admin team"
      description="People with access to this dashboard"
      action={
        <Button variant="secondary" size="sm" icon={UserPlus} onClick={() => setIsOpen(true)}>
          Invite admin
        </Button>
      }
    >

      {team.length === 0 ? (
        <EmptyState
          className="flex-1 justify-center"
          icon={UsersIcon}
          title="No admin team members yet"
          description="Access is controlled by the ADMIN_EMAILS environment variable. Add a row here for each admin to show their name, role, and last login."
        />
      ) : (
        <div className="flex flex-col divide-y divide-hairline">
          {team.map((member) => (
            <div key={member.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
              <UserAvatar name={member.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-heading">{member.name}</p>
                <p className="truncate text-xs text-subtle">{member.email}</p>
              </div>
              <span className="hidden text-xs text-subtle sm:block">Last login {formatDate(member.lastLogin)}</span>
              <Badge variant={ROLE_VARIANT[member.role]}>
                <ShieldCheck className="h-3 w-3" />
                {member.role}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <AdminDialog
        open={isOpen}
        onClose={closeModal}
        title="Invite admin"
        description="Give a teammate access to this dashboard"
        icon={UserPlus}
      >
        <form onSubmit={handleInvite}>
          <AdminDialogBody>
            <div>
              <label htmlFor="invite-admin-name" className={labelClass}>
                Name
              </label>
              <input
                id="invite-admin-name"
                type="text"
                required
                maxLength={NAME_MAX}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label htmlFor="invite-admin-email" className={labelClass}>
                Email
              </label>
              <input
                id="invite-admin-email"
                type="email"
                required
                maxLength={EMAIL_MAX}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                placeholder="jane@company.com"
              />
            </div>
            <div>
              <span className={labelClass}>Role</span>
              <AdminSelect label="Role" value={role} onChange={setRole} options={ROLE_OPTIONS} />
              <p className={ADMIN_HINT}>
                This adds them to the list below. They still need their email added to the{" "}
                <code className="rounded bg-(--admin-fill-strong) px-1 py-0.5 font-mono text-[11.5px]">ADMIN_EMAILS</code>{" "}
                environment variable to sign in.
              </p>
            </div>
            {error && <p className="text-[13px] text-danger">{error}</p>}
          </AdminDialogBody>

          <AdminDialogFooter>
            <button type="button" onClick={closeModal} className={ADMIN_BUTTON.secondary}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={ADMIN_BUTTON.primary}>
              {submitting ? "Inviting…" : "Send invite"}
            </button>
          </AdminDialogFooter>
        </form>
      </AdminDialog>
    </Panel>
  );
}
