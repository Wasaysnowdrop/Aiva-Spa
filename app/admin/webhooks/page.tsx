import { AdminTopBar } from "@/components/admin/admin-shell"
import { getRecentWebhookDeliveries } from "@/lib/admin/queries"

import { WebhooksTable, type DeliveryRow } from "./webhooks-table"

export const dynamic = "force-dynamic"

export default async function AdminWebhooksPage() {
  const deliveries = (await getRecentWebhookDeliveries(200)) as DeliveryRow[]

  return (
    <>
      <AdminTopBar
        title="Webhook deliveries"
        subtitle={`${deliveries.length} most recent attempts`}
      />
      <div className="p-5">
        <WebhooksTable rows={deliveries} pageSize={50} empty="No webhook deliveries yet." />
      </div>
    </>
  )
}
