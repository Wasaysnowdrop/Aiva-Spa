import { readFileSync } from "node:fs"
import { resolve } from "node:path"

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
const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`

async function q(sql, label) {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
    body: JSON.stringify({ query: sql }),
  })
  const t = await r.text()
  console.log(`\n--- ${label} (${r.status}) ---`)
  console.log(t.slice(0, 5000))
}

await q(`select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;`, 'realtime-pub-tables')

await q(`select id, name, schema, slot_name, active, events from realtime.subscription order by id;`, 'realtime-subscriptions')

// Also check the dashboard and dev server logs - try to find any error in the editor

await q(`
  select actor_id, action, created_at
  from audit_logs
  where action ilike 'kb.%' or action ilike 'knowledge%' or action ilike 'onboarding%'
  order by created_at desc
  limit 20;
`, 'audit-kb-events')
