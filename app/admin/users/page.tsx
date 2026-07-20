import { AdminPageBody, AdminPageHeader } from "@/components/admin/page-header"
import { UsersControlTable, type AdminUserRow } from "@/components/admin/users-control-table"
import { getUsersDetailed } from "@/lib/admin/control-centre"
import { requireAdmin } from "@/lib/admin/auth"

export const dynamic = "force-dynamic"
export default async function AdminUsersPage() { const [admin, rows] = await Promise.all([requireAdmin(), getUsersDetailed()]); return <><AdminPageHeader title="Users" description={`${rows.length} accounts with business, role, onboarding, and security context.`} generatedAt={new Date().toISOString()} /><AdminPageBody><UsersControlTable rows={rows as AdminUserRow[]} currentAdminId={admin.id} /></AdminPageBody></> }