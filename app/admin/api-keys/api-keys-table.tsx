"use client"

import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { StatusPill } from "@/components/admin/status-pill"

export type ApiKeyRow = {
  id: string
  user_id: string
  name: string
  key_prefix: string
  scopes: string[]
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

export function ApiKeysTable({
  rows,
  pageSize = 50,
  empty = "No API keys yet.",
}: {
  rows: ApiKeyRow[]
  pageSize?: number
  empty?: React.ReactNode
}) {
  const columns: DataTableColumn<ApiKeyRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => <span className="font-semibold">{r.name}</span>,
    },
    {
      key: "prefix",
      header: "Prefix",
      render: (r) => (
        <span className="font-mono text-[10px] text-[#8A8F98]">{r.key_prefix}</span>
      ),
    },
    {
      key: "user",
      header: "User",
      render: (r) => (
        <span className="font-mono text-[10px] text-[#8A8F98]">
          {r.user_id.slice(0, 8)}…
        </span>
      ),
    },
    {
      key: "scopes",
      header: "Scopes",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.scopes.map((s) => (
            <span
              key={s}
              className="rounded border border-[#23252A] bg-[#121316] px-1.5 py-0.5 font-mono text-[9px] text-[#8A8F98]"
            >
              {s}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <StatusPill
          status={r.revoked_at ? "error" : r.expires_at && new Date(r.expires_at) < new Date() ? "warn" : "ok"}
          label={r.revoked_at ? "revoked" : "active"}
        />
      ),
    },
    {
      key: "used",
      header: "Last used",
      render: (r) => (
        <span className="text-[10px] text-[#8A8F98]">
          {r.last_used_at ? new Date(r.last_used_at).toLocaleString() : "Never"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (r) => (
        <span className="text-[10px] text-[#8A8F98]">
          {new Date(r.created_at).toLocaleDateString()}
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
        r.key_prefix.toLowerCase().includes(t.toLowerCase()) ||
        r.user_id.toLowerCase().includes(t.toLowerCase())
      }
      empty={empty}
    />
  )
}
