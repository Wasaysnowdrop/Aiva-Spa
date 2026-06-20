import { AdminTopBar } from "@/components/admin/admin-shell"
import { createAdminClient } from "@/lib/supabase/admin"

import { AuditTable, type AuditRow } from "./audit-table"

export const dynamic = "force-dynamic"

async function getAuditLogs(): Promise<AuditRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("audit_logs")
    .select("id, user_name, action, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(500)
  return (data ?? []) as AuditRow[]
}

export default async function AdminAuditPage() {
  const rows = await getAuditLogs()

  return (
    <>
      <AdminTopBar
        title="Audit log"
        subtitle={`${rows.length} most recent system events`}
      />
      <div className="p-5">
        <AuditTable rows={rows} pageSize={50} empty="No audit events yet." />
      </div>
    </>
  )
}
