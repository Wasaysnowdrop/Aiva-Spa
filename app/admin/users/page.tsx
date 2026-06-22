import { AdminTopBar } from "@/components/admin/admin-shell"
import { getUserList } from "@/lib/admin/queries"
import { requireAdmin } from "@/lib/admin/auth"

import { UsersTable, type UserRow } from "./users-table"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
  const admin = await requireAdmin()
  const users = (await getUserList()) as UserRow[]

  return (
    <>
      <AdminTopBar
        title="Users"
        subtitle={`${users.length} signed-up accounts · ${users.filter((u) => u.banned).length} banned`}
      />
      <div className="p-5">
        <UsersTable rows={users} currentAdminId={admin.id} pageSize={50} empty="No users yet." />
      </div>
    </>
  )
}
