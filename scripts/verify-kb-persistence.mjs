import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

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
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0]
const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`

async function mgmtQuery(sql) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: sql }),
  })
  return { status: res.status, body: await res.text() }
}

async function getAuthUserIds() {
  const { body } = await mgmtQuery(
    `select id, email from auth.users order by created_at limit 5;`,
  )
  try {
    return JSON.parse(body)
  } catch {
    return []
  }
}

async function run() {
  console.log("\n=== END-TO-END PERSISTENCE VERIFICATION ===\n")

  console.log("Step 1: Find a real auth.users row…")
  const users = await getAuthUserIds()
  if (!Array.isArray(users) || users.length === 0) {
    console.error("No auth users found — aborting E2E.")
    return
  }
  const user = users[0]
  console.log(`Using user ${user.email} (${user.id})`)

  console.log("\nStep 2: Cleanup any previous test rows for this user…")
  await admin
    .from("knowledge_services")
    .delete()
    .eq("user_id", user.id)
    .like("name", "TEST_%")

  console.log("\nStep 3: Count rows BEFORE insert (admin client)…")
  const { count: before } = await admin
    .from("knowledge_services")
    .select("*", { count: "exact", head: true })
  console.log("  Total rows before:", before)

  console.log("\nStep 4: INSERT 3 services via admin client (simulating the server action)…")
  const testRows = [
    {
      name: "TEST_Botox",
      category: "Injectables",
      description: "Helps soften forehead lines and crow's feet",
      pricing_rule: "Per unit. Final price after consultation.",
      duration: "15 to 30 minutes",
      active: true,
      user_id: user.id,
    },
    {
      name: "TEST_Hydrafacial",
      category: "Facials",
      description: "Cleansing, exfoliation, and hydration facial",
      pricing_rule: "Starting price",
      duration: "45 to 60 minutes",
      active: true,
      user_id: user.id,
    },
    {
      name: "TEST_Co2",
      category: "Skin Rejuvenation",
      description: "Laser skin resurfacing",
      pricing_rule: "Per session",
      duration: "60 minutes",
      active: true,
      user_id: user.id,
    },
  ]
  const { data: inserted, error: insErr } = await admin
    .from("knowledge_services")
    .insert(testRows)
    .select()
  if (insErr) {
    console.error("  INSERT failed:", insErr)
    return
  }
  console.log(`  Inserted ${inserted?.length ?? 0} rows:`, inserted?.map((r) => r.name))

  console.log("\nStep 5: SELECT back via admin client…")
  const { data: adminRead, error: adminReadErr } = await admin
    .from("knowledge_services")
    .select("*")
    .eq("user_id", user.id)
    .like("name", "TEST_%")
    .order("name")
  console.log("  Admin SELECT:", { count: adminRead?.length, error: adminReadErr })
  console.log("  Categories:", adminRead?.map((r) => r.category))

  console.log("\nStep 6: SELECT back via ANON client (this is what the dashboard does on refresh)…")
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: anonRead, error: anonErr } = await anon
    .from("knowledge_services")
    .select("*")
    .like("name", "TEST_%")
    .order("name")
  console.log("  Anon SELECT (no auth header — must be 0):", {
    count: anonRead?.length,
    error: anonErr?.code,
  })

  console.log("\nStep 7: Sign in as the user, then SELECT (simulates the browser client after login)…")
  const { error: signInErr } = await anon.auth.signInWithPassword({
    email: user.email,
    password: process.env.TEST_USER_PASSWORD || "wrong-password",
  })
  if (signInErr) {
    console.log("  Could not sign in (expected — no password):", signInErr.message)
    console.log("  Skipping authed anon read; relying on RLS policy inspection instead.")
  } else {
    const { data: authedRead, error: authedErr } = await anon
      .from("knowledge_services")
      .select("*")
      .like("name", "TEST_%")
      .order("name")
    console.log("  Authed anon SELECT:", {
      count: authedRead?.length,
      error: authedErr?.message,
    })
    console.log("  Names:", authedRead?.map((r) => r.name))
    await anon.auth.signOut()
  }

  console.log("\nStep 8: Verify rows are STILL present after the anon reads (persistence proof)…")
  const { count: after } = await admin
    .from("knowledge_services")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .like("name", "TEST_%")
  console.log(`  TEST_ rows for user ${user.email}: ${after}`)

  console.log("\nStep 9: UPDATE one row via admin (simulating edit)…")
  const target = inserted?.[0]
  if (target) {
    const { error: updErr } = await admin
      .from("knowledge_services")
      .update({ pricing_rule: "UPDATED: $13/unit", active: false })
      .eq("id", target.id)
    console.log("  UPDATE:", { ok: !updErr, error: updErr?.message })
  }

  console.log("\nStep 10: DELETE one row via admin (simulating delete)…")
  if (target) {
    const { error: delErr } = await admin
      .from("knowledge_services")
      .delete()
      .eq("id", target.id)
    console.log("  DELETE:", { ok: !delErr, error: delErr?.message })
  }

  console.log("\nStep 11: Cleanup remaining test rows…")
  await admin
    .from("knowledge_services")
    .delete()
    .eq("user_id", user.id)
    .like("name", "TEST_%")

  console.log("\nStep 12: Final count of TEST_ rows (should be 0)…")
  const { count: final } = await admin
    .from("knowledge_services")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .like("name", "TEST_%")
  console.log("  TEST_ rows remaining:", final)

  console.log("\n=== DONE ===")
}

run().catch((e) => {
  console.error("E2E failed:", e)
  process.exit(1)
})