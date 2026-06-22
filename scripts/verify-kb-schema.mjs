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
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0]
const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`

async function query(sql) {
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

const checks = await Promise.all([
  query(`
    select column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = 'public' and table_name = 'knowledge_services'
    order by ordinal_position;
  `),
  query(`
    select indexname, indexdef
    from pg_indexes
    where schemaname = 'public' and tablename = 'knowledge_services';
  `),
  query(`
    select policyname, cmd, roles::text, qual, with_check
    from pg_policies
    where schemaname = 'public' and tablename = 'knowledge_services';
  `),
  query(`
    select tgname, tgrelid::regclass::text as tbl
    from pg_trigger
    where tgrelid = 'public.knowledge_services'::regclass
      and not tgisinternal;
  `),
  query(`
    select relname, relrowsecurity, relforcerowsecurity
    from pg_class
    where relname = 'knowledge_services' and relnamespace = 'public'::regnamespace;
  `),
  query(`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public' and table_name = 'knowledge_services'
      and column_name = 'category';
  `),
  query(`
    select conname, pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.knowledge_services'::regclass;
  `),
])

for (let i = 0; i < checks.length; i++) {
  const { status, body } = checks[i]
  console.log(`\n--- Query ${i + 1} (status ${status}) ---`)
  console.log(body.slice(0, 3000))
}