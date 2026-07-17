import { AdminTopBar } from "@/components/admin/admin-shell"
import { getRecentNotificationLogs } from "@/lib/admin/queries"

import { NotificationsTable, type NotifRow } from "./notifications-table"

export const dynamic = "force-dynamic"

export default async function AdminNotificationsPage() {
  const rows = (await getRecentNotificationLogs(200)) as NotifRow[]

  return (
    <>
      <AdminTopBar
        title="Notification deliveries"
        subtitle={`${rows.length} most recent email attempts`}
      />
      <div className="p-5">
        <NotificationsTable rows={rows} pageSize={50} empty="No notifications sent yet." />
      </div>
    </>
  )
}
