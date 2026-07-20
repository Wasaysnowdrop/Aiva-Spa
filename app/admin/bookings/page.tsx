import { AdminPageBody, AdminPageHeader } from "@/components/admin/page-header"
import { AdminBookingsTable } from "@/components/admin/operations-tables"
import { getOperationsData } from "@/lib/admin/control-centre"

export const dynamic = "force-dynamic"
export default async function BookingsPage() { const data=await getOperationsData(); return <><AdminPageHeader title="Bookings" description="Consultation bookings and their lead/conversation relationship health." generatedAt={new Date().toISOString()} /><AdminPageBody><AdminBookingsTable rows={data.bookings} /></AdminPageBody></> }
