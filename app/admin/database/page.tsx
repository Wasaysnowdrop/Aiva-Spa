import { AdminTopBar } from "@/components/admin/admin-shell"
import { getDatabaseHealth } from "@/lib/admin/queries"
import { DatabaseTable } from "./database-table"

export const dynamic = "force-dynamic"

export default async function AdminDatabasePage() {
  const rows = (await getDatabaseHealth()) as {
    table: string
    count: number
    error: string | null
  }[]

  const total = rows.reduce((a, r) => a + r.count, 0)

  return (
    <>
      <AdminTopBar
        title="Database"
        subtitle={`${rows.length} tables · ${total.toLocaleString()} total rows`}
      />
      <div className="p-5">
        <DatabaseTable rows={rows} pageSize={50} empty="No tables." />
      </div>
    </>
  )
}
