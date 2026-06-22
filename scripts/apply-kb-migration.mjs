import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

const envPath = resolve(process.cwd(), ".env.local")
const envContent = readFileSync(envPath, "utf-8")
const env = {}
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) continue
  const idx = trimmed.indexOf("=")
  if (idx === -1) continue
  const key = trimmed.slice(0, idx).trim()
  const value = trimmed.slice(idx + 1).trim()
  env[key] = value
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing Supabase credentials in .env.local")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function inspect() {
  console.log("\n=== CURRENT REMOTE STATE ===\n")

  const { data: cols, error: colsErr } = await supabase
    .from("knowledge_services")
    .select("*")
    .limit(1)

  console.log("knowledge_services select(*).limit(1):", { data: cols, error: colsErr })

  try {
    const { data: rpc, error: rpcErr } = await supabase.rpc("exec_sql", {
      sql: `
        select column_name, data_type, is_nullable, column_default
        from information_schema.columns
        where table_schema = 'public' and table_name = 'knowledge_services'
        order by ordinal_position;
      `,
    })
    console.log("\nknowledge_services columns:", { data: rpc, error: rpcErr })
  } catch (e) {
    console.log("\n(rpc exec_sql not available — try direct introspection)")
  }

  const { data: policies, error: polErr } = await supabase
    .from("pg_policies")
    .select("policyname, cmd, qual, with_check")
    .eq("tablename", "knowledge_services")

  console.log("\nknowledge_services RLS policies:", { data: policies, error: polErr })
}

async function applyMigration() {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/00023_kb_persistence_hardening.sql"),
    "utf-8",
  )

  console.log("\n=== APPLYING MIGRATION 00023_kb_persistence_hardening.sql ===\n")

  // Supabase JS client doesn't run arbitrary SQL. We split the migration into
  // individual statements and execute them through the PostgREST rpc endpoint
  // if available, or fall back to executing them via the pg connection through
  // a stored procedure we create on the fly.
  //
  // Simplest path: push the whole migration as one string via a transient
  // stored procedure call.

  const createFnSql = `
    create or replace function public._apply_migration_00023(p_sql text)
    returns void
    language plpgsql
    security definer
    set search_path = public
    as $$
    begin
      execute p_sql;
    end;
    $$;
  `

  const dropFnSql = `drop function if exists public._apply_migration_00023(text);`

  console.log("Creating transient exec function…")
  const { error: createErr } = await supabase.rpc("exec_sql", { sql: createFnSql })
  if (createErr) {
    console.error("Cannot create exec function via RPC:", createErr.message)
    console.log("\nFalling back: trying to apply via psql-style HTTP endpoint…")
    await applyViaMgmtApi(env.SUPABASE_ACCESS_TOKEN, sql)
    return
  }

  console.log("Exec function created. Applying migration statements…")
  const statements = sql
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^--/.test(s))

  let ok = 0
  let fail = 0
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const preview = stmt.replace(/\s+/g, " ").slice(0, 80)
    console.log(`\n[${i + 1}/${statements.length}] ${preview}…`)
    const { error } = await supabase.rpc("_apply_migration_00023", { p_sql: stmt })
    if (error) {
      console.error(`  FAILED: ${error.message}`)
      fail++
    } else {
      console.log("  ok")
      ok++
    }
  }

  console.log(`\nMigration: ${ok} ok, ${fail} failed`)

  console.log("\nDropping transient exec function…")
  await supabase.rpc("exec_sql", { sql: dropFnSql })
}

async function applyViaMgmtApi(accessToken, sql) {
  const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0]
  console.log(`\nUsing Supabase Management API for project ${projectRef}`)

  // Use the SQL endpoint — Supabase exposes /v1/projects/{ref}/database/query
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  console.log("Mgmt API status:", res.status)
  console.log("Mgmt API response:", text.slice(0, 2000))
}

const action = process.argv[2] || "inspect"

if (action === "inspect") {
  await inspect()
} else if (action === "apply") {
  await applyMigration()
  console.log("\n=== POST-APPLY STATE ===")
  await inspect()
} else {
  console.error(`Unknown action: ${action}. Use "inspect" or "apply".`)
  process.exit(1)
}