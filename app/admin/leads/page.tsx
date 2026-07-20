import { AdminPageBody, AdminPageHeader } from "@/components/admin/page-header"
import { AdminLeadsTable } from "@/components/admin/operations-tables"
import { getOperationsData } from "@/lib/admin/control-centre"
export const dynamic = "force-dynamic"
export default async function AdminLeadsPage() { const data=await getOperationsData(); return <><AdminPageHeader title="Leads" description="Platform investigation view with masked PII and business context." generatedAt={new Date().toISOString()} /><AdminPageBody><AdminLeadsTable rows={data.leads} /></AdminPageBody></> }