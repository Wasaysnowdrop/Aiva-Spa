import { Suspense } from "react"
import { redirect } from "next/navigation"

import { CalendarView } from "@/components/dashboard/calendar-view"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { mapCalendarBooking } from "@/lib/calendar/shared"
import { createClient } from "@/lib/supabase/server"
import { mapLead } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

function safeTimezone(value: unknown): string {
  const timezone = typeof value === "string" && value.trim() ? value.trim() : "UTC"
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date())
    return timezone
  } catch {
    console.warn("[calendar] invalid business timezone; falling back to UTC")
    return "UTC"
  }
}

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?redirectTo=/dashboard/calendar")

  const { data: installs } = await supabase
    .from("widget_installs")
    .select("widget_key")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
  const spaIds = (installs ?? [])
    .map((row) => (row as { widget_key?: string }).widget_key)
    .filter((value): value is string => Boolean(value))

  const [bookingResult, leadResult, settingsResult, widgetResult] = await Promise.all([
    supabase.from("calendar_bookings").select("*").eq("user_id", user.id).order("start_at", { ascending: true }).limit(1000),
    supabase.from("leads").select("*").eq("user_id", user.id).is("deleted_at", null).is("merged_into_id", null).order("created_at", { ascending: false }).limit(500),
    supabase.from("calendar_settings").select("working_hours").eq("user_id", user.id).limit(1).maybeSingle(),
    supabase.from("widget_config").select("working_hours").limit(1).maybeSingle(),
  ])

  const settingsHours = (settingsResult.data as { working_hours?: { tz?: unknown } } | null)?.working_hours
  const widgetHours = (widgetResult.data as { working_hours?: { tz?: unknown } } | null)?.working_hours
  const timezone = safeTimezone(settingsHours?.tz ?? widgetHours?.tz ?? "UTC")
  const initialError = bookingResult.error
    ? "We couldn’t read your bookings. Please retry."
    : leadResult.error
      ? "We couldn’t read booked leads. Please retry."
      : null

  return (
    <>
      <DashboardHeader />
      <Suspense fallback={<div className="p-5 text-xs text-[#8A8F98]">Loading calendar…</div>}>
        <CalendarView
          initialBookings={(bookingResult.data ?? []).map((row) => mapCalendarBooking(row as Record<string, unknown>))}
          initialLeads={(leadResult.data ?? []).map((row) => mapLead(row as Record<string, unknown>))}
          timezone={timezone}
          hasInstall={spaIds.length > 0}
          initialError={initialError}
          nowIso={new Date().toISOString()}
        />
      </Suspense>
    </>
  )
}