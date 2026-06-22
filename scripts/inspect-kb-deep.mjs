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

// 1. All scheduled jobs
await q(`select jobname, schedule, active, database, username from cron.job order by jobname;`, 'cron-jobs')

// 2. All functions in public schema
await q(`
  select n.nspname as schema, p.proname as name, p.prosecdef as security_definer, pg_get_functiondef(p.oid) as def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public')
  order by p.proname;
`, 'functions')

// 3. All event triggers
await q(`select evtname, evtenabled, pg_get_event_triggerdef(oid) as def from pg_event_trigger order by evtname;`, 'event-triggers')

// 4. All triggers (including row-level) on KB tables
await q(`
  select tgname, tgrelid::regclass::text as tbl, tgtype, pg_get_triggerdef(oid) as def
  from pg_trigger
  where tgrelid::regclass::text in ('knowledge_services','knowledge_faqs','knowledge_guardrails')
  order by tbl, tgname;
`, 'kb-triggers')

// 5. ALL triggers in DB to spot anything weird
await q(`
  select tgname, tgrelid::regclass::text as tbl, pg_get_triggerdef(oid) as def
  from pg_trigger
  where not tgisinternal
    and tgrelid::regclass::text like 'knowledge_%'
  order by tbl, tgname;
`, 'all-kb-related-triggers')

// 6. RLS state + policies
await q(`
  select relname, relrowsecurity, relforcerowsecurity
  from pg_class
  where relname in ('knowledge_services','knowledge_faqs','knowledge_guardrails')
    and relnamespace = 'public'::regnamespace
  order by relname;
`, 'rls-state')
