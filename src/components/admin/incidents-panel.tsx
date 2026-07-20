"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateIncidentAction } from "@/app/actions/admin-control"

type Incident = Record<string, unknown>
const severityStyle: Record<string, string> = { critical: "border-[#733134] bg-[#2A1416] text-[#F27D81]", high: "border-[#6A4229] bg-[#281A11] text-[#F0A56B]", medium: "border-[#5A4B22] bg-[#261F10] text-[#E2C65E]", low: "border-[#33404D] bg-[#151B21] text-[#91A4B7]" }

export function IncidentsPanel({ rows }: { rows: Incident[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState("")
  const run = (id: string, operation: "acknowledge" | "monitor" | "resolve" | "reopen") => startTransition(async () => {
    if ((operation === "resolve" || operation === "reopen") && !window.confirm(`Confirm ${operation} for this incident?`)) return
    const result = await updateIncidentAction(id, operation, note)
    if (result.ok) { toast.success(result.message); setNote(""); router.refresh() } else toast.error(result.error)
  })
  if (!rows.length) return <div className="rounded-xl border border-[#242830] bg-[#0E1013] px-6 py-14 text-center"><p className="text-sm font-medium text-[#CFD3D7]">No incidents recorded</p><p className="mt-1 text-xs text-[#6F7781]">Threshold-based platform incidents will appear here; isolated harmless errors are not promoted.</p></div>
  return <div className="space-y-3">{rows.map((row) => {
    const id = String(row.id); const status = String(row.status); const severity = String(row.severity)
    return <article key={id} className="rounded-xl border border-[#242830] bg-[#0E1013] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${severityStyle[severity] ?? severityStyle.low}`}>{severity}</span><span className="rounded-full border border-[#30353D] px-2 py-0.5 text-[10px] capitalize text-[#9AA1AA]">{status}</span></div><h2 className="mt-3 text-sm font-semibold text-[#EBECEE]">{String(row.title)}</h2><p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#7D858F]">{String(row.description || "No diagnostic description supplied.")}</p></div><div className="text-right text-[11px] text-[#69717B]"><p>{String(row.service)}</p><p className="mt-1">Detected {new Date(String(row.detected_at)).toLocaleString()}</p></div></div>
      <div className="mt-4 grid gap-3 border-t border-[#22262D] pt-4 md:grid-cols-[1fr_auto]"><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Resolution note (used when resolving)" className="rounded-lg border border-[#2B3038] bg-[#111318] px-3 py-2 text-xs text-white outline-none placeholder:text-[#565E68] focus:border-[#DDE047]" /><div className="flex flex-wrap gap-2">{status === "open" ? <button disabled={pending} onClick={() => run(id, "acknowledge")} className="rounded-lg border border-[#333841] px-3 py-2 text-xs text-[#CDD1D6]">Acknowledge</button> : null}{status !== "resolved" ? <><button disabled={pending} onClick={() => run(id, "monitor")} className="rounded-lg border border-[#333841] px-3 py-2 text-xs text-[#CDD1D6]">Monitor</button><button disabled={pending} onClick={() => run(id, "resolve")} className="rounded-lg bg-[#E3E545] px-3 py-2 text-xs font-semibold text-[#090A0C]">Resolve</button></> : <button disabled={pending} onClick={() => run(id, "reopen")} className="rounded-lg border border-[#734043] px-3 py-2 text-xs text-[#F08185]">Reopen</button>}</div></div>
    </article>
  })}</div>
}
