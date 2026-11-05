"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plug } from "lucide-react";
import { ClaudeIcon, ChatGPTIcon } from "@/components/landing/AssistantIcons";
import { Skeleton } from "@/components/ui/Skeleton";
import { SettingsRow, SettingsSection, settingsButton } from "@/components/settings/SettingsSection";

interface Connection {
  clientId: string;
  clientName: string | null;
}

function ConnectionIcon({ clientName }: { clientName: string | null }) {
  const name = (clientName ?? "").toLowerCase();
  if (name.includes("claude")) {
    return <ClaudeIcon className="h-9 w-9 shrink-0 rounded-lg ring-1 ring-black/5" />;
  }
  if (name.includes("chatgpt") || name.includes("gpt")) {
    return <ChatGPTIcon className="h-9 w-9 shrink-0 rounded-lg ring-1 ring-black/5" />;
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hairline bg-app text-subtle">
      <Plug className="h-4 w-4" strokeWidth={1.75} />
    </span>
  );
}

export function ConnectedAppsTab() {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/oauth/connections")
      .then((res) => (res.ok ? res.json() : { connections: [] }))
      .then((data) => {
        if (!cancelled) setConnections(data.connections ?? []);
      })
      .catch(() => {
        if (!cancelled) setConnections([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDisconnect(clientId: string) {
    setRevokingId(clientId);
    try {
      const res = await fetch("/api/oauth/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      if (res.ok) {
        setConnections((prev) => prev?.filter((c) => c.clientId !== clientId) ?? null);
      }
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <SettingsSection
      title="Connected apps"
      description="Assistants and apps with access to your Verlab account"
      action={
        <Link href="/mcp" className={settingsButton()}>
          Connect an app
        </Link>
      }
    >
      {connections === null ? (
        <div className="flex items-center gap-3 px-5 py-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-28 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
          <Skeleton className="h-8 w-24 shrink-0 rounded-lg" />
        </div>
      ) : connections.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-heading">No apps connected yet</p>
          <p className="mt-0.5 text-sm text-subtle">Connect Claude or ChatGPT to use Verlab from your assistant</p>
        </div>
      ) : (
        connections.map((connection) => {
          const revoking = revokingId === connection.clientId;
          return (
            <SettingsRow
              key={connection.clientId}
              className="sm:items-center"
              label={
                <span className="flex min-w-0 items-center gap-3">
                  <ConnectionIcon clientName={connection.clientName} />
                  <span className="min-w-0">
                    <span className="block truncate">{connection.clientName || "Unnamed app"}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-sm font-normal text-subtle">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
                      Connected
                    </span>
                  </span>
                </span>
              }
              control={
                <button
                  type="button"
                  onClick={() => handleDisconnect(connection.clientId)}
                  disabled={revoking}
                  className={settingsButton()}
                >
                  {revoking && <Loader2 className="h-4 w-4 animate-spin" />}
                  Disconnect
                </button>
              }
            />
          );
        })
      )}
    </SettingsSection>
  );
}
