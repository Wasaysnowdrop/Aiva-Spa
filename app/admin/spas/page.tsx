import { AdminTopBar } from "@/components/admin/admin-shell"
import { createAdminClient } from "@/lib/supabase/admin"

import { SpasTable, type SpaRow } from "./spas-table"

export const dynamic = "force-dynamic"

async function getSpaInstalls(): Promise<SpaRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("widget_installs")
    .select("id, widget_key, user_id, active, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(500)
  return (data ?? []) as SpaRow[]
}

export default async function AdminSpasPage() {
  const rows = await getSpaInstalls()

  return (
    <>
      <AdminTopBar
        title="Spas / widget installs"
        subtitle={`${rows.length} installs across all owners`}
      />
      <div className="p-5">
        <SpasTable rows={rows} pageSize={50} empty="No widget installs yet." />
      </div>
    </>
  )
}
