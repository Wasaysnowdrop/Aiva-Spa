import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CalendarView } from "@/components/dashboard/calendar-view"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { listBookings } from "@/lib/calendar"

export const dynamic = "force-dynamic"

async function loadBookingsForCurrentSpa(): Promise<{
  spaIds: string[]
  bookings: Awaited<ReturnType<typeof listBookings>>
  reason: "ok" | "no_install" | "db_error"
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { spaIds: [], bookings: [], reason: "no_install" }
  const { data: installs, error: installErr } = await supabase
    .from("widget_installs")
    .select("widget_key")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
  if (installErr) {
    console.error("[calendar] widget_installs query failed:", installErr.message)
    return { spaIds: [], bookings: [], reason: "db_error" }
  }
  const spaIds = (installs ?? [])
    .map((row) => (row as { widget_key?: string }).widget_key)
    .filter((k): k is string => Boolean(k))
  if (spaIds.length === 0) return { spaIds: [], bookings: [], reason: "no_install" }

  // Merge bookings across all the user's spa installs so a single owner
  // with multiple embeds still sees the full picture on one page.
  const lists = await Promise.all(
    spaIds.map((spaId) => listBookings(spaId, { limit: 200 })),
  )
  const merged = lists
    .flat()
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 200)
  return { spaIds, bookings: merged, reason: "ok" }
}

export default async function CalendarPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login?redirectTo=/dashboard/calendar")
  const { spaIds, bookings } = await loadBookingsForCurrentSpa()
  return (
    <>
      <DashboardHeader />
      <Suspense
        fallback={
          <div className="p-5 text-xs text-[#8A8F98]">Loading calendar…</div>
        }
      >
        <CalendarView spaIds={spaIds} initialBookings={bookings} />
      </Suspense>
    </>
  )
}
