"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"

export type BusinessRow = {
  id: string; name: string; ownerEmail: string; plan: string; subscriptionStatus: string; onboardingStatus: string; widgetStatus: string; conversations: number; leads: number; bookings: number; createdAt: string; lastActive: string; health: string
}

export function BusinessesTable({ rows }: { rows: BusinessRow[] }) {
  const [filter, setFilter] = useState("all")
  const visible = useMemo(() => rows.filter((row) => {
    if (filter === "all") return true
    if (filter === "active") return row.subscriptionStatus === "active"
    if (filter === "trial") return row.subscriptionStatus === "trialing"
    if (filter === "cancelled") return row.subscriptionStatus === "canceled"
    if (filter === "onboarding") return row.onboardingStatus !== "complete"
    if (filter === "widget") return row.widgetStatus !== "active"
    if (filter === "no_activity") return row.conversations + row.leads + row.bookings === 0
    return true
  }), [filter, rows])
  const columns: DataTableColumn<BusinessRow>[] = [
    { key: "business", header: "Business", render: (row) => <div><Link href={`/admin/businesses/${row.id}`} className="font-semibold text-[#E7E9EB] hover:text-[#E5E747]">{row.name}</Link><p className="mt-0.5 text-[10px] text-[#747C86]">{row.ownerEmail}</p></div> },
    { key: "plan", header: "Plan", render: (row) => <div><p className="capitalize">{row.plan}</p><p className="text-[10px] capitalize text-[#727A84]">{row.subscriptionStatus}</p></div> },
    { key: "onboarding", header: "Onboarding", render: (row) => <span className="capitalize text-[#9299A2]">{row.onboardingStatus.replaceAll("_", " ")}</span> },
    { key: "widget", header: "Widget", render: (row) => <span className={row.widgetStatus === "active" ? "text-[#62CB91]" : "text-[#E1BD59]"}>{row.widgetStatus}</span> },
    { key: "usage", header: "Conversations / leads / bookings", render: (row) => <span className="tabular-nums text-[#C9CDD2]">{row.conversations} / {row.leads} / {row.bookings}</span> },
    { key: "last", header: "Last active", render: (row) => <span className="text-[#7C848E]">{row.lastActive ? new Date(row.lastActive).toLocaleString() : "No activity"}</span> },
    { key: "health", header: "Health", render: (row) => <span className={`rounded-full border px-2 py-0.5 text-[10px] capitalize ${row.health === "healthy" ? "border-[#28543C] text-[#64D095]" : row.health === "suspended" ? "border-[#683236] text-[#F0787D]" : "border-[#5C4A23] text-[#E2C05B]"}`}>{row.health}</span> },
    { key: "open", header: "", render: (row) => <Link href={`/admin/businesses/${row.id}`} aria-label={`Open ${row.name}`}><ArrowUpRight className="size-3.5 text-[#737B85]" /></Link> },
  ]
  return <DataTable rows={visible} columns={columns} pageSize={30} search={(row, term) => `${row.name} ${row.ownerEmail} ${row.id}`.toLowerCase().includes(term.toLowerCase())} empty="No businesses match this view." rightSlot={<select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-8 rounded-md border border-[#2A2F36] bg-[#111318] px-2 text-xs text-[#A5ABB3]"><option value="all">All businesses</option><option value="active">Active</option><option value="trial">Trial</option><option value="cancelled">Cancelled</option><option value="onboarding">Onboarding incomplete</option><option value="widget">Widget not active</option><option value="no_activity">No activity</option></select>} />
}
