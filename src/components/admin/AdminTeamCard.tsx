"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ShieldCheck, UserPlus, Users as UsersIcon, X } from "lucide-react";
import type { AdminRole, AdminTeamMember } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";

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

const inputClass =
  "w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-heading outline-none placeholder:text-subtle focus:border-primary";
const labelClass = "mb-1.5 block text-xs font-medium text-body";

export function AdminTeamCard({ initialTeam }: { initialTeam: AdminTeamMember[] }) {
  const [team, setTeam] = useState(initialTeam);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("admin");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  function closeModal() {
    setIsOpen(false);
    setName("");
    setEmail("");
    setRole("admin");
    setError(null);
  }

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
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
    <Card>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-heading">Admin team</h3>
          <p className="text-xs text-body">People with access to this dashboard</p>
        </div>
        <Button variant="secondary" size="sm" icon={UserPlus} onClick={() => setIsOpen(true)}>
          Invite admin
        </Button>
      </div>

      {team.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No admin team members yet"
          description="Access is controlled by the ADMIN_EMAILS environment variable. Add a row here for each admin to show their name, role, and last login."
        />
      ) : (
        <div className="flex flex-col divide-y divide-hairline">
          {team.map((member) => (
            <div key={member.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
              <Avatar name={member.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-heading">{member.name}</p>
                <p className="truncate text-xs text-body">{member.email}</p>
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

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={closeModal}>
          <div className="w-full max-w-sm rounded-xl bg-surface shadow-card-hover" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-hairline p-5">
              <h2 className="text-lg font-semibold text-heading">Invite admin</h2>
              <button type="button" onClick={closeModal} aria-label="Close" className="text-body hover:text-heading">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleInvite}>
              <div className="flex flex-col gap-4 p-5">
                <div>
                  <label className={labelClass}>Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={inputClass}
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClass}
                    placeholder="jane@company.com"
                  />
                </div>
                <div>
                  <label className={labelClass}>Role</label>
                  <select value={role} onChange={(event) => setRole(event.target.value as AdminRole)} className={inputClass}>
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-subtle">
                  This adds them to the list below. They still need their email added to the{" "}
                  <code className="rounded bg-app px-1 py-0.5">ADMIN_EMAILS</code> environment variable to sign in.
                </p>
                {error && <p className="text-xs text-danger">{error}</p>}
              </div>

              <div className="flex justify-end gap-3 border-t border-hairline p-5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border border-hairline bg-surface px-4 py-2 text-sm font-medium text-body hover:bg-app"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-btn-primary px-4 py-2 text-sm font-medium text-white hover:bg-btn-primary-hover disabled:opacity-50"
                >
                  {submitting ? "Inviting…" : "Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
