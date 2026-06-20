import { AdminTopBar } from "@/components/admin/admin-shell"
import { getUserList } from "@/lib/admin/queries"

import { UsersTable, type UserRow } from "./users-table"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
  const users = (await getUserList()) as UserRow[]

  return (
    <>
      <AdminTopBar
        title="Users"
        subtitle={`${users.length} signed-up accounts`}
      />
      <div className="p-5">
        <UsersTable rows={users} pageSize={50} empty="No users yet." />
      </div>
    </>
  )
}
