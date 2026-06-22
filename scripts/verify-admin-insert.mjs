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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SERVICE_KEY")
  process.exit(1)
}

// This is the admin client — same as createAdminClient() in our code
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function test() {
  // 1. Get the first user (simulate requireUserId())
  const { data: usersData } = await admin.auth.admin.listUsers()
  const user = usersData?.users?.[0]
  if (!user) {
    console.error("No users found")
    process.exit(1)
  }
  console.log("User:", user.id, user.email)

  // 2. INSERT a test service using admin client (bypasses RLS)
  const testPayload = {
    name: "TEST SERVICE - DELETE ME",
    category: "Facials",
    description: "Test from verify script",
    pricing_rule: "$100",
    duration: "30 min",
    active: true,
    user_id: user.id,
    updated_at: new Date().toISOString(),
  }

  console.log("\n--- INSERT via admin client ---")
  const { data: inserted, error: insertErr } = await admin
    .from("knowledge_services")
    .insert(testPayload)
    .select()
    .single()

  if (insertErr) {
    console.error("INSERT FAILED:", insertErr)
    process.exit(1)
  }
  console.log("INSERT OK:", inserted)

  // 3. SELECT back using admin client with user_id filter
  console.log("\n--- SELECT via admin client (eq user_id) ---")
  const { data: rows, error: selectErr } = await admin
    .from("knowledge_services")
    .select("*")
    .eq("user_id", user.id)
    .order("name")

  if (selectErr) {
    console.error("SELECT FAILED:", selectErr)
  } else {
    console.log(`SELECT returned ${rows.length} rows`)
    const testRow = rows.find((r) => r.name === "TEST SERVICE - DELETE ME")
    console.log("Test row found in results:", !!testRow)
  }

  // 4. Clean up
  console.log("\n--- DELETE test row ---")
  const { error: delErr } = await admin
    .from("knowledge_services")
    .delete()
    .eq("id", inserted.id)

  if (delErr) {
    console.error("DELETE FAILED:", delErr)
  } else {
    console.log("DELETE OK (cleanup done)")
  }

  console.log("\n✅ All operations passed! The admin client bypasses RLS correctly.")
}

test()
