import { AdminPageBody, AdminPageHeader } from "@/components/admin/page-header"
import { getAiUsage } from "@/lib/admin/control-centre"

export const dynamic = "force-dynamic"
export default async function CostMonitoringPage() {
  const [today, month] = await Promise.all([getAiUsage(1), getAiUsage(30)])
  const projected = month.metrics.cost / Math.max(1, new Date().getDate()) * 30
  const estimatedRows = month.rows.filter((row) => row.usage_source === "estimated").length
  return <><AdminPageHeader title="Cost monitoring" description="Historical provider costs use the price version and pricing snapshot stored with each request." generatedAt={month.generatedAt} autoRefreshSeconds={60} /><AdminPageBody><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Cost today",today.metrics.cost],["Cost · 30 days",month.metrics.cost],["Projected monthly",projected]].map(([label,value])=><article key={String(label)} className="rounded-xl border border-[#242830] bg-[#0E1013] p-4"><p className="text-xs text-[#8D949E]">{label}</p><p className="mt-3 text-3xl font-semibold">${Number(value).toFixed(4)}</p></article>)}<article className="rounded-xl border border-[#242830] bg-[#0E1013] p-4"><p className="text-xs text-[#8D949E]">Estimated-token requests</p><p className="mt-3 text-3xl font-semibold">{estimatedRows}</p><p className="mt-2 text-[11px] text-[#D1B554]">Not presented as exact cost</p></article></section>{month.rows.length ? <div className="rounded-xl border border-[#242830] bg-[#0E1013] p-4"><h2 className="text-sm font-semibold">Cost calculation quality</h2><p className="mt-2 text-xs text-[#79818B]">{month.metrics.exactRate.toFixed(1)}% of requests contain provider-returned token usage. Estimated requests remain visibly marked and retain their original pricing snapshot.</p></div> : <div className="rounded-xl border border-[#242830] bg-[#0E1013] p-10 text-center text-sm text-[#777F89]">No cost data has been recorded yet.</div>}</AdminPageBody></>
}
