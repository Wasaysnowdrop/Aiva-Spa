import { AdminTopBar } from "@/components/admin/admin-shell"
import { createAdminClient } from "@/lib/supabase/admin"

import { ApiKeysTable, type ApiKeyRow } from "./api-keys-table"

export const dynamic = "force-dynamic"

async function getAllApiKeys(): Promise<ApiKeyRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("api_keys")
    .select("id, user_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at")
    .order("created_at", { ascending: false })
    .limit(500)
  return (data ?? []) as ApiKeyRow[]
}

export default async function AdminApiKeysPage() {
  const keys = await getAllApiKeys()

  return (
    <>
      <AdminTopBar
        title="API keys"
        subtitle={`${keys.length} total keys across all users`}
      />
      <div className="p-5">
        <ApiKeysTable rows={keys} pageSize={50} empty="No API keys yet." />
      </div>
    </>
  )
}
