"use client"

import { Database } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { StatusPill } from "@/components/admin/status-pill"

export type DatabaseRow = {
  table: string
  count: number
  error: string | null
}

export function DatabaseTable({
  rows,
  pageSize = 50,
  empty = "No tables.",
}: {
  rows: DatabaseRow[]
  pageSize?: number
  empty?: React.ReactNode
}) {
  const columns: DataTableColumn<DatabaseRow>[] = [
    {
      key: "table",
      header: "Table",
      render: (r) => (
        <span className="inline-flex items-center gap-2 font-mono text-xs">
          <Database className="size-3 text-[#5E6AD2]" /> {r.table}
        </span>
      ),
    },
    {
      key: "count",
      header: "Rows",
      render: (r) => (
        <span className="font-mono text-xs tabular-nums text-[#F7F8F8]">
          {r.count.toLocaleString()}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <StatusPill
          status={r.error ? "error" : "ok"}
          label={r.error ? "error" : "ok"}
        />
      ),
    },
    {
      key: "error",
      header: "Detail",
      render: (r) => (
        <span className="max-w-[300px] truncate text-[10px] text-[#EB5757]">
          {r.error ?? "—"}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      rows={rows}
      columns={columns}
      pageSize={pageSize}
      search={(r, t) => r.table.toLowerCase().includes(t.toLowerCase())}
      empty={empty}
    />
  )
}
