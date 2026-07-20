"use client"

import * as React from "react"
import Link from "next/link"
import { ExternalLink, Pause, Play, RotateCcw } from "lucide-react"
import { useAdminFeed } from "./admin-realtime-provider"

const FILTERS = ["all", "leads", "conversations", "bookings", "email", "ai", "subscriptions", "security", "admin"]
const statusColor: Record<string, string> = { success: "bg-[#58C78A]", info: "bg-[#7280E8]", warning: "bg-[#E5C65A]", error: "bg-[#EF7378]" }

export function LiveFeed() {
  const { events, isPaused, pendingCount, connection, pause, resume, clear } = useAdminFeed()
  const [filter, setFilter] = React.useState("all")
  const visible = filter === "all" ? events : events.filter((event) => event.category === filter)
  return <section className="rounded-xl border border-[#242830] bg-[#0E1013]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#242830] px-4 py-3">
      <div className="flex items-center gap-2"><span className={`size-2 rounded-full ${connection === "live" ? "bg-[#58C78A]" : connection === "reconnecting" ? "bg-[#E5C65A]" : "bg-[#6C737D]"}`} /><span className="text-xs font-semibold capitalize text-[#DDE0E3]">{isPaused ? "Paused" : connection}</span>{pendingCount ? <span className="text-xs text-[#E3C557]">{pendingCount} queued</span> : null}</div>
      <div className="flex items-center gap-2"><button type="button" onClick={isPaused ? resume : pause} className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2F37] px-2.5 py-1.5 text-xs text-[#A9AFB7] hover:text-white">{isPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}{isPaused ? "Resume" : "Pause"}</button><button type="button" onClick={clear} title="Clear the visible list only" className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2F37] px-2.5 py-1.5 text-xs text-[#A9AFB7] hover:text-white"><RotateCcw className="size-3.5" />Clear view</button></div>
    </div>
    <div className="flex gap-1.5 overflow-x-auto border-b border-[#242830] px-4 py-3">{FILTERS.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] capitalize ${filter === item ? "border-[#DDE047] bg-[#252713] text-[#E8EA52]" : "border-[#292D34] text-[#7E858F] hover:text-white"}`}>{item}</button>)}</div>
    {visible.length ? <ul className="divide-y divide-[#20242A]">{visible.map((event) => <li key={event.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[10px_minmax(0,1fr)_160px_auto] sm:items-center"><span className={`size-2 rounded-full ${statusColor[event.status] ?? "bg-[#737A84]"}`} /><div className="min-w-0"><p className="truncate text-sm font-medium text-[#E2E4E7]">{event.title}</p><p className="mt-0.5 truncate text-xs text-[#737B85]">{event.businessName} · {event.detail}</p></div><div><span className="rounded-full border border-[#2B3038] px-2 py-0.5 text-[10px] capitalize text-[#8E959E]">{event.category}</span><p className="mt-1 text-[10px] text-[#5E6670]">{new Date(event.occurredAt).toLocaleString()}</p></div>{event.href ? <Link href={event.href} className="text-[#777F89] hover:text-white"><ExternalLink className="size-3.5" /></Link> : <span />}</li>)}</ul> : <div className="px-6 py-14 text-center"><p className="text-sm text-[#C8CCD1]">No activity matches this filter</p><p className="mt-1 text-xs text-[#69717B]">Persisted events appear here before and after this browser session.</p></div>}
  </section>
}