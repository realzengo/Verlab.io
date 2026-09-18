/**
 * Data-only backup of every public table + the auth user list, over the
 * Storage/PostgREST HTTP API using the service-role key already in
 * .env.local -- deliberately NOT pg_dump, which would need the direct
 * Postgres connection string from the dashboard (not stored in this repo)
 * and an IPv6 route to the pooler that this app has historically not had
 * (see the note in src/lib/supabase/admin.ts).
 *
 * Schema is NOT backed up here and does not need to be: all 79 migrations
 * live in supabase/migrations/ under git. What only exists in the live
 * database is the rows -- that is what this captures.
 *
 * Output: backups/<ISO timestamp>/<table>.ndjson, one JSON object per line,
 * so a huge table streams instead of being held in memory as one array.
 *
 *   node scripts/backup-data.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

// Minimal .env.local reader -- this runs outside Next, so nothing has
// loaded the file for us. Only KEY=value lines, last one wins.
async function loadEnv() {
  const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    let value = match[2].trim();
    if (/^["'].*["']$/.test(value)) value = value.slice(1, -1);
    process.env[match[1]] ??= value;
  }
}

/**
 * Ask PostgREST for its OpenAPI spec and read the table list out of it,
 * rather than hardcoding names here -- a hardcoded list silently stops
 * covering any table added after this script was written, which is exactly
 * the failure you'd only discover while trying to restore.
 */
async function listTables(url, key) {
  const response = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`Could not read PostgREST schema: ${response.status}`);
  const spec = await response.json();
  return Object.keys(spec.paths ?? {})
    .filter((p) => p.startsWith("/") && p.length > 1)
    .map((p) => p.slice(1))
    .filter((name) => !name.startsWith("rpc/"))
    .sort();
}

const PAGE_SIZE = 1000;

async function dumpTable(supabase, table, dir) {
  const stream = createWriteStream(path.join(dir, `${table}.ndjson`));
  let from = 0;
  let total = 0;

  for (;;) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + PAGE_SIZE - 1);
    if (error) {
      stream.end();
      throw new Error(error.message);
    }
    for (const row of data) stream.write(`${JSON.stringify(row)}\n`);
    total += data.length;
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  await new Promise((resolve) => stream.end(resolve));
  return total;
}

/**
 * auth.users lives outside the public schema, so PostGREST can't see it and
 * the loop above will never reach it. Without this you'd restore `profiles`
 * rows pointing at accounts that no longer exist.
 */
async function dumpAuthUsers(supabase, dir) {
  const stream = createWriteStream(path.join(dir, "auth_users.ndjson"));
  let page = 1;
  let total = 0;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) {
      stream.end();
      throw new Error(error.message);
    }
    for (const user of data.users) stream.write(`${JSON.stringify(user)}\n`);
    total += data.users.length;
    if (data.users.length < PAGE_SIZE) break;
    page += 1;
  }

  await new Promise((resolve) => stream.end(resolve));
  return total;
}

async function main() {
  await loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");

  const dir = path.join(process.cwd(), "backups", new Date().toISOString().replace(/[:.]/g, "-"));
  await mkdir(dir, { recursive: true });

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const tables = await listTables(url, key);
  console.log(`Backing up ${tables.length} tables + auth users -> ${path.relative(process.cwd(), dir)}\n`);

  const failed = [];
  let grandTotal = 0;

  for (const table of tables) {
    try {
      const count = await dumpTable(supabase, table, dir);
      grandTotal += count;
      console.log(`  ${table.padEnd(38)} ${String(count).padStart(8)} rows`);
    } catch (error) {
      failed.push(table);
      console.error(`  ${table.padEnd(38)} FAILED: ${error.message}`);
    }
  }

  try {
    const count = await dumpAuthUsers(supabase, dir);
    grandTotal += count;
    console.log(`  ${"auth.users".padEnd(38)} ${String(count).padStart(8)} rows`);
  } catch (error) {
    failed.push("auth.users");
    console.error(`  ${"auth.users".padEnd(38)} FAILED: ${error.message}`);
  }

  console.log(`\n${grandTotal} rows written to ${path.relative(process.cwd(), dir)}`);
  if (failed.length > 0) {
    console.error(`\n${failed.length} table(s) failed: ${failed.join(", ")}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
