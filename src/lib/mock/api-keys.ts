import type { ApiKey } from "@/lib/types";

export const API_KEYS: ApiKey[] = [
  {
    id: "key-1",
    label: "Production",
    keyPreview: "clypa_live_••••••••••••8f2a",
    createdAt: "2026-04-12T10:00:00.000Z",
    lastUsedAt: "2026-07-13T22:14:00.000Z",
    scopes: ["bend:write", "transcripts:read", "sops:read"],
  },
  {
    id: "key-2",
    label: "Local dev",
    keyPreview: "clypa_test_••••••••••••c91d",
    createdAt: "2026-05-30T16:45:00.000Z",
    lastUsedAt: "2026-07-10T08:02:00.000Z",
    scopes: ["bend:write", "transcripts:read"],
  },
  {
    id: "key-3",
    label: "Old CI key",
    keyPreview: "clypa_live_••••••••••••11e0",
    createdAt: "2026-02-01T09:30:00.000Z",
    scopes: ["transcripts:read"],
    revoked: true,
  },
];
