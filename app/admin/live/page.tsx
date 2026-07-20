import { AdminPageBody, AdminPageHeader } from "@/components/admin/page-header"
import { LiveFeed } from "@/components/admin/live-feed"

export const dynamic = "force-dynamic"

export default function AdminLivePage() {
  return <>
    <AdminPageHeader title="Live activity" description="Persisted operational history followed by deduplicated realtime updates." />
    <AdminPageBody>
      <div className="rounded-xl border border-[#242830] bg-[#0E1013] px-4 py-3 text-xs leading-relaxed text-[#7D858F]">Pause queues incoming events without losing them. Clear view only clears this browser list; it never deletes database history. Realtime reconnects automatically after an interruption.</div>
      <LiveFeed />
    </AdminPageBody>
  </>
}