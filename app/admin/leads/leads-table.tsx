"use client"

import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { StatusPill } from "@/components/admin/status-pill"

export type LeadRow = {
  id: string
  name: string
  phone: string
  email: string | null
  service: string
  status: string
  source: string | null
  source_url: string | null
  after_hours: boolean
  created_at: string
  last_activity_at: string | null
}

const statusTone: Record<string, "ok" | "warn" | "info" | "muted"> = {
  new: "info",
  contacted: "warn",
  booked: "ok",
  lost: "muted",
}

export function LeadsTable({
  rows,
  pageSize = 50,
  empty = "No leads captured yet.",
}: {
  rows: LeadRow[]
  pageSize?: number
  empty?: React.ReactNode
}) {
  const columns: DataTableColumn<LeadRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold">{r.name}</span>
          {r.email ? (
            <span className="text-[10px] text-[#8A8F98]">{r.email}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (r) => <span className="font-mono text-[11px]">{r.phone}</span>,
    },
    {
      key: "service",
      header: "Service",
      render: (r) => <span className="text-[#8A8F98]">{r.service}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <StatusPill status={statusTone[r.status] ?? "muted"} label={r.status} />
      ),
    },
    {
      key: "source",
      header: "Source",
      render: (r) => (
        <div className="flex flex-col">
          <span className="text-[#8A8F98]">{r.source ?? "—"}</span>
          {r.source_url ? (
            <span className="max-w-[180px] truncate font-mono text-[10px] text-[#62666D]">
              {r.source_url}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "ah",
      header: "After hours",
      render: (r) =>
        r.after_hours ? <StatusPill status="warn" label="yes" /> : <StatusPill status="muted" label="no" />,
    },
    {
      key: "created",
      header: "Created",
      render: (r) => (
        <span className="text-[#8A8F98]">
          {new Date(r.created_at).toLocaleString()}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      rows={rows}
      columns={columns}
      pageSize={pageSize}
      search={(r, t) =>
        r.name.toLowerCase().includes(t.toLowerCase()) ||
        r.phone.includes(t) ||
        (r.email ?? "").toLowerCase().includes(t.toLowerCase()) ||
        r.service.toLowerCase().includes(t.toLowerCase())
      }
      empty={empty}
    />
  )
}
