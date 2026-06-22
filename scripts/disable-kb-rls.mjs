import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8")
const env = {}
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) continue
  const idx = trimmed.indexOf("=")
  if (idx === -1) continue
  env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN
if (!SUPABASE_URL || !ACCESS_TOKEN) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_ACCESS_TOKEN in .env.local")
  process.exit(1)
}
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0]
const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`

async function query(sql, label) {
  process.stdout.write(`\n[${label}] ... `)
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (res.ok) {
    console.log(`ok (${res.status})`)
    return text
  }
  console.log(`FAILED (${res.status})`)
  console.log(text.slice(0, 4000))
  return null
}

const arg = process.argv[2] || "verify"
if (arg === "apply") {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/00026_kb_disable_rls.sql"),
    "utf-8",
  )
  console.log("Applying migration 00026_kb_disable_rls.sql via Supabase Management API …")
  const out = await query(sql, "apply-00026")
  if (out) console.log(out.slice(0, 1000))
}

console.log("\n=== POST-VERIFY (knowledge_services) ===")
console.log(await query(
  `select relname, relrowsecurity, relforcerowsecurity
     from pg_class
    where relname in ('knowledge_services','knowledge_faqs','knowledge_guardrails')
      and relnamespace = 'public'::regnamespace
    order by relname;`,
  "rls-state",
))
console.log(await query(
  `select tablename, policyname, cmd
     from pg_policies
    where schemaname = 'public'
      and tablename in ('knowledge_services','knowledge_faqs','knowledge_guardrails')
    order by tablename, policyname;`,
  "policies",
))
