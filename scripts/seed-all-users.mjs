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
  // Get all real users (not test users)
  const { data: usersData } = await admin.auth.admin.listUsers()
  const realUsers = usersData.users.filter(u => !u.email?.includes("test") && !u.email?.includes("probe"))

  console.log("Real users:")
  for (const u of realUsers) {
    console.log(`  ${u.id}  ${u.email}`)
  }

  // For each real user, clone the existing KB rows so everyone sees the seed data
  // First, get the current services
  const { data: existingServices } = await admin.from("knowledge_services").select("*")
  
  console.log(`\nExisting services: ${existingServices?.length ?? 0}`)

  // Get unique user_ids that already have services
  const existingUserIds = new Set((existingServices ?? []).map(s => s.user_id).filter(Boolean))
  console.log("User IDs that already have services:", [...existingUserIds])

  // For each real user without services, clone from the first user's services
  const sourceServices = (existingServices ?? []).filter(s => s.user_id === [...existingUserIds][0])
  
  for (const user of realUsers) {
    if (existingUserIds.has(user.id)) {
      console.log(`\n✓ User ${user.email} already has services`)
      continue
    }

    console.log(`\n→ Cloning ${sourceServices.length} services for ${user.email}...`)
    for (const svc of sourceServices) {
      const rest = Object.assign({}, svc)
      delete rest.id
      delete rest.created_at
      const { error } = await admin
        .from("knowledge_services")
        .insert({ ...rest, user_id: user.id })
      if (error) {
        console.error(`  FAILED: ${error.message}`)
      } else {
        console.log(`  ✓ Cloned: ${svc.name}`)
      }
    }
  }

  // Same for FAQs
  const { data: existingFaqs } = await admin.from("knowledge_faqs").select("*")
  if ((existingFaqs ?? []).length > 0) {
    const faqUserIds = new Set(existingFaqs.map(f => f.user_id).filter(Boolean))
    const sourceFaqs = existingFaqs.filter(f => f.user_id === [...faqUserIds][0])
    for (const user of realUsers) {
      if (faqUserIds.has(user.id)) continue
      for (const faq of sourceFaqs) {
        const rest = Object.assign({}, faq)
        delete rest.id
        delete rest.created_at
        await admin.from("knowledge_faqs").insert({ ...rest, user_id: user.id })
      }
    }
  }

  // Same for guardrails
  const { data: existingGuardrails } = await admin.from("knowledge_guardrails").select("*")
  if ((existingGuardrails ?? []).length > 0) {
    const grdUserIds = new Set(existingGuardrails.map(g => g.user_id).filter(Boolean))
    const sourceGrds = existingGuardrails.filter(g => g.user_id === [...grdUserIds][0])
    for (const user of realUsers) {
      if (grdUserIds.has(user.id)) continue
      for (const grd of sourceGrds) {
        const rest = Object.assign({}, grd)
        delete rest.id
        delete rest.created_at
        await admin.from("knowledge_guardrails").insert({ ...rest, user_id: user.id })
      }
    }
  }

  console.log("\n✅ Done! All real users now have KB data.")
}

run()
