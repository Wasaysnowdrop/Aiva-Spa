"use client"

import { DataTable, type DataTableColumn } from "@/components/admin/data-table"

export type AuditRow = {
  id: string
  user_name: string
  action: string
  user_id: string | null
  created_at: string
}

export function AuditTable({
  rows,
  pageSize = 50,
  empty = "No audit events yet.",
}: {
  rows: AuditRow[]
  pageSize?: number
  empty?: React.ReactNode
}) {
  const columns: DataTableColumn<AuditRow>[] = [
    {
      key: "user",
      header: "Actor",
      render: (r) => <span className="font-mono text-[10px] text-[#8A8F98]">{r.user_name}</span>,
    },
    {
      key: "user_id",
      header: "User id",
      render: (r) =>
        r.user_id ? (
          <span className="font-mono text-[10px] text-[#8A8F98]">{r.user_id.slice(0, 8)}…</span>
        ) : (
          <span className="text-[10px] text-[#62666D]">—</span>
        ),
    },
    {
      key: "action",
      header: "Action",
      render: (r) => <span className="font-mono text-[11px]">{r.action}</span>,
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
        r.user_name.toLowerCase().includes(t.toLowerCase()) ||
        r.action.toLowerCase().includes(t.toLowerCase())
      }
      empty={empty}
    />
  )
}
