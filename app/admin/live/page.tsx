import { AdminTopBar } from "@/components/admin/admin-shell"
import { LiveFeed } from "@/components/admin/live-feed"
import { LiveTicker } from "@/components/admin/live-ticker"

export const dynamic = "force-dynamic"

export default function AdminLivePage() {
  return (
    <>
      <AdminTopBar
        title="Live event feed"
        subtitle="Real-time stream of every captured lead, chat update, webhook delivery, and notification"
        right={<LiveTicker />}
      />
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-5">
          <h2 className="text-sm font-semibold text-[#F7F8F8]">About this stream</h2>
          <ul className="mt-4 space-y-1.5 text-xs text-[#8A8F98]">
            <li>· Pause freezes the visible list but keeps counting new events.</li>
            <li>· Clear empties the visible list (counter resets to 0).</li>
            <li>· Page navigation preserves state in memory only.</li>
          </ul>
        </div>
        <LiveFeed maxHeight={680} />
      </div>
    </>
  )
}
