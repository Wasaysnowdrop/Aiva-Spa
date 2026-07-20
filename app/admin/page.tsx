import Link from "next/link"
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Clock3, ExternalLink, Minus, Server } from "lucide-react"
import { AdminPageBody, AdminPageHeader } from "@/components/admin/page-header"
import { getAdminOverview, type OperationalStatus } from "@/lib/admin/control-centre"

export const dynamic = "force-dynamic"

const statusStyle: Record<OperationalStatus, string> = {
  operational: "border-[#24523A] bg-[#10261A] text-[#65D69A]",
  degraded: "border-[#5A4A20] bg-[#261F0E] text-[#E7C65C]",
  outage: "border-[#633032] bg-[#2A1416] text-[#F1797D]",
  unknown: "border-[#353A42] bg-[#17191D] text-[#A0A6AF]",
  not_configured: "border-[#353A42] bg-[#17191D] text-[#767D87]",
}

function delta(value: number | null, previous: number | null) {
  if (value == null || previous == null) return null
  if (value === previous) return { value: 0, up: false }
  if (previous === 0) return { value: 100, up: value > 0 }
  const change = ((value - previous) / previous) * 100
  return { value: Math.abs(change), up: change > 0 }
}

export default async function AdminOverviewPage() {
  const snapshot = await getAdminOverview()
  const overall = snapshot.health.some((item) => item.status === "outage") ? "outage" : snapshot.health.some((item) => item.status === "degraded") ? "degraded" : "operational"
  return <>
    <AdminPageHeader title="Admin overview" description="Platform health, customer activity, delivery, AI, and incidents in one operational view." generatedAt={snapshot.generatedAt} autoRefreshSeconds={60} />
    <AdminPageBody>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#242830] bg-[#0E1013] px-4 py-3">
        <div className="flex items-center gap-3"><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusStyle[overall]}`}><span className="size-1.5 rounded-full bg-current" />{overall}</span><span className="text-xs text-[#7D848E]">Production · {snapshot.totalUsers} registered users</span></div>
        <Link href="/admin/incidents" className="inline-flex items-center gap-1.5 text-xs font-medium text-[#D9DC43] hover:text-[#EEF05B]">Review incidents <ExternalLink className="size-3" /></Link>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {snapshot.metrics.map((metric) => {
          const change = delta(metric.value, metric.previous)
          return <article key={metric.key} className="rounded-xl border border-[#242830] bg-[#0E1013] p-4">
            <div className="flex items-start justify-between gap-3"><p className="text-xs font-medium text-[#9299A3]">{metric.label}</p>{change ? <span className={`inline-flex items-center gap-1 text-[11px] ${change.up ? "text-[#62C98F]" : change.value === 0 ? "text-[#747B85]" : "text-[#F0797D]"}`}>{change.value === 0 ? <Minus className="size-3" /> : change.up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{change.value.toFixed(0)}%</span> : null}</div>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[#F5F6F7]">{metric.value == null ? "—" : metric.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}{metric.suffix}</p>
            <p className="mt-3 text-[11px] leading-relaxed text-[#69717B]">{metric.explanation}</p>
            <p className="mt-2 text-[10px] text-[#4F5660]">Source: {metric.source} · {new Date(snapshot.generatedAt).toLocaleTimeString()}</p>
          </article>
        })}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2"><Server className="size-4 text-[#DDE047]" /><h2 className="text-sm font-semibold text-[#E9EBED]">Platform health</h2></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.health.map((item) => <article key={item.key} className="rounded-xl border border-[#242830] bg-[#0E1013] p-4">
            <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium text-[#E4E6E8]">{item.service}</h3><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusStyle[item.status]}`}>{item.status.replaceAll("_", " ")}</span></div>
            <p className="mt-2 text-xs text-[#7F8791]">{item.message}</p>
            <div className="mt-3 flex items-center justify-between text-[10px] text-[#59616B]"><span>{item.latencyMs == null ? "No latency sample" : `${item.latencyMs} ms`}</span><span>{new Date(item.lastCheckedAt).toLocaleTimeString()}</span></div>
          </article>)}
        </div>
      </section>

      <section className="rounded-xl border border-[#242830] bg-[#0E1013]">
        <div className="flex items-center justify-between border-b border-[#242830] px-4 py-3"><div><h2 className="text-sm font-semibold text-[#ECEDEF]">Recent platform activity</h2><p className="mt-0.5 text-xs text-[#707781]">Important persisted events, newest first.</p></div><Link href="/admin/live" className="text-xs text-[#DDE047]">Open live activity</Link></div>
        {snapshot.events.length ? <ul className="divide-y divide-[#20242A]">{snapshot.events.map((event) => <li key={event.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className={`flex size-8 items-center justify-center rounded-lg ${event.status === "error" ? "bg-[#2A1517] text-[#F1787C]" : "bg-[#16231B] text-[#61CC91]"}`}>{event.status === "error" ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[#DFE2E5]">{event.title}</p><p className="mt-0.5 truncate text-xs text-[#727A84]">{event.detail}</p></div>
          <span className="inline-flex items-center gap-1 text-[11px] text-[#626A74]"><Clock3 className="size-3" />{new Date(event.occurredAt).toLocaleString()}</span>
          {event.href ? <Link href={event.href} aria-label={`Open ${event.title}`} className="text-[#858C96] hover:text-white"><ExternalLink className="size-3.5" /></Link> : null}
        </li>)}</ul> : <div className="px-5 py-10 text-center"><CheckCircle2 className="mx-auto size-7 text-[#4D9F71]" /><p className="mt-3 text-sm text-[#C7CBD0]">No important platform activity yet</p><p className="mt-1 text-xs text-[#676F79]">New leads, bookings, subscription changes, email failures, and admin actions will appear here.</p></div>}
      </section>
    </AdminPageBody>
  </>
}