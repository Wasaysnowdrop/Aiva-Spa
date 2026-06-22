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

async function testInsert() {
  // First get a user
  const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: users } = await adminClient.auth.admin.listUsers()
  if (!users.users.length) {
    console.log("No users found.")
    return
  }
  const user = users.users[0]
  console.log("Testing with user:", user.id, user.email)

  // Wait, we need an access token for the user!
  // I will use a custom PostgREST request with the SUPABASE_SERVICE_ROLE_KEY but spoofing the user context
  // BUT the easiest way is to use Mgmt API? No, Mgmt API uses service role.
  // Let's create a client with the anon key and global.headers = { Authorization: "Bearer ..." }
  // We don't have the user's JWT. 
  // Let's execute SQL using the Mgmt API to test the policy logic directly!

  const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`
  
  const sql = `
    set local role authenticated;
    set local "request.jwt.claim.sub" = '${user.id}';
    
    insert into public.knowledge_services (name, category, user_id) 
    values ('Test Service', 'Facials', '${user.id}')
    returning *;
  `
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: sql }),
  })
  
  const text = await res.text()
  console.log("Insert result:", res.status, text.slice(0, 500))
}

testInsert()
