"use client"

import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { StatusPill } from "@/components/admin/status-pill"

export type ChatRow = {
  session_id: string
  visitor_name: string | null
  status: string
  lead_captured: boolean
  lead_id: string | null
  last_message_at: string | null
  source_url: string | null
  created_at: string
}

export function ConversationsTable({
  rows,
  pageSize = 50,
  empty = "No chat sessions yet.",
}: {
  rows: ChatRow[]
  pageSize?: number
  empty?: React.ReactNode
}) {
  const columns: DataTableColumn<ChatRow>[] = [
    {
      key: "visitor",
      header: "Visitor",
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold">{r.visitor_name ?? "Anonymous"}</span>
          {r.source_url ? (
            <span className="max-w-[200px] truncate font-mono text-[10px] text-[#62666D]">
              {r.source_url}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "session",
      header: "Session",
      render: (r) => (
        <span className="font-mono text-[10px] text-[#8A8F98]">
          {r.session_id.slice(0, 12)}…
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusPill status="info" label={r.status} />,
    },
    {
      key: "lead",
      header: "Lead",
      render: (r) =>
        r.lead_captured ? (
          <StatusPill status="ok" label="captured" />
        ) : (
          <StatusPill status="muted" label="open" />
        ),
    },
    {
      key: "lead_id",
      header: "Lead id",
      render: (r) =>
        r.lead_id ? (
          <span className="font-mono text-[10px] text-[#8A8F98]">
            {r.lead_id.slice(0, 8)}…
          </span>
        ) : (
          <span className="text-[10px] text-[#62666D]">—</span>
        ),
    },
    {
      key: "last",
      header: "Last message",
      render: (r) => (
        <span className="text-[#8A8F98]">
          {r.last_message_at
            ? new Date(r.last_message_at).toLocaleString()
            : "—"}
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
        (r.visitor_name ?? "").toLowerCase().includes(t.toLowerCase()) ||
        r.session_id.toLowerCase().includes(t.toLowerCase())
      }
      empty={empty}
    />
  )
}
