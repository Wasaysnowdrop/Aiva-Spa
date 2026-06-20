"use client"

import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { StatusPill } from "@/components/admin/status-pill"

export type NotifRow = {
  id: string
  lead_id: string | null
  channel: string
  status: string
  recipient: string | null
  error: string | null
  sent_at: string
  retry_count: number | null
}

export function NotificationsTable({
  rows,
  pageSize = 50,
  empty = "No notifications sent yet.",
}: {
  rows: NotifRow[]
  pageSize?: number
  empty?: React.ReactNode
}) {
  const columns: DataTableColumn<NotifRow>[] = [
    {
      key: "channel",
      header: "Channel",
      render: (r) => (
        <StatusPill
          status={r.channel === "email" ? "info" : "warn"}
          label={r.channel}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <StatusPill
          status={
            r.status === "delivered"
              ? "ok"
              : r.status === "pending"
                ? "warn"
                : "error"
          }
          label={r.status}
        />
      ),
    },
    {
      key: "recipient",
      header: "Recipient",
      render: (r) => (
        <span className="font-mono text-[10px] text-[#8A8F98]">{r.recipient ?? "—"}</span>
      ),
    },
    {
      key: "retries",
      header: "Retries",
      render: (r) => (
        <span className="font-mono text-[11px] text-[#8A8F98]">{r.retry_count ?? 0}</span>
      ),
    },
    {
      key: "error",
      header: "Error",
      render: (r) => (
        <span className="max-w-[260px] truncate text-[10px] text-[#EB5757]">
          {r.error ?? "—"}
        </span>
      ),
    },
    {
      key: "at",
      header: "Sent",
      render: (r) => (
        <span className="text-[10px] text-[#8A8F98]">
          {new Date(r.sent_at).toLocaleString()}
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
        (r.recipient ?? "").toLowerCase().includes(t.toLowerCase()) ||
        (r.error ?? "").toLowerCase().includes(t.toLowerCase())
      }
      empty={empty}
    />
  )
}
