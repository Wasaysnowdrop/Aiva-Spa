import { readFileSync } from "node:fs"
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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function run() {
  // List all users
  const { data: usersData } = await admin.auth.admin.listUsers()
  console.log("=== ALL USERS ===")
  for (const u of usersData.users) {
    console.log(`  ${u.id}  ${u.email}  created: ${u.created_at}`)
  }

  // Check existing service rows and their user_id values
  const { data: services } = await admin.from("knowledge_services").select("id, name, user_id")
  console.log("\n=== EXISTING SERVICES ===")
  for (const s of (services ?? [])) {
    console.log(`  ${s.id}  user_id=${s.user_id}  name="${s.name}"`)
  }

  const { data: faqs } = await admin.from("knowledge_faqs").select("id, question, user_id")
  console.log(`\n=== EXISTING FAQS (${(faqs ?? []).length} rows) ===`)
  for (const f of (faqs ?? []).slice(0, 3)) {
    console.log(`  ${f.id}  user_id=${f.user_id}  q="${f.question}"`)
  }

  const { data: guardrails } = await admin.from("knowledge_guardrails").select("id, title, user_id")
  console.log(`\n=== EXISTING GUARDRAILS (${(guardrails ?? []).length} rows) ===`)
  for (const g of (guardrails ?? []).slice(0, 3)) {
    console.log(`  ${g.id}  user_id=${g.user_id}  title="${g.title}"`)
  }
}

run()
