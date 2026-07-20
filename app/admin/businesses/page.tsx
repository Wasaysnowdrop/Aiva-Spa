import { AdminPageBody, AdminPageHeader } from "@/components/admin/page-header"
import { BusinessesTable, type BusinessRow } from "@/components/admin/businesses-table"
import { getBusinesses } from "@/lib/admin/control-centre"

export const dynamic = "force-dynamic"
export default async function BusinessesPage() { const rows = await getBusinesses() as BusinessRow[]; return <><AdminPageHeader title="Businesses" description={`${rows.length} customer workspaces with subscription, widget, usage, and health context.`} generatedAt={new Date().toISOString()} /><AdminPageBody><BusinessesTable rows={rows} /></AdminPageBody></> }
