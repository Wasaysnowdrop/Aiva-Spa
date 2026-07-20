import type { ReactNode } from "react"

import { requireAdmin } from "@/lib/admin/auth"
import { AdminRealtimeProvider } from "@/components/admin/admin-realtime-provider"
import { AdminControlSidebar } from "@/components/admin/control-shell"
import { getAdminEvents } from "@/lib/admin/control-centre"

export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin()
  const initialEvents = await getAdminEvents(100)

  return (
    <AdminRealtimeProvider initialEvents={initialEvents}>
      <div className="flex min-h-screen bg-[#08090a] text-[#F7F8F8]">
        <AdminControlSidebar email={admin.email} role={admin.role} />
        <div className="flex min-h-screen flex-1 flex-col">{children}</div>
      </div>
    </AdminRealtimeProvider>
  )
}
