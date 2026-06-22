import { readFileSync } from "node:fs"
import { resolve } from "node:path"

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
const ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN

async function queryMgmtApi(sql) {
  const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0]
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: sql }),
  })
  return res.text()
}

async function run() {
  console.log("Fetching policies...")
  const res1 = await queryMgmtApi(`
    SELECT policyname, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename = 'knowledge_services';
  `)
  console.log(res1)

  console.log("Fetching triggers...")
  const res2 = await queryMgmtApi(`
    SELECT trigger_name, event_manipulation, action_statement 
    FROM information_schema.triggers 
    WHERE event_object_table = 'knowledge_services';
  `)
  console.log(res2)
}

run()
