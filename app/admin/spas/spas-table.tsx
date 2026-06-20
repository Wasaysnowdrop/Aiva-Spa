"use client"

import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { StatusPill } from "@/components/admin/status-pill"

export type SpaRow = {
  id: string
  widget_key: string
  user_id: string
  active: boolean
  created_at: string
  updated_at: string
}

export function SpasTable({
  rows,
  pageSize = 50,
  empty = "No widget installs yet.",
}: {
  rows: SpaRow[]
  pageSize?: number
  empty?: React.ReactNode
}) {
  const columns: DataTableColumn<SpaRow>[] = [
    {
      key: "widget_key",
      header: "Widget key",
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-[#F7F8F8]">{r.widget_key}</span>
      ),
    },
    {
      key: "user",
      header: "Owner",
      render: (r) => (
        <span className="font-mono text-[10px] text-[#8A8F98]">
          {r.user_id.slice(0, 8)}…
        </span>
      ),
    },
    {
      key: "active",
      header: "Active",
      render: (r) => (
        <StatusPill
          status={r.active ? "ok" : "muted"}
          label={r.active ? "active" : "inactive"}
        />
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (r) => (
        <span className="text-[10px] text-[#8A8F98]">
          {new Date(r.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      key: "updated",
      header: "Updated",
      render: (r) => (
        <span className="text-[10px] text-[#8A8F98]">
          {new Date(r.updated_at).toLocaleString()}
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
        r.widget_key.toLowerCase().includes(t.toLowerCase()) ||
        r.user_id.toLowerCase().includes(t.toLowerCase())
      }
      empty={empty}
    />
  )
}
