"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarRange, Download, Info, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { normalizeAnalyticsResponse } from "@/lib/analytics/normalize"
import type { AnalyticsLoadError, AnalyticsPayload, AnalyticsRangeKey, AnalyticsSummary, AnalyticsTrend } from "@/lib/analytics/types"
import { cn } from "@/lib/utils"

const RANGE_OPTIONS: { value: AnalyticsRangeKey; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last 12 months" },
]

type SummaryKey = keyof Omit<AnalyticsSummary, "notificationDeliveryRate">

const KPI_META: { key: SummaryKey; title: string; helper: string; tooltip: string; format: "number" | "rate" | "seconds"; invert?: boolean }[] = [
  { key: "visitorConversations", title: "Visitor conversations", helper: "Eligible website chats", tooltip: "Production website-widget conversations with at least one real visitor message. Preview, onboarding, internal and deleted sessions are excluded.", format: "number" },
  { key: "qualifiedLeads", title: "Qualified leads", helper: "Chats that created active leads", tooltip: "Unique eligible visitor conversations that captured a lead which has not been deleted.", format: "number" },
  { key: "bookedLeads", title: "Booked consultations", helper: "Qualified leads marked booked", tooltip: "Qualified leads whose current status is Booked.", format: "number" },
  { key: "visitorToLeadRate", title: "Visitor-to-lead", helper: "Qualified leads ÷ conversations", tooltip: "Qualified visitor conversations that created a lead divided by eligible visitor conversations.", format: "rate" },
  { key: "leadToBookingRate", title: "Lead-to-booking", helper: "Booked ÷ qualified leads", tooltip: "Booked leads divided by qualified leads for the selected period.", format: "rate" },
  { key: "averageResponseSeconds", title: "First response time", helper: "Average visitor-to-AI reply", tooltip: "Average time between the first visitor message and the first assistant response. Unanswered chats are excluded.", format: "seconds", invert: true },
]

function displayMetric(value: number | null, format: "number" | "rate" | "seconds") {
  if (value === null) return "—"
  if (format === "rate") return `${value}%`
  if (format === "seconds") return value < 60 ? `${value}s` : `${Math.floor(value / 60)}m ${value % 60}s`
  return value.toLocaleString()
}

