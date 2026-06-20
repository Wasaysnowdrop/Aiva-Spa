"use client"

import * as React from "react"
import { ArrowDownRight, ArrowUpRight, Download, Target } from "lucide-react"

import { BarChart } from "@/components/dashboard/bar-chart"
import { Sparkline } from "@/components/dashboard/sparkline"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Lead } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"
import { useRealtimeSubscription } from "@/lib/hooks/use-realtime"
import { mapLead } from "@/lib/supabase/types"
import type { DailyCount, ServiceEngagement } from "@/lib/supabase/types"

const ranges = [
  { v: "7d", label: "Last 7 days" },
  { v: "14d", label: "Last 14 days" },
  { v: "30d", label: "Last 30 days" },
  { v: "90d", label: "Last 90 days" },
]

const serviceColors = ["#E2E54B", "#5E6AD2", "#22D3EE", "#34D399", "#FF77E9", "#F59E0B", "#8A8F98"]

interface AnalyticsViewProps {
  leads: Lead[]
  timezone: string
}

function getRangeDays(range: string) {
  return Number.parseInt(range, 10) || 14
}

function formatPct(value: number) {
  return Number.isFinite(value) ? Math.round(value) : 0
}

function formatDay(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ---- Timezone-aware date helpers ------------------------------------------
// All daily/hourly buckets in the dashboard are computed in the spa's working
// hours timezone (not the viewer's browser tz) so a dashboard viewed from
// anywhere reports activity the way the spa experiences it.

function dayKeyInTz(iso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso))
  const y = parts.find((p) => p.type === "year")?.value ?? "0000"
  const m = parts.find((p) => p.type === "month")?.value ?? "01"
  const d = parts.find((p) => p.type === "day")?.value ?? "01"
  return `${y}-${m}-${d}`
}

function hourInTz(iso: string, tz: string): number {
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    hour12: false,
  }).format(new Date(iso))
  const h = Number.parseInt(hourStr, 10)
  return Number.isNaN(h) ? 0 : h
}

function shiftDayKeyInTz(tz: string, deltaDays: number): string {
  const now = new Date()
  const shifted = new Date(now.getTime() + deltaDays * 86_400_000)
  return dayKeyInTz(shifted.toISOString(), tz)
}

// Approximate the calendar date for a Y-M-D key in the spa tz so the chart
// labels use that day.
function dateFromDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map((n) => Number.parseInt(n, 10))
  return new Date(y, (m || 1) - 1, d || 1)
}

// Build the list of Y-M-D keys for the selected range, ending today (spa tz).
function dayKeysInRange(tz: string, days: number): string[] {
  const out: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    out.push(shiftDayKeyInTz(tz, -i))
  }
  return out
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date())
    return true
  } catch {
    return false
  }
}

// Median (robust) of a list of numbers.
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

