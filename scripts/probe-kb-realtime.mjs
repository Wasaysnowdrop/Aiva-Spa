import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), ".env.local"), "utf-8")
    .split(/\r?\n/)
    .map((l) => {
      const t = l.trim()
      if (!t || t.startsWith("#")) return [null, null]
      const i = t.indexOf("=")
      return i > 0 ? [t.slice(0, i).trim(), t.slice(i + 1).trim()] : [null, null]
    })
    .filter(([k]) => k),
)

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const channel = admin
  .channel("kb-watch")
  .on("postgres_changes", { event: "*", schema: "public", table: "knowledge_services" }, (payload) => {
    console.log(`[${new Date().toISOString()}] EVENT ${payload.eventType} on knowledge_services`)
    console.log("  new:", JSON.stringify(payload.new))
    console.log("  old:", JSON.stringify(payload.old))
  })
  .subscribe((status) => console.log("channel status:", status))

// Wait for subscription
await new Promise((r) => setTimeout(r, 2000))

console.log("\n>>> Inserting test row…")
const probeName = `REALTIME-PROBE-${Date.now()}`
const { data: ins, error: insErr } = await admin
  .from("knowledge_services")
  .insert({ name: probeName, category: "Skin", description: "rt", pricing_rule: "", duration: "", active: true })
  .select()
  .single()
console.log("insert result:", { id: ins?.id, error: insErr?.message })

// Wait for events
await new Promise((r) => setTimeout(r, 3000))

console.log("\n>>> Deleting test row…")
if (ins?.id) {
  const { error: delErr } = await admin.from("knowledge_services").delete().eq("id", ins.id)
  console.log("delete result:", { error: delErr?.message })
}

await new Promise((r) => setTimeout(r, 2000))
await admin.removeChannel(channel)
console.log("done")
process.exit(0)
