import Link from "next/link"
import type { Metadata } from "next"
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CalendarCheck2,
  Clock,
  Globe2,
  Inbox,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { LeadStatusBadge } from "@/components/dashboard/lead-status-badge"
import { LiveVisitorCounter } from "@/components/dashboard/live-visitor-counter"
import { PageHeader } from "@/components/dashboard/page-header"
import { StatCard } from "@/components/dashboard/stat-card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getDashboardKpis } from "@/lib/db/analytics"
import {
  getOverviewAiPerformance,
  getOverviewDailyCounts,
  getOverviewFunnel,
  getOverviewLeadsByService,
  getOverviewRecentActivity,
  getOverviewRecentLeads,
  getOverviewTopReferrers,
} from "@/lib/db/overview"
import { cn, formatRelativeTime } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Overview | AivaSpa Dashboard",
  description: "A real-time look at your leads, conversations, and AI performance.",
}

export default async function DashboardOverviewPage() {
  let user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null = null
  try {
    const supabase = await createClient()
    const result = await supabase.auth.getUser()
    user = result.data.user
  } catch (e) {
    console.error("[dashboard-overview] auth getUser failed:", e)
  }

  // Defense in depth: if onboarding is not completed, show a friendly
  // "finish setup" state instead of the full dashboard. This should
  // rarely be reached because proxy.ts and layout.tsx already guard
  // against this, but it prevents crashes if those guards are bypassed.
  const onboardingCompleted =
    (user?.user_metadata as Record<string, unknown> | null | undefined)
      ?.onboarding_completed === true
  if (!onboardingCompleted) {
    return (
      <>
        <DashboardHeader title="Overview" />
        <div className="mx-auto flex min-h-[60vh] w-full max-w-7xl flex-col items-center justify-center px-5 text-center lg:px-8">
          <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-8 max-w-md">
            <Sparkles className="mx-auto size-8 text-[#5E6AD2]" />
            <h2 className="mt-4 text-lg font-semibold text-[#F7F8F8]">
              Finish setup to activate your dashboard
            </h2>
            <p className="mt-2 text-sm text-[#8A8F98]">
              Complete your spa profile so AivaSpa can answer clients correctly and capture leads.
            </p>
            <Button
              asChild
              className="mt-6 bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
            >
              <Link href="/onboarding">
                Continue setup
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </>
    )
  }

  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "there"
  const firstName = fullName.split(/\s+/)[0] || "there"

  const kpis = await getDashboardKpis().catch(() => ({
    totalLeads: 0,
    newLeadsToday: 0,
    leadsThisWeek: 0,
    leadsThisMonth: 0,
    booked: 0,
    afterHoursCount: 0,
    afterHoursRate: 0,
    conversionRate: 0,
  }))

  const dailyCounts = await getOverviewDailyCounts(14).catch(() => [])
  const leadsByService = await getOverviewLeadsByService().catch(() => [])
  const recentLeads = await getOverviewRecentLeads(5).catch(() => [])
  const funnel = await getOverviewFunnel().catch(() => ({
    visitors: 0,
    newLeads: 0,
    contacted: 0,
    booked: 0,
    lost: 0,
  }))
  const topReferrers = await getOverviewTopReferrers(5).catch(() => [])
  const aiPerf = await getOverviewAiPerformance().catch(() => ({
    totalSessions: 0,
    activeSessions: 0,
    capturedSessions: 0,
    abandonedSessions: 0,
    leadCaptureRate: 0,
    consentRate: 0,
    avgMessagesPerSession: 0,
  }))
  const recentActivity = await getOverviewRecentActivity(6).catch(() => [])

  const sparkSeries = dailyCounts.map((d) => d.value)
  const totalInRange = sparkSeries.reduce((s, v) => s + v, 0)
  const peakDay = dailyCounts.reduce(
    (best, d) => (d.value > best.value ? d : best),
    dailyCounts[0] ?? { day: "—", value: 0 },
  )
  const visitorToBookedRate =
    funnel.visitors > 0 ? Math.round((funnel.booked / funnel.visitors) * 100) : 0

  return (
    <>
      <DashboardHeader
        title="Overview"
        actions={
          <Button asChild size="sm" className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90">
            <Link href="/dashboard/leads">
              <Inbox className="size-4" />
              View leads
            </Link>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
        <PageHeader
          title={`Welcome back, ${firstName}`}
          description={
            kpis.totalLeads > 0
              ? `You have ${kpis.totalLeads} lead${kpis.totalLeads === 1 ? "" : "s"} on the books and ${kpis.newLeadsToday} came in today.`
              : "Your dashboard is ready. Real lead, conversation, and AI performance data will appear here as it comes in."
          }
        >
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/analytics">
              <Activity className="size-4" />
              View analytics
            </Link>
          </Button>
          <Button asChild size="sm" className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90">
            <Link href="/dashboard/widget">
              <Sparkles className="size-4" />
              Customize widget
            </Link>
          </Button>
        </PageHeader>

        <LiveVisitorCounter
          initialActiveSessions={aiPerf.activeSessions}
          initialLeadsThisWeek={kpis.leadsThisWeek}
          leadsToday={kpis.newLeadsToday}
          className="mt-6"
        />

        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="New leads (7d)"
            value={String(kpis.leadsThisWeek)}
            accentColor="#E2E54B"
            icon={<Inbox className="size-4" />}
            series={sparkSeries}
            helper={kpis.leadsThisWeek > 0 ? `${kpis.newLeadsToday} new today` : "No lead data yet"}
          />
          <StatCard
            label="Booked consultations"
            value={String(kpis.booked)}
            accentColor="#4CB782"
            icon={<CalendarCheck2 className="size-4" />}
            helper={
              kpis.booked > 0
                ? `${kpis.conversionRate}% of all leads`
                : "No bookings yet"
            }
          />
          <StatCard
            label="Active chat sessions"
            value={String(aiPerf.activeSessions)}
            accentColor="#5E6AD2"
            icon={<Clock className="size-4" />}
            helper={
              aiPerf.totalSessions > 0
                ? `${aiPerf.totalSessions} total · ${aiPerf.leadCaptureRate}% captured`
                : "No response data yet"
            }
          />
          <StatCard
            label="After-hours capture"
            value={`${kpis.afterHoursRate}%`}
            accentColor="#22D3EE"
            icon={<Bot className="size-4" />}
            helper={
              kpis.afterHoursCount > 0
                ? `${kpis.afterHoursCount} of ${kpis.totalLeads} leads came in after 6 PM`
                : "No after-hours leads yet"
            }
          />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5 lg:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#F7F8F8]">Leads over time</h2>
                <p className="mt-0.5 text-xs text-[#8A8F98]">
                  Last 14 days · {kpis.totalLeads} total
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-[#8A8F98]">
                  <span className="size-2 rounded-full bg-[#1A1B1E]" /> Past
                </span>
                <span className="flex items-center gap-1.5 text-[#F7F8F8]">
                  <span className="size-2 rounded-full bg-[#E2E54B]" /> Today
                </span>
              </div>
            </div>
            <DailyBarChart
              data={dailyCounts}
              totalInRange={totalInRange}
              peakDay={peakDay}
            />
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-[#23252A] pt-4 text-center">
              <div>
                <p className="text-lg font-semibold text-[#F7F8F8]">{kpis.newLeadsToday}</p>
                <p className="text-[10px] uppercase tracking-wider text-[#62666D]">Today</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-[#F7F8F8]">{kpis.leadsThisWeek}</p>
                <p className="text-[10px] uppercase tracking-wider text-[#62666D]">This week</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-[#F7F8F8]">{kpis.leadsThisMonth}</p>
                <p className="text-[10px] uppercase tracking-wider text-[#62666D]">This month</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#F7F8F8]">By service</h2>
                <p className="mt-0.5 text-xs text-[#8A8F98]">Where interest is highest</p>
              </div>
            </div>
            {leadsByService.length > 0 ? (
              <ServiceBreakdown rows={leadsByService} />
            ) : (
              <div className="mt-4 flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-[#23252A] bg-[#1A1B1E]/40 text-center">
                <div>
                  <p className="text-sm font-semibold text-[#F7F8F8]">No service data yet</p>
                  <p className="mt-1 text-xs text-[#8A8F98]">
                    Service interest will appear after leads are captured.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-[#23252A] bg-[#121316] lg:col-span-3">
            <div className="flex items-center justify-between border-b border-[#23252A] p-5">
              <div>
                <h2 className="text-base font-semibold text-[#F7F8F8]">Newest leads</h2>
                <p className="mt-0.5 text-xs text-[#8A8F98]">
                  {recentLeads.length > 0
                    ? `${kpis.newLeadsToday} new today · ${kpis.totalLeads} total`
                    : "From the last 24 hours"}
                </p>
              </div>
              <Link
                href="/dashboard/leads"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#E2E54B] hover:underline"
              >
                All leads <ArrowRight className="size-3" />
              </Link>
            </div>
            {recentLeads.length > 0 ? (
              <ul className="divide-y divide-[#23252A]">
                {recentLeads.map((lead) => (
                  <li key={lead.id}>
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition hover:bg-[#1A1B1E]"
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[#08090A]"
                        style={{
                          background: `linear-gradient(135deg, ${
                            lead.service === "Botox"
                              ? "#E2E54B"
                              : lead.service === "Dermal Fillers" ||
                                  lead.service === "Fillers"
                                ? "#5E6AD2"
                                : lead.service === "Laser Hair Removal" ||
                                    lead.service === "Laser"
                                  ? "#22D3EE"
                                  : lead.service === "HydraFacial" ||
                                      lead.service === "Signature Facial" ||
                                      lead.service === "Facials"
                                    ? "#34D399"
                                    : lead.service === "Microneedling"
                                      ? "#FF77E9"
                                      : "#8A8F98"
                          }, #1A1B1E)`,
                        }}
                      >
                        {lead.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-[#F7F8F8]">
                            {lead.name}
                          </p>
                          <LeadStatusBadge status={lead.status} />
                          {lead.afterHours ? (
                            <span className="rounded-md border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#22D3EE]">
                              After hrs
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-[#8A8F98]">
                          {lead.service} · {lead.preferredTime}
                        </p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="text-xs text-[#F7F8F8]">
                          {formatRelativeTime(lead.createdAt)}
                        </p>
                        <p className="text-[10px] text-[#62666D]">via {lead.source}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex min-h-[220px] items-center justify-center p-5 text-center">
                <div>
                  <p className="text-sm font-semibold text-[#F7F8F8]">No leads yet</p>
                  <p className="mt-1 max-w-sm text-xs text-[#8A8F98]">
                    New leads will show here after real visitors submit their information through the chat widget.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#23252A] bg-[#121316] lg:col-span-2">
            <div className="border-b border-[#23252A] p-5">
              <h2 className="text-base font-semibold text-[#F7F8F8]">Conversion funnel</h2>
              <p className="mt-0.5 text-xs text-[#8A8F98]">All time</p>
            </div>
            <div className="p-5">
              {funnel.visitors + funnel.newLeads + funnel.booked > 0 ? (
                <FunnelChart
                  visitors={funnel.visitors}
                  newLeads={funnel.newLeads}
                  contacted={funnel.contacted}
                  booked={funnel.booked}
                  lost={funnel.lost}
                />
              ) : (
                <div className="flex min-h-[190px] items-center justify-center rounded-xl border border-dashed border-[#23252A] bg-[#1A1B1E]/40 text-center">
                  <div>
                    <p className="text-sm font-semibold text-[#F7F8F8]">No funnel data yet</p>
                    <p className="mt-1 text-xs text-[#8A8F98]">
                      Conversion metrics will appear once visitor activity is tracked.
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-5 flex items-center gap-2 rounded-lg border border-[#4CB782]/30 bg-[#4CB782]/5 p-3 text-xs">
                <Target className="size-4 shrink-0 text-[#4CB782]" />
                <p className="text-[#8A8F98]">
                  Visitor → booked rate:{" "}
                  <span className="font-semibold text-[#4CB782]">
                    {visitorToBookedRate}%
                  </span>
                  {funnel.booked > 0 ? ` (${funnel.booked} of ${funnel.visitors})` : "."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#F7F8F8]">AI performance</h2>
              <Bot className="size-4 text-[#5E6AD2]" />
            </div>
            <ul className="mt-4 space-y-3">
              <AiRow
                label="Lead capture rate"
                value={`${aiPerf.leadCaptureRate}%`}
                sub={
                  aiPerf.totalSessions > 0
                    ? `${aiPerf.capturedSessions} of ${aiPerf.totalSessions} sessions`
                    : "No sessions yet"
                }
              />
              <AiRow
                label="Consent given"
                value={`${aiPerf.consentRate}%`}
                sub={
                  aiPerf.totalSessions > 0
                    ? `${aiPerf.capturedSessions} consented`
                    : "No sessions yet"
                }
              />
              <AiRow
                label="Avg. messages per chat"
                value={aiPerf.avgMessagesPerSession > 0 ? String(aiPerf.avgMessagesPerSession) : "—"}
                sub={
                  aiPerf.totalSessions > 0
                    ? `Across ${aiPerf.totalSessions} sessions`
                    : "No data yet"
                }
              />
              <AiRow
                label="Active sessions"
                value={String(aiPerf.activeSessions)}
                sub={
                  aiPerf.abandonedSessions > 0
                    ? `${aiPerf.abandonedSessions} abandoned`
                    : "All caught up"
                }
              />
            </ul>
          </div>

          <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#F7F8F8]">Top referrers</h2>
              <TrendingUp className="size-4 text-[#4CB782]" />
            </div>
            {topReferrers.length > 0 ? (
              <ul className="mt-4 space-y-2.5">
                {topReferrers.map((r) => {
                  const max = topReferrers[0]?.count || 1
                  const pct = Math.round((r.count / max) * 100)
                  return (
                    <li key={r.host} className="text-xs">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 truncate text-[#F7F8F8]">
                          <Globe2 className="size-3 shrink-0 text-[#62666D]" />
                          <span className="truncate">{r.host}</span>
                        </span>
                        <span className="font-mono text-[#8A8F98]">{r.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#1A1B1E]">
                        <div
                          className="h-full rounded-full bg-[#4CB782]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="mt-4 flex min-h-[156px] items-center justify-center rounded-xl border border-dashed border-[#23252A] bg-[#1A1B1E]/40 text-center">
                <div>
                  <p className="text-sm font-semibold text-[#F7F8F8]">No referrer data yet</p>
                  <p className="mt-1 text-xs text-[#8A8F98]">
                    Traffic sources will appear after visits are tracked.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#F7F8F8]">Recent activity</h2>
              <Activity className="size-4 text-[#22D3EE]" />
            </div>
            {recentActivity.length > 0 ? (
              <ul className="mt-4 space-y-2.5">
                {recentActivity.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-start gap-2.5 rounded-lg border border-[#23252A] bg-[#0B0C0E] p-2.5"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
                        entry.kind === "lead"
                          ? "bg-[#E2E54B]/15 text-[#E2E54B]"
                          : "bg-[#5E6AD2]/15 text-[#8B95E0]",
                      )}
                    >
                      {entry.kind === "lead" ? "L" : "A"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-xs text-[#F7F8F8]">
                        <span className="font-semibold">{entry.userName}</span>{" "}
                        <span className="text-[#8A8F98]">{entry.action}</span>
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#62666D]">
                        {formatRelativeTime(entry.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 flex min-h-[156px] items-center justify-center rounded-xl border border-dashed border-[#23252A] bg-[#1A1B1E]/40 text-center">
                <div>
                  <p className="text-sm font-semibold text-[#F7F8F8]">No recent activity</p>
                  <p className="mt-1 text-xs text-[#8A8F98]">
                    Activity will appear here as your team and visitors use the system.
                  </p>
                </div>
              </div>
            )}
            <Link
              href="/dashboard/analytics"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#E2E54B] hover:underline"
            >
              Full activity <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}

type OverviewCount = { day: string; value: number; isToday?: boolean; iso?: string }

function DailyBarChart({
  data,
  totalInRange,
  peakDay,
}: {
  data: OverviewCount[]
  totalInRange: number
  peakDay: { day: string; value: number }
}) {
  if (data.length === 0) {
    return (
      <div className="mt-5 flex h-[200px] items-center justify-center rounded-xl border border-dashed border-[#23252A] bg-[#1A1B1E]/40 text-center">
        <div>
          <p className="text-sm font-semibold text-[#F7F8F8]">No lead data yet</p>
          <p className="mt-1 text-xs text-[#8A8F98]">
            Leads over time will appear once visitors start chatting.
          </p>
        </div>
      </div>
    )
  }
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="mt-5">
      <div className="flex h-[180px] items-end gap-1.5">
        {data.map((d) => {
          const heightPct = (d.value / max) * 100
          return (
            <div
              key={d.iso ?? d.day}
              className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
            >
              <span className="text-[10px] font-mono text-[#62666D] opacity-0 transition group-hover:opacity-100">
                {d.value}
              </span>
              <div
                className={cn(
                  "w-full rounded-md transition-all",
                  d.isToday
                    ? "bg-[#E2E54B]"
                    : d.value > 0
                      ? "bg-[#1A1B1E] group-hover:bg-[#2A2C32]"
                      : "bg-[#1A1B1E]/50",
                )}
                style={{ height: `${Math.max(4, heightPct)}%` }}
                title={`${d.day}: ${d.value} lead${d.value === 1 ? "" : "s"}`}
              />
              <span
                className={cn(
                  "text-[9px] font-semibold uppercase tracking-wider",
                  d.isToday ? "text-[#E2E54B]" : "text-[#62666D]",
                )}
              >
                {d.day}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-[#62666D]">
        <span>
          {totalInRange} lead{totalInRange === 1 ? "" : "s"} in this window
        </span>
        {peakDay.value > 0 ? (
          <span>
            Peak: <span className="text-[#F7F8F8]">{peakDay.day}</span> ·{" "}
            <span className="font-mono text-[#E2E54B]">{peakDay.value}</span>
          </span>
        ) : null}
      </div>
    </div>
  )
}

function ServiceBreakdown({
  rows,
}: {
  rows: { name: string; value: number; color: string }[]
}) {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1
  return (
    <div className="mt-4 space-y-3">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#1A1B1E]">
        {rows.map((r) => (
          <div
            key={r.name}
            className="h-full"
            style={{
              width: `${(r.value / total) * 100}%`,
              backgroundColor: r.color,
            }}
            title={`${r.name}: ${r.value}`}
          />
        ))}
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.name}
            className="flex items-center justify-between text-xs"
          >
            <span className="flex items-center gap-2 text-[#F7F8F8]">
              <span
                className="size-2 rounded-sm"
                style={{ backgroundColor: r.color }}
              />
              {r.name}
            </span>
            <span className="font-mono text-[#8A8F98]">
              {r.value}
              <span className="ml-1.5 text-[10px] text-[#62666D]">
                ({Math.round((r.value / total) * 100)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FunnelChart({
  visitors,
  newLeads,
  contacted,
  booked,
  lost,
}: {
  visitors: number
  newLeads: number
  contacted: number
  booked: number
  lost: number
}) {
  const stages: { label: string; value: number; color: string }[] = [
    { label: "Visitors", value: visitors, color: "#5E6AD2" },
    { label: "New leads", value: newLeads, color: "#E2E54B" },
    { label: "Contacted", value: contacted, color: "#22D3EE" },
    { label: "Booked", value: booked, color: "#4CB782" },
    { label: "Lost", value: lost, color: "#EB5757" },
  ]
  const max = Math.max(...stages.map((s) => s.value), 1)
  return (
    <ul className="space-y-2.5">
      {stages.map((s) => {
        const pct = (s.value / max) * 100
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-[#F7F8F8]">{s.label}</span>
              <span className="font-mono text-[#8A8F98]">{s.value}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#1A1B1E]">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, pct)}%`, backgroundColor: s.color }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function AiRow({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <li className="flex items-center justify-between border-b border-[#23252A] pb-2.5 last:border-b-0 last:pb-0">
      <div>
        <p className="text-xs text-[#F7F8F8]">{label}</p>
        <p className="text-[10px] text-[#62666D]">{sub}</p>
      </div>
      <p className="text-sm font-mono font-semibold text-[#E2E54B]">{value}</p>
    </li>
  )
}
