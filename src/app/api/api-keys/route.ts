import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ApiKey } from "@/lib/types";

const KEY_PREFIX = "verlab_live_";

interface ApiKeyRow {
  id: string;
  label: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  scopes: string[];
  revoked_at: string | null;
}

function toApiKey(row: ApiKeyRow): ApiKey {
  return {
    id: row.id,
    label: row.label,
    keyPreview: `${KEY_PREFIX}••••••••••••${row.key_prefix}`,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at ?? undefined,
    scopes: row.scopes,
    revoked: row.revoked_at !== null,
  };
}

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, label, key_prefix, created_at, last_used_at, scopes, revoked_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ keys: (data as ApiKeyRow[]).map(toApiKey) });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { label?: string; scopes?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const label = body.label?.trim();
  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const secret = randomBytes(24).toString("hex");
  const keyHash = createHash("sha256").update(secret).digest("hex");
  const keyPrefix = secret.slice(-4);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: user.id,
      label,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: body.scopes ?? [],
    })
    .select("id, label, key_prefix, created_at, last_used_at, scopes, revoked_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    key: toApiKey(data as ApiKeyRow),
    // Full secret — shown once, never retrievable again (only the hash is stored).
    secret: `${KEY_PREFIX}${secret}`,
  });
}
