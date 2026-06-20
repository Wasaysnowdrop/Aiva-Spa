import { AdminTopBar } from "@/components/admin/admin-shell"
import { LiveFeed } from "@/components/admin/live-feed"
import { LiveTicker } from "@/components/admin/live-ticker"
import { StatusPill } from "@/components/admin/status-pill"

export const dynamic = "force-dynamic"

export default function AdminLivePage() {
  return (
    <>
      <AdminTopBar
        title="Live event feed"
        subtitle="Real-time stream of every captured lead, chat update, webhook delivery, and notification"
        right={
          <>
            <StatusPill status="ok" label="Subscribed" />
            <LiveTicker />
          </>
        }
      />
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-5">
          <h2 className="text-sm font-semibold text-[#F7F8F8]">About this stream</h2>
          <p className="mt-2 text-xs leading-relaxed text-[#8A8F98]">
            Subscribed to Postgres logical replication via Supabase Realtime. Every row
            inserted or updated in <code className="font-mono text-[#E2E54B]">leads</code>,{" "}
            <code className="font-mono text-[#E2E54B]">chat_sessions</code>,{" "}
            <code className="font-mono text-[#E2E54B]">webhook_deliveries</code>,{" "}
            <code className="font-mono text-[#E2E54B]">notification_logs</code>, and{" "}
            <code className="font-mono text-[#E2E54B]">api_keys</code> shows up here
            within a second.
          </p>
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