function downloadAnalytics(payload: AnalyticsPayload) {
  const rows: (string | number | null)[][] = [
    ["AivaSpa analytics export"], ["Start", payload.range.start], ["End", payload.range.end], ["Timezone", payload.range.timezone], [],
    ["Metric", "Value"], ...KPI_META.map((item) => [item.title, payload.summary[item.key]]),
    [], ["Period", "Visitor conversations", "Qualified leads", "Booked consultations"],
    ...payload.timeline.map((row) => [row.label, row.conversations, row.leads, row.bookings]),
    [], ["Service", "Leads", "Share"], ...payload.services.map((row) => [row.name, row.count, `${row.percentage}%`]),
    [], ["Referrer", "Conversations", "Leads", "Conversion rate"],
    ...payload.referrers.map((row) => [row.domain, row.conversations, row.leads, row.conversionRate === null ? "" : `${row.conversionRate}%`]),
  ]
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `aivaspa-analytics-${payload.range.key}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

function Trend({ trend, invert = false, visible }: { trend: AnalyticsTrend; invert?: boolean; visible: boolean }) {
  if (!visible) return <span className="text-[11px] text-[#62666D]">Comparison off</span>
  const positive = trend.direction !== "neutral" && (invert ? trend.direction === "down" : trend.direction === "up")
  const negative = trend.direction !== "neutral" && !positive
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1 text-[11px] font-medium", positive ? "text-[#4CB782]" : negative ? "text-[#EB5757]" : "text-[#8A8F98]")}>
      {trend.direction === "up" ? <ArrowUpRight className="size-3 shrink-0" /> : trend.direction === "down" ? <ArrowDownRight className="size-3 shrink-0" /> : null}
      <span className="truncate">{trend.label}</span>
    </span>
  )
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-44 items-center justify-center rounded-xl border border-dashed border-[#2A2C31] bg-[#0B0C0E] px-5 text-center text-xs leading-5 text-[#8A8F98]">{children}</div>
}

function Card({ title, description, children, className }: { title: string; description: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-[#23252A] bg-[#121316] p-5", className)}>
      <div className="min-w-0"><h2 className="text-sm font-semibold text-[#F7F8F8]">{title}</h2><p className="mt-1 text-xs leading-5 text-[#8A8F98]">{description}</p></div>
      <div className="mt-5 min-w-0">{children}</div>
    </section>
  )
}

function TimelineChart({ data }: { data: AnalyticsPayload["timeline"] }) {
  if (!data.length || !data.some((row) => row.conversations || row.leads || row.bookings)) return <EmptyCard>No visitor conversation data for this period.</EmptyCard>
  const max = Math.max(1, ...data.flatMap((row) => [row.conversations, row.leads, row.bookings]))
  return (
    <div>
      <div className="flex flex-wrap gap-4 text-[11px] text-[#8A8F98]">
        {[["#8B95E0", "Conversations"], ["#E2E54B", "Leads"], ["#4CB782", "Bookings"]].map(([color, label]) => <span key={label} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ backgroundColor: color }} />{label}</span>)}
      </div>
      <div className="mt-4 flex h-56 min-w-0 items-end gap-1.5 overflow-hidden border-b border-[#2A2C31] pb-7">
        {data.map((row) => (
          <div key={row.key} className="relative flex h-full min-w-0 flex-1 items-end justify-center gap-px" title={`${row.label}: ${row.conversations} conversations, ${row.leads} leads, ${row.bookings} bookings`}>
            <span className="w-1/4 min-w-1 rounded-t bg-[#8B95E0]" style={{ height: `${Math.max(row.conversations ? 4 : 0, (row.conversations / max) * 100)}%` }} />
            <span className="w-1/4 min-w-1 rounded-t bg-[#E2E54B]" style={{ height: `${Math.max(row.leads ? 4 : 0, (row.leads / max) * 100)}%` }} />
            <span className="w-1/4 min-w-1 rounded-t bg-[#4CB782]" style={{ height: `${Math.max(row.bookings ? 4 : 0, (row.bookings / max) * 100)}%` }} />
            <span className="absolute -bottom-6 left-1/2 max-w-16 -translate-x-1/2 truncate text-[9px] text-[#62666D]">{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AnalyticsDashboard({
  payload: rawPayload,
  loadError = null,
}: {
  payload: unknown
  loadError?: AnalyticsLoadError | null
}) {
  const router = useRouter()
  const [compare, setCompare] = React.useState(true)
  const [pending, startTransition] = React.useTransition()
  const normalization = React.useMemo(() => normalizeAnalyticsResponse(rawPayload), [rawPayload])
  const payload = normalization.data
  const displayError = loadError ?? (normalization.success ? null : { stage: "render" as const })

  React.useEffect(() => {
    if (!normalization.success) {
      console.error("ANALYTICS_COMPONENT_RENDER_FAILED", {
        component: "AnalyticsDashboard",
        stage: "payload_normalization",
        issueCount: normalization.issues.length,
        issues: process.env.NODE_ENV === "production" ? undefined : normalization.issues,
      })
    }
  }, [normalization])

  const changeRange = (value: string) => startTransition(() => router.replace("/dashboard/analytics?range=" + value))
  const retry = () => startTransition(() => router.refresh())

  return (
    <div className={cn("space-y-5", pending && "opacity-70")} aria-busy={pending}>
      <div className="flex flex-col gap-3 rounded-2xl border border-[#23252A] bg-[#121316] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={payload.range.key} onValueChange={changeRange} disabled={pending}>
            <SelectTrigger className="w-full sm:w-44"><CalendarRange className="size-4" /><SelectValue /></SelectTrigger>
            <SelectContent>{RANGE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[#C9CCD2]"><input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} className="size-4 accent-[#E2E54B]" />Compare with previous period</label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] text-[#62666D]">{payload.range.grouping} · {payload.range.timezone}</span>
          <Button variant="outline" size="sm" onClick={() => downloadAnalytics(payload)}><Download className="size-4" />Export CSV</Button>
        </div>
      </div>

      {displayError ? (
        <div role="alert" className="flex flex-col gap-4 rounded-2xl border border-[#EB5757]/30 bg-[#EB5757]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#EB5757]/30 bg-[#EB5757]/10 text-[#EB5757]">
              <AlertTriangle className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#F7F8F8]">We couldn’t load analytics right now.</p>
              <p className="mt-1 text-xs leading-5 text-[#8A8F98]">The Analytics layout is still available. Try the query again in a moment.</p>
              {process.env.NODE_ENV !== "production" ? (
                <p className="mt-2 break-words font-mono text-[10px] text-[#EB8A8A]">
                  Stage: {displayError.stage}
                  {displayError.queryName ? <> · Query: {displayError.queryName}</> : null}
                  {displayError.code ? <> · Code: {displayError.code}</> : null}
                  {displayError.message ? <> · {displayError.message}</> : null}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" size="sm" onClick={retry} disabled={pending}>
              <RotateCw className="size-4" />
              Try again
            </Button>
            <Button asChild type="button" size="sm" variant="outline">
              <Link href="/dashboard">Return to dashboard</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {payload.summary.visitorConversations === 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E54B]/30 bg-[#E2E54B]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-[#F7F8F8]">Your analytics workspace is ready</p><p className="mt-1 text-xs text-[#C9CCD2]">Install your widget and start receiving visitor conversations to populate these insights.</p></div>
          <Button asChild size="sm" variant="outline"><Link href="/dashboard/guide">Open Install Guide</Link></Button>
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {KPI_META.map((item) => (
          <article key={item.key} className="min-w-0 rounded-2xl border border-[#23252A] bg-[#121316] p-4">
            <div className="flex min-w-0 items-center justify-between gap-2"><p className="truncate text-xs font-semibold text-[#C9CCD2]">{item.title}</p><Info className="size-3.5 shrink-0 text-[#62666D]" aria-label={item.tooltip}><title>{item.tooltip}</title></Info></div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-[#F7F8F8]">{displayMetric(payload.summary[item.key], item.format)}</p>
            <p className="mt-1 min-h-8 text-[11px] leading-4 text-[#62666D]">{item.helper}</p>
            <div className="mt-3 border-t border-[#23252A] pt-3"><Trend trend={payload.trends[item.key]} invert={item.invert} visible={compare} /></div>
          </article>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Leads and bookings over time" description={`${payload.range.grouping[0].toUpperCase() + payload.range.grouping.slice(1)} totals in the business timezone.`} className="xl:col-span-2"><TimelineChart data={payload.timeline} /></Card>
        <Card title="Response performance" description="First AI reply and email delivery quality.">
          {payload.summary.averageResponseSeconds === null && payload.summary.notificationDeliveryRate === null ? <EmptyCard>Response performance appears after visitors receive replies and lead emails are attempted.</EmptyCard> : (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#23252A] bg-[#0B0C0E] p-4"><p className="text-[11px] text-[#8A8F98]">Average first response</p><p className="mt-1 text-3xl font-semibold text-[#F7F8F8]">{displayMetric(payload.summary.averageResponseSeconds, "seconds")}</p></div>
              <div className="rounded-xl border border-[#23252A] bg-[#0B0C0E] p-4"><p className="text-[11px] text-[#8A8F98]">Email notification delivery</p><p className="mt-1 text-2xl font-semibold text-[#F7F8F8]">{displayMetric(payload.summary.notificationDeliveryRate, "rate")}</p><p className="mt-1 text-[10px] text-[#62666D]">Delivered email attempts ÷ all email attempts. SMS is excluded.</p></div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Conversion funnel" description="How eligible visitor conversations move toward a booking.">
          {payload.funnel[0]?.count ? <ol className="space-y-3">{payload.funnel.map((row, index) => <li key={row.stage} className="rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-[#F7F8F8]">{index + 1}. {row.stage}</span><span className="font-mono text-xs text-[#C9CCD2]">{row.count.toLocaleString()} · {row.percentage === null ? "—" : `${row.percentage}%`}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1A1B1E]"><div className="h-full rounded-full bg-[#E2E54B]" style={{ width: `${row.percentage ?? 0}%` }} /></div></li>)}</ol> : <EmptyCard>No lead data for this period.</EmptyCard>}
        </Card>
        <Card title="Leads by service" description="Treatments selected by qualified leads.">
          {payload.services.length ? <ul className="space-y-3">{payload.services.map((row) => <li key={row.name}><div className="flex min-w-0 items-center justify-between gap-3 text-xs"><span className="truncate font-medium text-[#F7F8F8]">{row.name}</span><span className="shrink-0 font-mono text-[#8A8F98]">{row.count} · {row.percentage}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1A1B1E]"><div className="h-full rounded-full bg-[#8B95E0]" style={{ width: `${row.percentage}%` }} /></div></li>)}</ul> : <EmptyCard>Service performance appears after leads select a treatment.</EmptyCard>}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card title="Visitor activity by hour" description={`Eligible conversations in ${payload.range.timezone}.`} className="xl:col-span-5">
          {payload.hours.some((row) => row.conversations) ? <div className="grid grid-cols-12 gap-1.5 2xl:grid-cols-24">{payload.hours.map((row) => { const max = Math.max(...payload.hours.map((item) => item.conversations), 1); const strength = row.conversations / max; return <div key={row.hour} title={`${row.label}: ${row.conversations} conversations`} className="min-w-0"><div className="flex h-20 items-end rounded-md bg-[#0B0C0E] p-1"><span className="w-full rounded-sm bg-[#22D3EE]" style={{ height: `${Math.max(row.conversations ? 8 : 2, strength * 100)}%`, opacity: row.conversations ? 0.35 + strength * 0.65 : 0.08 }} /></div><p className="mt-1 text-center text-[8px] text-[#62666D]">{row.hour % 3 === 0 ? row.hour : ""}</p></div> })}</div> : <EmptyCard>Visitor activity will appear after your widget receives conversations.</EmptyCard>}
        </Card>
        <Card title="Top referrers" description="Ranked traffic sources and their lead conversion." className="xl:col-span-4">
          {payload.referrers.length ? <div className="overflow-x-auto"><table className="w-full min-w-[360px] text-left text-xs"><thead className="text-[10px] uppercase tracking-wider text-[#62666D]"><tr><th className="pb-3 font-medium">Source</th><th className="pb-3 text-right font-medium">Chats</th><th className="pb-3 text-right font-medium">Leads</th><th className="pb-3 text-right font-medium">Conv.</th></tr></thead><tbody className="divide-y divide-[#23252A]">{payload.referrers.map((row, index) => <tr key={row.domain}><td className="max-w-44 py-3 pr-3"><span className="mr-2 text-[#62666D]">{index + 1}</span><span className="break-all font-medium text-[#F7F8F8]">{row.domain}</span></td><td className="py-3 text-right text-[#C9CCD2]">{row.conversations}</td><td className="py-3 text-right text-[#C9CCD2]">{row.leads}</td><td className="py-3 text-right text-[#8A8F98]">{row.conversionRate === null ? "—" : `${row.conversionRate}%`}</td></tr>)}</tbody></table></div> : <EmptyCard>Referrer performance appears after visitors arrive from public pages.</EmptyCard>}
        </Card>
        <Card title="Lead status" description="Current status of qualified leads in this period." className="xl:col-span-3">
          {payload.statuses.some((row) => row.count) ? <ul className="space-y-3">{payload.statuses.map((row) => <li key={row.status} className="flex items-center justify-between rounded-xl border border-[#23252A] bg-[#0B0C0E] px-3 py-2.5"><span className="capitalize text-xs font-medium text-[#F7F8F8]">{row.status}</span><span className="font-mono text-xs text-[#8A8F98]">{row.count} · {row.percentage}%</span></li>)}</ul> : <EmptyCard>Lead status distribution will appear after leads are captured.</EmptyCard>}
        </Card>
      </div>
    </div>
  )
}
