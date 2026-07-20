import { AdminPageBody, AdminPageHeader } from "@/components/admin/page-header"
import { IncidentsPanel } from "@/components/admin/incidents-panel"
import { getIncidents } from "@/lib/admin/control-centre"

export const dynamic = "force-dynamic"

export default async function AdminIncidentsPage() {
  const rows = await getIncidents()
  const open = rows.filter((row) => row.status !== "resolved").length
  return <><AdminPageHeader title="Incidents" description={`${open} open · thresholded and deduplicated operational issues.`} generatedAt={new Date().toISOString()} autoRefreshSeconds={60} /><AdminPageBody><IncidentsPanel rows={rows} /></AdminPageBody></>
}
