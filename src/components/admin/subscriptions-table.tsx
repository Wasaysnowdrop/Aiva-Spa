"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"

type Row = Record<string, unknown>
export function SubscriptionsTable({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState("all")
  const visible = useMemo(() => rows.filter((row) => filter === "all" || String(row.status) === filter || (filter === "over_limit" && Number(row.conversations_used) >= Number(row.monthly_quota))), [filter, rows])
  const columns: DataTableColumn<Row>[] = [
    { key: "business", header: "Business", render: (row) => <Link href={`/admin/businesses/${row.user_id}`} className="font-semibold text-[#E3E5E7] hover:text-[#E3E545]">{String(row.business)}</Link> },
    { key: "plan", header: "Plan", render: (row) => <span className="capitalize">{String(row.plan)}</span> },
    { key: "status", header: "Status", render: (row) => <span className="capitalize text-[#95A0AA]">{String(row.status)}</span> },
    { key: "provider", header: "Billing", render: (row) => <div><p className="capitalize">{String(row.billing_provider ?? "internal")}</p><p className="text-[10px] text-[#69717B]">{String(row.billing_variant_id ?? "No external price ID")}</p></div> },
    { key: "period", header: "Billing period", render: (row) => <span className="text-[#7D858F]">{new Date(String(row.period_start)).toLocaleDateString()} – {new Date(String(row.period_end)).toLocaleDateString()}</span> },
    { key: "usage", header: "Usage", render: (row) => <span>{Number(row.conversations_used).toLocaleString()} / {Number(row.monthly_quota).toLocaleString()}</span> },
    { key: "payment", header: "Payment", render: (row) => <span className="capitalize text-[#8F97A1]">{String(row.paymentStatus)}</span> },
    { key: "event", header: "Last billing event", render: (row) => <span className="text-[#727A84]">{new Date(String(row.lastBillingEvent)).toLocaleString()}</span> },
  ]
  return <DataTable rows={visible} columns={columns} pageSize={30} search={(row, term) => `${row.business} ${row.plan} ${row.status} ${row.user_id}`.toLowerCase().includes(term.toLowerCase())} empty="No subscriptions match this view." rightSlot={<select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-8 rounded-md border border-[#2A2F36] bg-[#111318] px-2 text-xs text-[#A5ABB3]"><option value="all">All subscriptions</option><option value="active">Active</option><option value="trialing">Trial</option><option value="canceled">Cancelled</option><option value="expired">Expired</option><option value="over_limit">Over limit</option></select>} />
}
