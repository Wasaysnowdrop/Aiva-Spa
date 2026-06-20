#!/usr/bin/env node
// Bootstrap an admin user (create if missing, then grant is_admin).
// Usage:
//   node scripts/create-admin.mjs <email> <password>
// Or via env:
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/create-admin.mjs
import { createClient } from "@supabase/supabase-js"

const email = process.argv[2] || process.env.ADMIN_EMAIL
const password = process.argv[3] || process.env.ADMIN_PASSWORD
if (!email || !password) {
  console.error("Usage: node scripts/create-admin.mjs <email> <password>")
  console.error("   or: ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/create-admin.mjs")
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your env (.env.local).")
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
if (listErr) {
  console.error("listUsers failed:", listErr.message)
  process.exit(1)
}

let user = list?.users?.find((u) => u.email === email)
if (!user) {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { is_admin: true },
  })
  if (createErr) {
    console.error("createUser failed:", createErr.message)
    process.exit(1)
  }
  user = created.user
  console.log(`Created user ${email} (${user.id}) with is_admin=true.`)
} else {
  const merged = { ...(user.app_metadata ?? {}), is_admin: true }
  const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
    password,
    app_metadata: merged,
  })
  if (updateErr) {
    console.error("updateUserById failed:", updateErr.message)
    process.exit(1)
  }
  console.log(`User ${email} existed; password reset + is_admin granted (${user.id}).`)
}

console.log("Done. Sign in at /login?redirectTo=/admin — Supabase may require a fresh login so the new app_metadata JWT is issued.")
