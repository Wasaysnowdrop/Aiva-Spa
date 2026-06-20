import { AdminTopBar } from "@/components/admin/admin-shell"
import { getRecentLeads } from "@/lib/admin/queries"

import { LeadsTable, type LeadRow } from "./leads-table"

export const dynamic = "force-dynamic"

export default async function AdminLeadsPage() {
  const leads = (await getRecentLeads(500)) as unknown as LeadRow[]

  return (
    <>
      <AdminTopBar
        title="Leads"
        subtitle={`${leads.length} most recent leads across the platform`}
      />
      <div className="p-5">
        <LeadsTable rows={leads} pageSize={50} empty="No leads captured yet." />
      </div>
    </>
  )
}
