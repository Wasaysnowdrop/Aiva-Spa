import { AdminTopBar } from "@/components/admin/admin-shell"
import { KpiCard } from "@/components/admin/kpi-card"
import { LatencyHistogram } from "@/components/admin/latency-histogram"
import { Sparkline } from "@/components/admin/sparkline"
import { getSystemHealth } from "@/lib/admin/queries"

export const dynamic = "force-dynamic"

export default async function AdminLlmPage() {
  const health = await getSystemHealth()
  const totalMessages = health.trends.llmLatencyMs.reduce((a, b) => a + b, 0)
  const totalTokens = health.trends.tokenUsage.reduce((a, b) => a + b, 0)
  // Cost estimate: $0.15 per 1M input, $0.60 per 1M output (gpt-4o-mini rates, rough)
  const estimatedCost = (totalTokens / 1_000_000) * 0.4

  return (
    <>
      <AdminTopBar
        title="LLM stats"
        subtitle="Per-conversation activity, message intervals, and cost estimates"
      />
      <div className="space-y-5 p-5">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label="Messages · 60m"
            value={totalMessages}
            trend={health.trends.llmLatencyMs}
            tone="default"
          />
          <KpiCard
            label="Tokens · 60m"
            value={totalTokens}
            trend={health.trends.tokenUsage}
            tone="warn"
          />
          <KpiCard
            label="Est. cost · 60m"
            value={`$${estimatedCost.toFixed(4)}`}
            tone="default"
          />
          <KpiCard
            label="Provider"
            value={health.naraConfigured ? "Nara" : "Mock"}
            tone={health.naraConfigured ? "success" : "warn"}
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-5">
            <h2 className="text-sm font-semibold text-[#F7F8F8]">Message activity · 60m</h2>
            <p className="mt-1 text-[10px] text-[#62666D]">
              Each bucket = a 5-second bucket of (updated_at − last_message_at).
              Bar height = number of chats whose delta fell in that bucket.
            </p>
            <div className="mt-4">
              <LatencyHistogram data={health.trends.llmLatencyMs} width={520} height={140} />
            </div>
          </div>
          <div className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-5">
            <h2 className="text-sm font-semibold text-[#F7F8F8]">Token estimate · 60m</h2>
            <p className="mt-1 text-[10px] text-[#62666D]">
              Estimated at 250 tokens per message — same series as the
              histogram scaled, not a measured value.
            </p>
            <div className="mt-4">
              <Sparkline
                data={health.trends.tokenUsage}
                width={520}
                height={140}
                stroke="#F2C94C"
                fill="rgba(242, 201, 76, 0.12)"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-5">
          <h2 className="text-sm font-semibold text-[#F7F8F8]">Notes</h2>
          <ul className="mt-2 space-y-1.5 text-xs text-[#8A8F98]">
            <li>· Stats derive from <code className="font-mono text-[#E2E54B]">chat_sessions.last_message_at</code> and <code className="font-mono text-[#E2E54B]">updated_at</code> deltas.</li>
            <li>· Add a <code className="font-mono text-[#E2E54B]">llm_usage</code> table to record exact prompt/completion tokens per turn for accurate billing.</li>
            <li>· Set <code className="font-mono text-[#E2E54B]">NARA_API_KEY</code> in <code className="font-mono text-[#E2E54B]">.env.local</code> to enable Nara Router with Mistral Medium 3.5. Missing = canned-response engine.</li>
          </ul>
        </section>
      </div>
    </>
  )
}
