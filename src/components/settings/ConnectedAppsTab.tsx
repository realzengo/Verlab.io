"use client";

import { useEffect, useState } from "react";
import { Loader2, Plug, Unplug } from "lucide-react";
import { ClaudeIcon, ChatGPTIcon } from "@/components/landing/AssistantIcons";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

interface Connection {
  clientId: string;
  clientName: string | null;
}

function ConnectionIcon({ clientName }: { clientName: string | null }) {
  const name = (clientName ?? "").toLowerCase();
  if (name.includes("claude")) {
    return <ClaudeIcon className="h-11 w-11 shrink-0 rounded-2xl ring-1 ring-black/5" />;
  }
  if (name.includes("chatgpt") || name.includes("gpt")) {
    return <ChatGPTIcon className="h-11 w-11 shrink-0 rounded-2xl ring-1 ring-black/5" />;
  }
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
      <Plug className="h-5 w-5" />
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
    <div>
      <h2 className="font-bold text-lg mt-10 first:mt-0 text-heading">Connected apps</h2>
      <p className="mb-6 mt-1 text-sm text-body">Assistants and clients with access to your Verlab account.</p>

      {connections === null ? (
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-[76px] w-full rounded-2xl" />
        </div>
      ) : connections.length === 0 ? (
        <p className="text-sm text-body">No apps are connected yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {connections.map((connection) => {
            const revoking = revokingId === connection.clientId;
            return (
              <div
                key={connection.clientId}
                className="flex items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <ConnectionIcon clientName={connection.clientName} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-heading">{connection.clientName || "Unnamed app"}</p>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-success">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                      </span>
                      Connected
                    </span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDisconnect(connection.clientId)}
                  disabled={revoking}
                  className="shrink-0 gap-1.5"
                >
                  {revoking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                  Disconnect
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
