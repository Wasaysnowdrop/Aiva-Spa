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

await q(`
  select tgname, tgrelid::regclass::text as tbl, pg_get_triggerdef(oid) as def
  from pg_trigger
  where tgrelid::regclass::text in ('knowledge_services','knowledge_faqs','knowledge_guardrails')
    and not tgisinternal
  order by tbl, tgname;
`, 'triggers')

await q(`
  select event_object_table, trigger_name, action_timing, event_manipulation, action_statement
  from information_schema.triggers
  where event_object_table in ('knowledge_services','knowledge_faqs','knowledge_guardrails')
  order by event_object_table, trigger_name;
`, 'triggers-info_schema')

await q(`
  select schemaname, tablename, policyname, cmd, qual::text, with_check::text
  from pg_policies
  where schemaname = 'public'
    and tablename in ('knowledge_services','knowledge_faqs','knowledge_guardrails')
  order by tablename, cmd;
`, 'policies')

await q(`
  select relname, relrowsecurity, relforcerowsecurity
  from pg_class
  where relname in ('knowledge_services','knowledge_faqs','knowledge_guardrails')
    and relnamespace = 'public'::regnamespace
  order by relname;
`, 'rls-state')

await q(`
  select now() as remote_now;
`, 'now')
