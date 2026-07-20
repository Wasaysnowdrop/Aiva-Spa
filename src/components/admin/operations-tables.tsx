"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"

type Row = Record<string, unknown>
const maskEmail = (value: unknown) => { const email=String(value??""); const [local,domain]=email.split("@"); return domain ? `${local?.slice(0,1) ?? "*"}***@${domain}` : "—" }
const maskPhone = (value: unknown) => { const digits=String(value??"").replace(/\D/g,""); return digits ? `••• ••• ${digits.slice(-4)}` : "—" }
const businessLink = (row: Row) => <Link href={`/admin/businesses/${row.user_id}`} className="text-[#C9CDD2] hover:text-white">{String(row.business)}</Link>

function FilteredTable({ rows, statusKey="status", columns, search, empty, options }: { rows: Row[]; statusKey?: string; columns: DataTableColumn<Row>[]; search: (row: Row, term: string) => boolean; empty: string; options: string[] }) {
  const [filter,setFilter]=useState("all"); const visible=useMemo(()=>rows.filter((row)=>filter==="all"||String(row[statusKey])===filter),[filter,rows,statusKey])
  return <DataTable rows={visible} columns={columns} pageSize={40} search={search} empty={empty} rightSlot={<select value={filter} onChange={(event)=>setFilter(event.target.value)} className="h-8 rounded-md border border-[#2A2F36] bg-[#111318] px-2 text-xs capitalize text-[#A5ABB3]"><option value="all">All statuses</option>{options.map((option)=><option key={option} value={option}>{option.replaceAll("_"," ")}</option>)}</select>} />
}

export function AdminLeadsTable({ rows }: { rows: Row[] }) {
  const columns: DataTableColumn<Row>[]=[
    {key:"lead",header:"Lead",render:(row)=><div><p className="font-semibold text-[#E2E4E6]">{String(row.name)}</p><p className="mt-0.5 text-[10px] text-[#6F7781]">{maskEmail(row.email)} · {maskPhone(row.phone)}</p></div>},
    {key:"business",header:"Business",render:businessLink},{key:"source",header:"Source",render:(row)=><span>{String(row.source)}</span>},{key:"service",header:"Service",render:(row)=><span>{String(row.service)}</span>},{key:"status",header:"Status",render:(row)=><span className="capitalize text-[#98A0AA]">{String(row.status)}</span>},{key:"created",header:"Created",render:(row)=><span className="text-[#747C86]">{new Date(String(row.created_at)).toLocaleString()}</span>},{key:"record",header:"Record",render:(row)=><Link href={`/dashboard/leads/${row.id}`} className="text-[#DDE047]">Inspect</Link>}
  ]
  return <FilteredTable rows={rows} columns={columns} options={["new","contacted","booked","lost"]} empty="No leads match this view." search={(row,term)=>`${row.name} ${row.business} ${row.service} ${row.id}`.toLowerCase().includes(term.toLowerCase())} />
}

export function AdminConversationsTable({ rows }: { rows: Row[] }) {
  const columns: DataTableColumn<Row>[]=[
    {key:"id",header:"Conversation",render:(row)=><div><p className="font-mono text-[11px] text-[#D5D8DC]">{String(row.session_id)}</p><p className="text-[10px] capitalize text-[#6C747E]">{String(row.conversation_type)} · {String(row.channel).replaceAll("_"," ")}</p></div>},{key:"business",header:"Business",render:businessLink},{key:"status",header:"Status",render:(row)=><span className="capitalize">{String(row.status)}</span>},{key:"messages",header:"Messages",render:(row)=><span>{Number(row.message_count).toLocaleString()}</span>},{key:"lead",header:"Lead created",render:(row)=><span className={row.lead_captured ? "text-[#61CA90]":"text-[#69717B]"}>{row.lead_captured ? "Yes":"No"}</span>},{key:"billable",header:"Billable",render:(row)=><span>{row.is_billable ? "Yes":"No"}</span>},{key:"created",header:"Created / last activity",render:(row)=><div className="text-[#737B85]"><p>{new Date(String(row.created_at)).toLocaleString()}</p><p className="text-[10px]">{new Date(String(row.last_message_at)).toLocaleString()}</p></div>}
  ]
  return <FilteredTable rows={rows} columns={columns} options={["active","converted","abandoned","ended","error"]} empty="No conversations match this view." search={(row,term)=>`${row.session_id} ${row.business} ${row.conversation_type}`.toLowerCase().includes(term.toLowerCase())} />
}

export function AdminBookingsTable({ rows }: { rows: Row[] }) {
  const columns: DataTableColumn<Row>[]=[{key:"booking",header:"Booking",render:(row)=><div><p className="font-semibold">{String(row.visitor_name??"Visitor")}</p><p className="text-[10px] text-[#707883]">{String(row.service)}</p></div>},{key:"business",header:"Business",render:businessLink},{key:"status",header:"Status",render:(row)=><span className="capitalize">{String(row.status)}</span>},{key:"source",header:"Source",render:(row)=><span className="capitalize">{String(row.source)}</span>},{key:"time",header:"Consultation time",render:(row)=><span>{new Date(String(row.start_at)).toLocaleString()}</span>},{key:"relations",header:"Relations",render:(row)=><span className="text-[#737B85]">{row.lead_id?"Lead linked":"No lead"} · {row.conversation_id?"Chat linked":"No chat"}</span>}]
  return <FilteredTable rows={rows} columns={columns} options={["pending","booked","confirmed","completed","cancelled","no_show"]} empty="No bookings match this view." search={(row,term)=>`${row.visitor_name} ${row.business} ${row.service} ${row.id}`.toLowerCase().includes(term.toLowerCase())} />
}

export function AdminEmailTable({ rows }: { rows: Row[] }) {
  const columns: DataTableColumn<Row>[]=[{key:"recipient",header:"Recipient",render:(row)=><span>{maskEmail(row.recipient)}</span>},{key:"business",header:"Business",render:businessLink},{key:"type",header:"Email type",render:(row)=><span className="capitalize">{String(row.email_type??"new_lead").replaceAll("_"," ")}</span>},{key:"status",header:"Status",render:(row)=><span className={String(row.status)==="failed"?"text-[#EF797E]":"text-[#61CA90]"}>{String(row.status)}</span>},{key:"provider",header:"Provider ID",render:(row)=><div><p className="capitalize">{String(row.provider??"unknown")}</p><p className="font-mono text-[10px] text-[#69717B]">{String(row.provider_message_id??"—")}</p></div>},{key:"sent",header:"Sent / delivered",render:(row)=><div className="text-[#747C86]"><p>{new Date(String(row.sent_at)).toLocaleString()}</p><p className="text-[10px]">{row.delivered_at?new Date(String(row.delivered_at)).toLocaleString():"Not confirmed"}</p></div>},{key:"latency",header:"Latency",render:(row)=><span>{row.latency_ms!=null?`${row.latency_ms} ms`:"—"}</span>},{key:"error",header:"Failure",render:(row)=><span className="max-w-60 truncate text-[#DD7478]">{String(row.error_reason??((row.detail as Row|undefined)?.error)??"—")}</span>}]
  return <FilteredTable rows={rows} columns={columns} options={["delivered","pending","failed"]} empty="No email deliveries match this view." search={(row,term)=>`${row.recipient} ${row.business} ${row.email_type} ${row.provider_message_id}`.toLowerCase().includes(term.toLowerCase())} />
}
