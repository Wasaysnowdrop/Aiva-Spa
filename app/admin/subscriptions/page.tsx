import { AdminPageBody, AdminPageHeader } from "@/components/admin/page-header"
import { SubscriptionsTable } from "@/components/admin/subscriptions-table"
import { getSubscriptions } from "@/lib/admin/control-centre"

export const dynamic = "force-dynamic"
export default async function SubscriptionsPage() { const rows=await getSubscriptions(); return <><AdminPageHeader title="Subscriptions" description={`${rows.length} subscriptions with billing periods, entitlements, and usage.`} generatedAt={new Date().toISOString()} /><AdminPageBody><div className="rounded-xl border border-[#242830] bg-[#0E1013] px-4 py-3 text-xs text-[#78808A]">Subscription state is read from the canonical billing record. Admins cannot directly rewrite plan or status from this table.</div><SubscriptionsTable rows={rows} /></AdminPageBody></> }
