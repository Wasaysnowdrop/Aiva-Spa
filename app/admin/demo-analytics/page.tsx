import Link from "next/link"

import { AdminPageBody, AdminPageHeader } from "@/components/admin/page-header"
import { getDemoAnalytics } from "@/lib/demo/admin"

export const dynamic = "force-dynamic"

const ranges = [1, 7, 30]

export default async function AdminDemoAnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const query = await searchParams
  const days = ranges.includes(Number(query.range)) ? Number(query.range) : 30
  const analytics = await getDemoAnalytics(days)
  const cards = [
    ["Sessions started", analytics.metrics.sessionsStarted.toLocaleString(), "Public demo sessions only"],
    ["Completed", analytics.metrics.sessionsCompleted.toLocaleString(), `${analytics.metrics.completionRate.toFixed(1)}% completion rate`],
    ["Average duration", `${Math.round(analytics.metrics.averageDurationSeconds)} sec`, "Start to last activity"],
    ["Messages / session", analytics.metrics.averageMessages.toFixed(1), `${analytics.metrics.aiRequests} flexible AI requests`],
    ["Lead step reached", analytics.metrics.leadCaptureReached.toLocaleString(), "Isolated test leads"],
    ["Sales leads", analytics.metrics.salesLeads.toLocaleString(), `${analytics.metrics.salesConversionRate.toFixed(1)}% visitor-to-sales conversion`],
    ["CTA clicks", (analytics.metrics.walkthroughClicks + analytics.metrics.signupClicks).toLocaleString(), `${analytics.metrics.walkthroughClicks} walkthrough / ${analytics.metrics.signupClicks} signup`],
    ["Demo AI cost", `$${analytics.metrics.estimatedAiCostUsd.toFixed(4)}`, `${analytics.metrics.outputTokens.toLocaleString()} output tokens`],
    ["Abuse blocks", analytics.metrics.abuseBlocks.toLocaleString(), "Repeated unsafe requests"],
  ]
  return <><AdminPageHeader title="Demo analytics" description="Public interactive-demo engagement, conversion, cost, and abuse. Excluded from customer usage." generatedAt={analytics.generatedAt} autoRefreshSeconds={60} /><AdminPageBody>
    <div className="flex gap-2">{ranges.map((range) => <Link key={range} href={`/admin/demo-analytics?range=${range}`} className={`rounded-lg border px-3 py-2 text-xs ${days === range ? "border-[#DDE047] bg-[#252713] text-[#E8EA52]" : "border-[#2B3038] text-[#8B929C]"}`}>{range === 1 ? "Today" : `${range} days`}</Link>)}</div>
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, hint]) => <article key={label} className="rounded-xl border border-[#242830] bg-[#0E1013] p-4"><p className="text-xs text-[#8C939D]">{label}</p><p className="mt-3 text-2xl font-semibold text-[#F3F4F5]">{value}</p><p className="mt-2 text-[11px] text-[#646C76]">{hint}</p></article>)}</section>
    <section className="grid gap-4 lg:grid-cols-2"><Distribution title="Scenario selected" rows={analytics.scenarioCounts} /><Distribution title="Abandonment step" rows={analytics.abandonment} /></section>
    <section className="overflow-hidden rounded-xl border border-[#242830] bg-[#0E1013]"><div className="border-b border-[#242830] px-4 py-3"><h2 className="text-sm font-semibold text-[#E8EAEC]">Recent demo sessions</h2><p className="mt-1 text-xs text-[#6C747E]">Opaque IDs only. No visitor messages or contact details are shown here.</p></div><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-left text-[10px] uppercase tracking-wide text-[#5F6771]"><tr><th className="px-4 py-3">Started</th><th>Scenario</th><th>Status</th><th>Step</th><th>Messages</th><th>Completion</th><th className="pr-4">Conversion</th></tr></thead><tbody className="divide-y divide-[#22262D]">{analytics.recentSessions.map((row) => <tr key={row.id}><td className="px-4 py-3 text-[#7D858F]">{new Date(row.startedAt).toLocaleString()}</td><td className="text-[#C9CDD2]">{row.scenario}</td><td className="capitalize text-[#9AA1AA]">{row.status}</td><td>{row.step}</td><td>{row.messages}</td><td>{row.completion}%</td><td className="pr-4">{row.salesLeadCreated ? "Sales lead" : row.leadCreated ? "Test lead" : "-"}</td></tr>)}</tbody></table></div></section>
  </AdminPageBody></>
}

function Distribution({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  const max = Math.max(1, ...rows.map((row) => row[1]))
  return <article className="rounded-xl border border-[#242830] bg-[#0E1013] p-4"><h2 className="text-sm font-semibold text-[#E8EAEC]">{title}</h2><div className="mt-4 space-y-3">{rows.length ? rows.map(([label, count]) => <div key={label}><div className="mb-1.5 flex justify-between text-xs"><span className="capitalize text-[#9299A2]">{label.replaceAll("-", " ")}</span><span className="text-[#D5D8DC]">{count}</span></div><div className="h-2 rounded-full bg-[#1C2026]"><div className="h-full rounded-full bg-[#DDE047]" style={{ width: `${count / max * 100}%` }} /></div></div>) : <p className="text-xs text-[#68717B]">No data in this range.</p>}</div></article>
}

