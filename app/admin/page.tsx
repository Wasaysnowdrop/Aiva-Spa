import {
  Activity,
  Bot,
  Database,
  Gauge,
  KeyRound,
  ListChecks,
  Mail,
  MessageSquare,
  ShieldCheck,
  Users,
  Webhook,
} from "lucide-react"

import { getSystemHealth } from "@/lib/admin/queries"
import { KpiCard } from "@/components/admin/kpi-card"
import { LiveFeed } from "@/components/admin/live-feed"
import { LiveTicker } from "@/components/admin/live-ticker"
import { StatusPill } from "@/components/admin/status-pill"
import { AdminTopBar } from "@/components/admin/admin-shell"
import { Sparkline } from "@/components/admin/sparkline"
import { LatencyHistogram } from "@/components/admin/latency-histogram"
import { ErrorRateChart } from "@/components/admin/error-rate-chart"

export const dynamic = "force-dynamic"

function pctDelta(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0
  return ((curr - prev) / prev) * 100
}

function lastValue(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr[arr.length - 1] ?? 0
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0)
}

function max(arr: number[]): number {
  return arr.reduce((a, b) => Math.max(a, b), 0)
}

export default async function AdminOverviewPage() {
  const health = await getSystemHealth()
  const lastHourLeads = health.trends.leads.slice(-1)[0] ?? 0
  const prevHourLeads = health.trends.leads.slice(-2, -1)[0] ?? 0
  const leadsDelta = pctDelta(lastHourLeads, prevHourLeads)
  const activeVisitors = lastValue(health.trends.activeVisitors)
  const maxVisitors = max(health.trends.activeVisitors)
  const maxLatency = max(health.trends.llmLatencyMs)
  const totalTokens = sum(health.trends.tokenUsage)
  const errorRate = lastValue(health.trends.errorRate)

  const integrations = [
    { key: "cloudflare", label: "Cloudflare AI", ok: health.cloudflareConfigured },
    { key: "resend", label: "Resend email", ok: health.resendConfigured },
    { key: "twilio", label: "Twilio SMS", ok: health.twilioConfigured },
    { key: "calendar", label: "Custom Calendar", ok: health.customCalendarConfigured },
  ]

  return (
    <>
      <AdminTopBar
        title="Overview"
        subtitle={`Last refresh ${new Date(health.lastUpdated).toLocaleTimeString()} · uptime ${Math.floor(health.uptimeSeconds / 60)}m`}
        right={
          <>
            <StatusPill
              status={health.status === "ok" ? "ok" : "warn"}
              label={`System ${health.status}`}
            />
            <LiveTicker />
          </>
        }
      />
      <div className="space-y-5 p-5">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label="Active visitors"
            value={activeVisitors}
            hint={`Peak ${maxVisitors} (15m)`}
            trend={health.trends.activeVisitors}
            tone="default"
            icon={<Activity className="size-3.5" />}
          />
          <KpiCard
            label="Leads · last hour"
            value={lastHourLeads}
            delta={leadsDelta}
            trend={health.trends.leads.slice(-12)}
            tone="success"
            icon={<ListChecks className="size-3.5" />}
          />
          <KpiCard
            label="LLM tokens · 60m"
            value={totalTokens}
            trend={health.trends.tokenUsage}
            tone="warn"
            icon={<Bot className="size-3.5" />}
          />
          <KpiCard
            label="Webhook fail rate"
            value={`${errorRate.toFixed(1)}%`}
            tone={errorRate > 5 ? "danger" : errorRate > 1 ? "warn" : "default"}
            trend={health.trends.errorRate}
            icon={<Webhook className="size-3.5" />}
          />
          <KpiCard
            label="Total leads"
            value={health.totals.leads}
            hint="All time"
            tone="default"
            icon={<Mail className="size-3.5" />}
          />
          <KpiCard
            label="Total users"
            value={health.totals.users}
            hint="Signed up"
            tone="default"
            icon={<Users className="size-3.5" />}
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="size-4 text-[#5E6AD2]" />
                <h2 className="text-sm font-semibold text-[#F7F8F8]">Health</h2>
              </div>
            </div>
            <ul className="mt-3 space-y-2 text-xs">
              <li className="flex items-center justify-between">
                <span className="text-[#8A8F98]">Database</span>
                <StatusPill
                  status={
                    health.database === "ok"
                      ? "ok"
                      : health.database === "degraded"
                        ? "warn"
                        : "error"
                  }
                  label={health.database}
                />
              </li>
              <li className="flex items-center justify-between">
                <span className="text-[#8A8F98]">Realtime</span>
                <StatusPill
                  status={health.database === "ok" ? "ok" : "warn"}
                  label={health.database === "ok" ? "ok" : "degraded"}
                />
              </li>
              <li className="flex items-center justify-between">
                <span className="text-[#8A8F98]">LLM provider</span>
                <StatusPill
                  status={health.llm === "ok" ? "ok" : "warn"}
                  label={health.llm === "ok" ? "live" : "mock"}
                />
              </li>
            </ul>
            <div className="mt-4 border-t border-[#1A1B1E] pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#62666D]">
                Integrations
              </p>
              <ul className="mt-2 space-y-1.5 text-xs">
                {integrations.map((i) => (
                  <li key={i.key} className="flex items-center justify-between">
                    <span className="text-[#8A8F98]">{i.label}</span>
                    <StatusPill
                      status={i.ok ? "ok" : "muted"}
                      label={i.ok ? "configured" : "missing"}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="size-4 text-[#E2E54B]" />
                <h2 className="text-sm font-semibold text-[#F7F8F8]">Row counts</h2>
              </div>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {Object.entries(health.totals).map(([key, value]) => (
                <li
                  key={key}
                  className="flex items-center justify-between rounded-md border border-[#1A1B1E] bg-[#0B0C0E] px-2 py-1.5"
                >
                  <span className="text-[10px] text-[#8A8F98]">{key}</span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-[#F7F8F8]">
                    {value}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[10px] text-[#62666D]">
              Snapshot via SELECT count(*) · refreshes on every page load
            </p>
          </div>

          <div className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="size-4 text-[#22D3EE]" />
                <h2 className="text-sm font-semibold text-[#F7F8F8]">LLM · 60m</h2>
              </div>
              <span className="text-[10px] text-[#62666D]">
                Peak {maxLatency} messages
              </span>
            </div>
            <div className="mt-3">
              <LatencyHistogram data={health.trends.llmLatencyMs} />
            </div>
            <div className="mt-3 border-t border-[#1A1B1E] pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#62666D]">
                Webhook errors (5m buckets)
              </p>
              <div className="mt-2">
                <ErrorRateChart data={health.trends.errorRate} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks className="size-4 text-[#4CB782]" />
                <h2 className="text-sm font-semibold text-[#F7F8F8]">
                  Leads · last 24h (hourly)
                </h2>
              </div>
              <span className="text-[10px] text-[#62666D]">
                {sum(health.trends.leads)} total
              </span>
            </div>
            <div className="mt-3">
              <Sparkline
                data={health.trends.leads}
                width={800}
                height={120}
                stroke="#4CB782"
                fill="rgba(76, 183, 130, 0.12)"
              />
            </div>
            <p className="mt-2 text-[10px] text-[#62666D]">
              X axis = last 24h, rightmost = most recent hour
            </p>
          </div>
          <LiveFeed maxHeight={420} />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Chat sessions"
            value={health.totals.chatSessions}
            tone="default"
            icon={<MessageSquare className="size-3.5" />}
          />
          <KpiCard
            label="API keys"
            value={health.totals.apiKeys}
            tone="default"
            icon={<KeyRound className="size-3.5" />}
          />
          <KpiCard
            label="Webhooks"
            value={health.totals.webhooks}
            tone="default"
            icon={<Webhook className="size-3.5" />}
          />
          <KpiCard
            label="Subscriptions"
            value={health.totals.subscriptions}
            tone="default"
            icon={<ShieldCheck className="size-3.5" />}
          />
        </section>
      </div>
    </>
  )
}