export function AnalyticsView({
  leads: initialLeads,
  timezone,
}: AnalyticsViewProps) {
  const { data: leads } = useRealtimeSubscription<Lead>({
    table: "leads",
    initialData: initialLeads,
    mapRow: (row) => mapLead(row),
    getId: (item) => item.id,
  })

  const [range, setRange] = React.useState("14d")
  const safeTz = isValidTimezone(timezone) ? timezone : "America/Los_Angeles"

  const analytics = React.useMemo(() => {
    const days = getRangeDays(range)
    const keys = dayKeysInRange(safeTz, days)
    const firstKey = keys[0]
    const lastKey = keys[keys.length - 1]

    const inRange = leads.filter((lead) => {
      if (Number.isNaN(new Date(lead.createdAt).getTime())) return false
      const k = dayKeyInTz(lead.createdAt, safeTz)
      return k >= firstKey && k <= lastKey
    })

    const dailyCounts: DailyCount[] = keys.map((key) => {
      const count = inRange.filter(
        (lead) => dayKeyInTz(lead.createdAt, safeTz) === key,
      ).length
      const date = dateFromDayKey(key)
      return {
        day: days <= 14
          ? date.toLocaleDateString("en-US", { weekday: "short" })
          : formatDay(date),
        value: count,
        label: `${formatDay(date)}: ${count}`,
      }
    })

    // Prior period of equal length, ending the day before firstKey.
    const firstDate = dateFromDayKey(firstKey)
    const priorStart = new Date(firstDate.getTime() - days * 86_400_000)
    const priorEnd = new Date(firstDate.getTime() - 86_400_000)
    const priorStartKey = dayKeyInTz(priorStart.toISOString(), safeTz)
    const priorEndKey = dayKeyInTz(priorEnd.toISOString(), safeTz)
    const priorCount = leads.filter((lead) => {
      const k = dayKeyInTz(lead.createdAt, safeTz)
      return k >= priorStartKey && k <= priorEndKey
    }).length
    const periodChange =
      priorCount > 0
        ? ((inRange.length - priorCount) / priorCount) * 100
        : inRange.length > 0
          ? 100
          : 0

    const booked = inRange.filter((lead) => lead.status === "booked").length
    const afterHours = inRange.filter((lead) => lead.afterHours).length
    const converted = inRange.filter(
      (lead) => lead.consentGiven && lead.status !== "lost",
    ).length
    const total = inRange.length || 1

    // Average response time, derived from transcript messages: for each
    // visitor message, find the next AI message in the same lead and record
    // the gap in seconds. We use the median to stay robust against
    // overnight or multi-day conversations.
    const responseTimesSec: number[] = []
    for (const lead of inRange) {
      const tr = Array.isArray(lead.transcript) ? lead.transcript : []
      const sorted = [...tr].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      )
      for (let i = 0; i < sorted.length; i++) {
        const m = sorted[i]
        if (m.role !== "visitor") continue
        const visitorTs = new Date(m.timestamp).getTime()
        if (Number.isNaN(visitorTs)) continue
        for (let j = i + 1; j < sorted.length; j++) {
          const n = sorted[j]
          if (n.role === "ai") {
            const aiTs = new Date(n.timestamp).getTime()
            const diff = Math.round((aiTs - visitorTs) / 1000)
            if (diff > 0 && diff < 60 * 30) {
              responseTimesSec.push(diff)
            }
            break
          }
        }
      }
    }
    const avgResponseSec = median(responseTimesSec)

    const kpis = [
      { label: "Visitor → Lead", value: 12, current: formatPct((converted / total) * 100), format: "%" },
      { label: "Lead → Booked", value: 35, current: formatPct((booked / total) * 100), format: "%" },
      { label: "After-hours capture", value: 30, current: formatPct((afterHours / total) * 100), format: "%" },
      {
        label: "Avg. response time",
        value: 3,
        current: avgResponseSec,
        format: avgResponseSec > 0 ? "s" : "s",
        invert: true,
      },
      { label: "Answer accuracy", value: 95, current: 0, format: "%" },
      { label: "Notification delivery", value: 99, current: 0, format: "%" },
    ]

    const serviceMap = new Map<string, number>()
    inRange.forEach((lead) =>
      serviceMap.set(lead.service, (serviceMap.get(lead.service) ?? 0) + 1),
    )
    const leadsByService: ServiceEngagement[] = Array.from(
      serviceMap.entries(),
    ).map(([name, value], index) => ({
      name,
      value,
      color: serviceColors[index % serviceColors.length],
    }))

    // Bucket hours IN THE SPA'S TIMEZONE so the chart shows the spa's busy
    // hours, not the viewer's local hours.
    const hourlyCounts = Array.from({ length: 24 }, (_, hour) =>
      inRange.filter((lead) => hourInTz(lead.createdAt, safeTz) === hour).length,
    )

    return {
      dailyCounts,
      periodChange,
      kpis,
      leadsByService,
      hourlyCounts,
      totalLeads: inRange.length,
    }
  }, [leads, range, safeTz])

  const trendPositive = analytics.periodChange >= 0

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ranges.map((r) => (
                <SelectItem key={r.v} value={r.v}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            Compare to last period
          </Button>
        </div>
        <Button variant="outline" size="sm">
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5 lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#F7F8F8]">Leads over time</h2>
              <p className="mt-0.5 text-xs text-[#8A8F98]">
                Daily count of qualified leads · timezone {safeTz}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold",
                trendPositive
                  ? "border-[#4CB782]/30 bg-[#4CB782]/10 text-[#4CB782]"
                  : "border-[#EB5757]/30 bg-[#EB5757]/10 text-[#EB5757]",
              )}
            >
              {trendPositive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {trendPositive ? "+" : ""}{Math.round(analytics.periodChange)}% vs prior
            </span>
          </div>
          <div className="mt-5">
            <BarChart data={analytics.dailyCounts} height={220} showValues />
          </div>
        </div>
        <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
          <h2 className="text-base font-semibold text-[#F7F8F8]">Response time</h2>
          <p className="mt-0.5 text-xs text-[#8A8F98]">Lower is better · target &lt; 3s</p>
          <div className="mt-4">
            <Sparkline
              data={analytics.dailyCounts.map((d) => d.value)}
              width={260}
              height={80}
              stroke="#5E6AD2"
              fill="rgba(94, 106, 210, 0.15)"
            />
          </div>
          <p className="mt-3 text-3xl font-bold text-[#F7F8F8]">
            {analytics.kpis[3]?.current ?? 0}
            <span className="ml-1 text-base font-semibold text-[#8A8F98]">s</span>
          </p>
          <p className="text-[10px] text-[#62666D]">
            median visitor → first reply · {analytics.totalLeads} leads
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px]">
            <div className="rounded-lg border border-[#23252A] bg-[#0B0C0E] p-2">
              <p className="text-[#F7F8F8]">{analytics.dailyCounts[0]?.value ?? 0}</p>
              <p className="text-[#62666D]">first day</p>
            </div>
            <div className="rounded-lg border border-[#23252A] bg-[#0B0C0E] p-2">
              <p className="text-[#F7F8F8]">{analytics.dailyCounts[Math.floor(analytics.dailyCounts.length / 2)]?.value ?? 0}</p>
              <p className="text-[#62666D]">mid</p>
            </div>
            <div className="rounded-lg border border-[#5E6AD2]/30 bg-[#5E6AD2]/10 p-2">
              <p className="text-[#F7F8F8]">{analytics.dailyCounts.at(-1)?.value ?? 0}</p>
              <p className="text-[#62666D]">today</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#F7F8F8]">KPI vs. target</h2>
            <p className="mt-0.5 text-xs text-[#8A8F98]">PRD success metrics</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md border border-[#E2E54B]/30 bg-[#E2E54B]/10 px-2 py-0.5 text-[10px] font-semibold text-[#E2E54B]">
            <Target className="size-3" /> On track
          </span>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {analytics.kpis.map((kpi) => {
            const ratio = kpi.invert
              ? kpi.current > 0
                ? kpi.value / kpi.current
                : 0
              : kpi.current / Math.max(kpi.value, 1)
            const hasData = kpi.current > 0 || kpi.label === "Visitor → Lead" || kpi.label === "Lead → Booked" || kpi.label === "After-hours capture"
            const onTrack = hasData && ratio >= 1
            const pct = Math.min(100, Math.round(ratio * 100))
            return (
              <div
                key={kpi.label}
                className="rounded-xl border border-[#23252A] bg-[#0B0C0E] p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#F7F8F8]">{kpi.label}</p>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                      !hasData
                        ? "border-[#62666D]/30 bg-[#62666D]/10 text-[#62666D]"
                        : onTrack
                          ? "border-[#4CB782]/30 bg-[#4CB782]/10 text-[#4CB782]"
                          : "border-[#EB5757]/30 bg-[#EB5757]/10 text-[#EB5757]",
                    )}
                  >
                    {!hasData ? (
                      "No data"
                    ) : onTrack ? (
                      <>
                        <ArrowUpRight className="size-2.5" />
                        On target
                      </>
                    ) : (
                      <>
                        <ArrowDownRight className="size-2.5" />
                        Below
                      </>
                    )}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-[#F7F8F8]">
                    {kpi.current}
                    {kpi.format}
                  </p>
                  <p className="text-xs text-[#62666D]">
                    / target {kpi.value}
                    {kpi.format}
                  </p>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#1A1B1E]">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      !hasData
                        ? "bg-[#62666D]"
                        : onTrack
                          ? "bg-[#4CB782]"
                          : "bg-[#EB5757]",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
          <h2 className="text-base font-semibold text-[#F7F8F8]">By service</h2>
          <p className="mt-0.5 text-xs text-[#8A8F98]">Visitor interest by treatment</p>
          <ul className="mt-4 space-y-3">
            {analytics.leadsByService.length ? analytics.leadsByService.map((s) => {
              const total = analytics.leadsByService.reduce((a, b) => a + b.value, 0) || 1
              const pct = Math.round((s.value / total) * 100)
              return (
                <li key={s.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-[#F7F8F8]">
                      <span
                        className="size-2.5 rounded-sm"
                        style={{ backgroundColor: s.color }}
                        aria-hidden
                      />
                      {s.name}
                    </span>
                    <span className="font-mono text-[#8A8F98]">
                      {s.value} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#1A1B1E]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: s.color }}
                    />
                  </div>
                </li>
              )
            }) : (
              <li className="rounded-xl border border-dashed border-[#23252A] bg-[#0B0C0E] p-4 text-xs text-[#8A8F98]">
                No lead service data for this range.
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#F7F8F8]">By hour of day</h2>
              <p className="mt-0.5 text-xs text-[#8A8F98]">
                When visitors are most active · spa timezone {safeTz}
              </p>
            </div>
            <span
              className="shrink-0 rounded-md border border-[#23252A] bg-[#0B0C0E] px-2 py-0.5 font-mono text-[10px] text-[#8A8F98]"
              title="All hour buckets use the spa's working-hours timezone, not your browser timezone."
            >
              {safeTz}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-12 gap-1">
            {Array.from({ length: 24 }, (_, i) => {
              const v = analytics.hourlyCounts[i] ?? 0
              const max = Math.max(...analytics.hourlyCounts, 1)
              const h = Math.max(8, Math.round((v / max) * 100))
              return (
                <div
                  key={i}
                  className="flex aspect-square items-end overflow-hidden rounded-sm bg-[#1A1B1E]"
                  title={`${String(i).padStart(2, "0")}:00 — ${v} lead${v === 1 ? "" : "s"}`}
                >
                  <div
                    className="w-full bg-[#E2E54B]"
                    style={{ height: `${h}%`, opacity: 0.3 + (h / 100) * 0.7 }}
                  />
                </div>
              )
            })}
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-[#62666D]">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>12 AM</span>
          </div>
        </div>
      </section>
    </div>
  )
}
