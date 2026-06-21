import { AdminTopBar } from "@/components/admin/admin-shell"
import { createAdminClient } from "@/lib/supabase/admin"

import { AuditTable, type AuditRow } from "./audit-table"

export const dynamic = "force-dynamic"

type AdminAuditRow = {
  id: string
  actor_user_id: string | null
  actor_email: string | null
  action: string
  detail: Record<string, unknown> | null
  created_at: string
}

async function getAdminAuditLogs(): Promise<AdminAuditRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("admin_audit_log")
    .select("id, actor_user_id, actor_email, action, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(500)
  return (data ?? []) as AdminAuditRow[]
}

async function getCustomerAuditLogs(): Promise<AuditRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("audit_logs")
    .select("id, user_name, action, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(500)
  return (data ?? []) as AuditRow[]
}

export default async function AdminAuditPage() {
  const [adminLogs, customerLogs] = await Promise.all([
    getAdminAuditLogs().catch(() => [] as AdminAuditRow[]),
    getCustomerAuditLogs().catch(() => [] as AuditRow[]),
  ])

  return (
    <>
      <AdminTopBar
        title="Audit log"
        subtitle={`${adminLogs.length} admin actions · ${customerLogs.length} workspace events`}
      />
      <div className="space-y-6 p-5">
        <section>
          <h2 className="mb-2 text-sm font-medium text-[#A0A6AC]">Admin actions</h2>
          <AdminAuditTable rows={adminLogs} pageSize={25} empty="No admin actions yet." />
        </section>
        <section>
          <h2 className="mb-2 text-sm font-medium text-[#A0A6AC]">Workspace events</h2>
          <AuditTable rows={customerLogs} pageSize={50} empty="No workspace events yet." />
        </section>
      </div>
    </>
  )
}

function AdminAuditTable({
  rows,
  pageSize,
  empty,
}: {
  rows: AdminAuditRow[]
  pageSize: number
  empty: string
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-[#1B1F25] bg-[#0F1115] px-4 py-6 text-center text-sm text-[#5A626C]">
        {empty}
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-md border border-[#1B1F25]">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#0F1115] text-xs uppercase tracking-wide text-[#5A626C]">
          <tr>
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Actor</th>
            <th className="px-3 py-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1B1F25]">
          {rows.slice(0, pageSize).map((r) => (
            <tr key={r.id} className="text-[#D5DAE0]">
              <td className="px-3 py-2 text-xs text-[#7A828C]">
                {new Date(r.created_at).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-xs">
                {r.actor_email ?? r.actor_user_id ?? "—"}
              </td>
              <td className="px-3 py-2">{r.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
