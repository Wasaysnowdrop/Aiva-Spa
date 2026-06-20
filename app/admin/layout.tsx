import type { ReactNode } from "react"

import { requireAdmin } from "@/lib/admin/auth"
import { AdminRealtimeProvider } from "@/components/admin/admin-realtime-provider"
import { AdminSidebar } from "@/components/admin/admin-shell"

export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin()

  return (
    <AdminRealtimeProvider>
      <div className="flex min-h-screen bg-[#08090a] text-[#F7F8F8]">
        <AdminSidebar email={admin.email} />
        <div className="flex min-h-screen flex-1 flex-col">{children}</div>
      </div>
    </AdminRealtimeProvider>
  )
}
