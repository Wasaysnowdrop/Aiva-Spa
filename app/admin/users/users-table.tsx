"use client"

import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { StatusPill } from "@/components/admin/status-pill"

export type UserRow = {
  id: string
  email: string | null
  createdAt: string
  lastSignInAt: string | null
  appMetadata: Record<string, unknown>
  userMetadata: Record<string, unknown>
}

function isAdmin(u: UserRow): boolean {
  return Boolean((u.appMetadata as { is_admin?: boolean } | null)?.is_admin)
}

export function UsersTable({
  rows,
  pageSize = 50,
  empty = "No users yet.",
}: {
  rows: UserRow[]
  pageSize?: number
  empty?: React.ReactNode
}) {
  const columns: DataTableColumn<UserRow>[] = [
    {
      key: "email",
      header: "Email",
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs">{r.email ?? "—"}</span>
          {isAdmin(r) ? <StatusPill status="info" label="admin" /> : null}
        </div>
      ),
    },
    {
      key: "id",
      header: "User id",
      render: (r) => (
        <span className="font-mono text-[10px] text-[#8A8F98]">{r.id.slice(0, 8)}…</span>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (r) => (
        <span className="text-[#8A8F98]">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "last",
      header: "Last sign-in",
      render: (r) => (
        <span className="text-[#8A8F98]">
          {r.lastSignInAt
            ? new Date(r.lastSignInAt).toLocaleString()
            : "Never"}
        </span>
      ),
    },
    {
      key: "onboarding",
      header: "Onboarding state",
      render: (r) => {
        const meta = r.userMetadata as { onboarding_setup_section?: string; spa_name?: string }
        if (meta.onboarding_setup_section) {
          return (
            <span className="text-[#8A8F98]">
              {meta.spa_name ? `${meta.spa_name} · ` : ""}
              {meta.onboarding_setup_section}
            </span>
          )
        }
        if (meta.spa_name) {
          return <span className="text-[#8A8F98]">{meta.spa_name}</span>
        }
        return <span className="text-[10px] text-[#62666D]">—</span>
      },
    },
  ]

  return (
    <DataTable
      rows={rows}
      columns={columns}
      pageSize={pageSize}
      search={(r, t) =>
        (r.email ?? "").toLowerCase().includes(t.toLowerCase()) ||
        r.id.toLowerCase().includes(t.toLowerCase())
      }
      empty={empty}
    />
  )
}
