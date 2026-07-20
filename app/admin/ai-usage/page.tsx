import Link from "next/link"
import { AdminPageBody, AdminPageHeader } from "@/components/admin/page-header"
import { getAiUsage } from "@/lib/admin/control-centre"

export const dynamic = "force-dynamic"

const ranges = [{ label: "Today", value: 1 }, { label: "7 days", value: 7 }, { label: "30 days", value: 30 }]

export default async function AdminAiUsagePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const query = await searchParams
  const days = [1, 7, 30].includes(Number(query.range)) ? Number(query.range) : 1
  const usage = await getAiUsage(days)
  const cards = [
    ["Requests", usage.metrics.requests.toLocaleString(), "Provider, error, and fallback requests"],
    ["Prompt tokens", usage.metrics.promptTokens.toLocaleString(), "Recorded input tokens"],
    ["Completion tokens", usage.metrics.completionTokens.toLocaleString(), "Recorded output tokens"],
    ["Estimated cost", `$${usage.metrics.cost.toFixed(4)}`, `${usage.metrics.exactRate.toFixed(0)}% exact-token coverage`],
    ["Average latency", `${usage.metrics.averageLatency.toFixed(0)} ms`, "End-to-end provider latency"],
    ["Error rate", `${usage.metrics.errorRate.toFixed(1)}%`, "Requests recorded as errors"],
    ["Fallback rate", `${usage.metrics.fallbackRate.toFixed(1)}%`, "Canned or deterministic fallback"],
  ]
  const byPurpose = new Map<string, number>()
  for (const row of usage.rows) byPurpose.set(String(row.purpose), (byPurpose.get(String(row.purpose)) ?? 0) + 1)
  const maxPurpose = Math.max(1, ...byPurpose.values())
  return <><AdminPageHeader title="AI usage" description="Exact provider tokens where returned; estimates are explicitly separated." generatedAt={usage.generatedAt} autoRefreshSeconds={60} /><AdminPageBody>
    <div className="flex gap-2">{ranges.map((range) => <Link key={range.value} href={`/admin/ai-usage?range=${range.value}`} className={`rounded-lg border px-3 py-2 text-xs ${days === range.value ? "border-[#DDE047] bg-[#252713] text-[#E8EA52]" : "border-[#2B3038] text-[#8B929C]"}`}>{range.label}</Link>)}</div>
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, hint]) => <article key={label} className="rounded-xl border border-[#242830] bg-[#0E1013] p-4"><p className="text-xs text-[#8C939D]">{label}</p><p className="mt-3 text-2xl font-semibold text-[#F3F4F5]">{value}</p><p className="mt-2 text-[11px] text-[#646C76]">{hint}</p></article>)}</section>
    {usage.rows.length ? <section className="grid gap-4 xl:grid-cols-2"><div className="rounded-xl border border-[#242830] bg-[#0E1013] p-4"><h2 className="text-sm font-semibold text-[#E8EAEC]">Usage by purpose</h2><div className="mt-4 space-y-3">{[...byPurpose.entries()].sort((a,b)=>b[1]-a[1]).map(([purpose, requests]) => <div key={purpose}><div className="mb-1.5 flex justify-between text-xs"><span className="capitalize text-[#9299A2]">{purpose.replaceAll("_", " ")}</span><span className="text-[#D5D8DC]">{requests}</span></div><div className="h-2 rounded-full bg-[#1C2026]"><div className="h-full rounded-full bg-[#DDE047]" style={{ width: `${requests / maxPurpose * 100}%` }} /></div></div>)}</div></div><div className="rounded-xl border border-[#242830] bg-[#0E1013] p-4"><h2 className="text-sm font-semibold text-[#E8EAEC]">Recent requests</h2><div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><thead className="text-left text-[10px] uppercase tracking-wide text-[#5F6771]"><tr><th className="py-2">Time</th><th>Model</th><th>Tokens</th><th>Source</th><th>Status</th></tr></thead><tbody className="divide-y divide-[#22262D]">{[...usage.rows].reverse().slice(0, 12).map((row) => <tr key={String(row.id)}><td className="py-2.5 text-[#7D858F]">{new Date(String(row.created_at)).toLocaleTimeString()}</td><td className="text-[#C9CDD2]">{String(row.model)}</td><td>{Number(row.total_tokens).toLocaleString()}</td><td className={row.usage_source === "exact" ? "text-[#61CA90]" : "text-[#E0BE59]"}>{String(row.usage_source)}</td><td className="capitalize text-[#9AA1AA]">{String(row.status)}</td></tr>)}</tbody></table></div></div></section> : <section className="rounded-xl border border-[#242830] bg-[#0E1013] px-6 py-14 text-center"><p className="text-sm text-[#CED1D5]">No AI usage was recorded for this period.</p><p className="mt-1 text-xs text-[#6B737D]">New AI requests will include latency, status, pricing snapshot, and exact or estimated token provenance.</p></section>}
  </AdminPageBody></>
}
