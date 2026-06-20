import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CalendarView } from "@/components/dashboard/calendar-view"
import { listBookings } from "@/lib/calendar"

export const dynamic = "force-dynamic"

async function loadBookingsForCurrentSpa(): Promise<{
  spaId: string | null
  bookings: Awaited<ReturnType<typeof listBookings>>
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { spaId: null, bookings: [] }
  const { data: install } = await supabase
    .from("widget_installs")
    .select("widget_key")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  const spaId =
    install && (install as { widget_key?: string }).widget_key
      ? (install as { widget_key: string }).widget_key
      : null
  if (!spaId) return { spaId: null, bookings: [] }
  const bookings = await listBookings(spaId, { limit: 200 })
  return { spaId, bookings }
}

export default async function CalendarPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login?redirectTo=/dashboard/calendar")
  const { spaId, bookings } = await loadBookingsForCurrentSpa()
  return (
    <Suspense
      fallback={
        <div className="p-5 text-xs text-[#8A8F98]">Loading calendar…</div>
      }
    >
      <CalendarView spaId={spaId ?? "default"} initialBookings={bookings} />
    </Suspense>
  )
}
