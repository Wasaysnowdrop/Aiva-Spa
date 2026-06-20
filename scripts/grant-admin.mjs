#!/usr/bin/env node
// Bootstrap a user as admin. Run with:
//   node scripts/grant-admin.mjs <email>
import { createClient } from "@supabase/supabase-js"

const email = process.argv[2]
if (!email) {
  console.error("Usage: node scripts/grant-admin.mjs <email>")
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.")
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
if (error) {
  console.error("listUsers failed:", error.message)
  process.exit(1)
}
const user = data?.users?.find((u) => u.email === email)
if (!user) {
  console.error(`No user found for ${email}`)
  process.exit(1)
}
const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
  app_metadata: { ...(user.app_metadata ?? {}), is_admin: true },
})
if (updateError) {
  console.error("updateUserById failed:", updateError.message)
  process.exit(1)
}
console.log(`Granted is_admin to ${email} (${user.id}). Have them sign out + back in for the new JWT to take effect.`)
