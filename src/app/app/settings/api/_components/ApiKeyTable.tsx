"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import type { ApiKey } from "@/lib/types";

export function ApiKeyTable() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/api-keys").then(async (res) => {
      const data = res.ok ? await res.json() : { keys: [] };
      if (!cancelled) {
        setKeys(data.keys);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate() {
    const label = window.prompt("Name this key (e.g. \"Production\")");
    if (!label) return;

    setCreating(true);
    setError(null);
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const data = await res.json();
    setCreating(false);

    if (!res.ok) {
      setError(data.error ?? "Could not create key");
      return;
    }

    setNewSecret(data.secret);
    setKeys((prev) => [data.key, ...prev]);
  }

  async function handleRevoke(id: string, label: string) {
    if (!window.confirm(`Revoke "${label}"? This can't be undone.`)) return;

    setRevokingId(id);
    const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    setRevokingId(null);

    if (res.ok) {
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revoked: true } : k)));
    }
  }

  function copySecret() {
    if (!newSecret) return;
    navigator.clipboard.writeText(newSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-body">API keys</h3>
        <Button size="sm" icon={creating ? Loader2 : Plus} onClick={handleCreate} disabled={creating}>
          Create key
        </Button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {newSecret && (
        <div className="flex flex-col gap-2 rounded-card-sm border border-primary/30 bg-accent p-4">
          <p className="text-sm font-medium text-heading">
            Copy your key now — you won&apos;t be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-surface px-3 py-2 text-xs">{newSecret}</code>
            <button
              type="button"
              onClick={copySecret}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-body hover:text-heading"
              aria-label="Copy key"
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setNewSecret(null)}
            className="w-fit text-sm font-medium text-primary hover:underline"
          >
            Done
          </button>
        </div>
      )}

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Label</TableHeaderCell>
            <TableHeaderCell>Key</TableHeaderCell>
            <TableHeaderCell>Created</TableHeaderCell>
            <TableHeaderCell>Last used</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell />
          </TableRow>
        </TableHead>
        <tbody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-body">
                Loading…
              </TableCell>
            </TableRow>
          ) : keys.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-body">
                No API keys yet.
              </TableCell>
            </TableRow>
          ) : (
            keys.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-medium">{key.label}</TableCell>
                <TableCell className="font-mono text-xs">{key.keyPreview}</TableCell>
                <TableCell>{formatDate(key.createdAt)}</TableCell>
                <TableCell>{key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}</TableCell>
                <TableCell>
                  <Badge variant={key.revoked ? "default" : "success"}>{key.revoked ? "Revoked" : "Active"}</Badge>
                </TableCell>
                <TableCell>
                  {!key.revoked && (
                    <button
                      type="button"
                      aria-label={`Revoke ${key.label}`}
                      onClick={() => handleRevoke(key.id, key.label)}
                      disabled={revokingId === key.id}
                      className="text-body hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
}
