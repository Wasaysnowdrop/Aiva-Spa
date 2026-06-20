"use client"

import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { StatusPill } from "@/components/admin/status-pill"

export type DeliveryRow = {
  id: string
  webhook_id: string
  event: string
  success: boolean
  response_status: number | null
  duration_ms: number | null
  error: string | null
  attempt: number
  created_at: string
}

export function WebhooksTable({
  rows,
  pageSize = 50,
  empty = "No webhook deliveries yet.",
}: {
  rows: DeliveryRow[]
  pageSize?: number
  empty?: React.ReactNode
}) {
  const columns: DataTableColumn<DeliveryRow>[] = [
    {
      key: "event",
      header: "Event",
      render: (r) => <span className="font-mono text-[11px]">{r.event}</span>,
    },
    {
      key: "status",
      header: "HTTP",
      render: (r) => (
        <span
          className={
            r.success
              ? "font-mono text-[11px] text-[#4CB782]"
              : "font-mono text-[11px] text-[#EB5757]"
          }
        >
          {r.response_status ?? "—"}
        </span>
      ),
    },
    {
      key: "result",
      header: "Result",
      render: (r) => (
        <StatusPill status={r.success ? "ok" : "error"} label={r.success ? "delivered" : "failed"} />
      ),
    },
    {
      key: "attempt",
      header: "Attempt",
      render: (r) => <span className="font-mono text-[11px] text-[#8A8F98]">{r.attempt}</span>,
    },
    {
      key: "duration",
      header: "Duration",
      render: (r) => (
        <span className="font-mono text-[11px] text-[#8A8F98]">
          {r.duration_ms != null ? `${r.duration_ms}ms` : "—"}
        </span>
      ),
    },
    {
      key: "error",
      header: "Error",
      render: (r) => (
        <span className="max-w-[300px] truncate text-[10px] text-[#EB5757]">
          {r.error ?? "—"}
        </span>
      ),
    },
    {
      key: "at",
      header: "When",
      render: (r) => (
        <span className="text-[10px] text-[#8A8F98]">
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
        r.event.toLowerCase().includes(t.toLowerCase()) ||
        (r.error ?? "").toLowerCase().includes(t.toLowerCase())
      }
      empty={empty}
    />
  )
}
