"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { banUserAction, unbanUserAction, revokeUserSessionsAction } from "@/app/actions/admin-users"

export type AdminUserRow = { id: string; email: string; status: string; business: string; businessId: string | null; role: string; plan: string; createdAt: string; lastSignInAt: string | null; onboardingStatus: string; securityStatus: string; isAdmin: boolean; banned: boolean }

export function UsersControlTable({ rows, currentAdminId }: { rows: AdminUserRow[]; currentAdminId: string }) {
  const router = useRouter(); const [filter, setFilter] = useState("all"); const [pending, startTransition] = useTransition()
  const visible = useMemo(() => rows.filter((row) => filter === "all" || (filter === "active" && !row.banned) || (filter === "suspended" && row.banned) || (filter === "no_business" && !row.businessId) || (filter === "onboarding" && row.onboardingStatus !== "complete") || (filter === "admin" && row.isAdmin)), [filter, rows])
  const mutate = (row: AdminUserRow, action: "suspend" | "restore" | "revoke") => {
    if (row.id === currentAdminId) return toast.error("You cannot perform this action on your own admin session.")
    if (!window.confirm(`${action === "suspend" ? "Suspend access for" : action === "restore" ? "Restore access for" : "Revoke all sessions for"} ${row.email}?`)) return
    startTransition(async () => { const result = action === "suspend" ? await banUserAction(row.id, "Suspended from admin control centre") : action === "restore" ? await unbanUserAction(row.id) : await revokeUserSessionsAction(row.id); if (result.ok) { toast.success("User updated."); router.refresh() } else toast.error(result.error) })
  }
  const columns: DataTableColumn<AdminUserRow>[] = [
    { key: "user", header: "User", render: (row) => <div><Link href={`/admin/users/${row.id}`} className="font-semibold text-[#E6E8EA] hover:text-[#E4E647]">{row.email || "No email"}</Link><p className="mt-0.5 font-mono text-[10px] text-[#646C76]">{row.id}</p></div> },
    { key: "status", header: "Status", render: (row) => <span className={row.banned ? "text-[#EF787D]" : "text-[#61C98F]"}>{row.status}</span> },
    { key: "business", header: "Business", render: (row) => row.businessId ? <Link href={`/admin/businesses/${row.businessId}`} className="text-[#C9CDD2] hover:text-white">{row.business}</Link> : <span className="text-[#686F79]">No business</span> },
    { key: "role", header: "Role / plan", render: (row) => <div><p className="capitalize">{row.role.replaceAll("_", " ")}</p><p className="text-[10px] capitalize text-[#747C86]">{row.plan}</p></div> },
    { key: "onboarding", header: "Onboarding", render: (row) => <span className="capitalize text-[#8D949E]">{row.onboardingStatus.replaceAll("_", " ")}</span> },
    { key: "security", header: "Security", render: (row) => <span className="capitalize text-[#8D949E]">{row.securityStatus}</span> },
    { key: "last", header: "Last sign-in", render: (row) => <span className="text-[#747C86]">{row.lastSignInAt ? new Date(row.lastSignInAt).toLocaleString() : "Never"}</span> },
    { key: "actions", header: "Actions", render: (row) => <div className="flex gap-2">{row.banned ? <button disabled={pending} onClick={() => mutate(row,"restore")} className="text-[#61CA90]">Restore</button> : <button disabled={pending} onClick={() => mutate(row,"suspend")} className="text-[#ED7479]">Suspend</button>}<button disabled={pending} onClick={() => mutate(row,"revoke")} className="text-[#9AA1AA]">Revoke sessions</button></div> },
  ]
  return <DataTable rows={visible} columns={columns} pageSize={30} search={(row, term) => `${row.email} ${row.business} ${row.id}`.toLowerCase().includes(term.toLowerCase())} empty="No users match this view." rightSlot={<select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-8 rounded-md border border-[#2A2F36] bg-[#111318] px-2 text-xs text-[#A5ABB3]"><option value="all">All users</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="no_business">No business</option><option value="onboarding">Onboarding incomplete</option><option value="admin">Administrators</option></select>} />
}
