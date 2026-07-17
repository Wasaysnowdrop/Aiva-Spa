"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Bell, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, ExternalLink, Filter, List, Loader2, Mail, Phone, Plus, RotateCw, UserRound, X } from "lucide-react"
import { toast } from "sonner"

import { saveBookingAction, updateBookingStatusAction } from "@/app/actions/calendar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { addCalendarDays, dateKeyInTimeZone, formatInTimeZone, monthGrid, startOfWeek, zonedDateTimeToUtc } from "@/lib/calendar/date"
import { isActiveBooking, mapCalendarBooking, type CalendarBooking, type CalendarBookingStatus } from "@/lib/calendar/shared"
import { useRealtimeSubscription } from "@/lib/hooks/use-realtime"
import { mapLead, type Lead } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

type ViewMode = "month" | "week" | "day" | "upcoming"

const STATUS_STYLES: Record<CalendarBookingStatus, string> = {
  pending: "border-[#E2E54B]/35 bg-[#E2E54B]/10 text-[#E2E54B]",
  booked: "border-[#5E6AD2]/40 bg-[#5E6AD2]/12 text-[#AEB4FF]",
  confirmed: "border-[#4CB782]/35 bg-[#4CB782]/10 text-[#4CB782]",
  completed: "border-[#62666D]/40 bg-[#62666D]/10 text-[#C9CCD2]",
  cancelled: "border-[#EB5757]/35 bg-[#EB5757]/10 text-[#EB5757]",
  no_show: "border-[#F2994A]/35 bg-[#F2994A]/10 text-[#F2994A]",
}

function anchorLabel(anchor: string, view: ViewMode) {
  const date = new Date(anchor + "T12:00:00Z")
  if (view === "month") return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
  if (view === "week") {
    const from = startOfWeek(anchor)
    const to = addCalendarDays(from, 6)
    const a = new Date(from + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    const b = new Date(to + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    return a + " – " + b
  }
  if (view === "day") return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
  return "Upcoming appointments"
}

function moveAnchor(anchor: string, view: ViewMode, direction: -1 | 1) {
  if (view === "day") return addCalendarDays(anchor, direction)
  if (view === "week") return addCalendarDays(anchor, direction * 7)
  const date = new Date(anchor + "T12:00:00Z")
  date.setUTCMonth(date.getUTCMonth() + direction)
  return date.toISOString().slice(0, 10)
}

function localParts(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return { date: values.year + "-" + values.month + "-" + values.day, time: values.hour + ":" + values.minute }
}

function StatusBadge({ status }: { status: CalendarBookingStatus }) {
  return <span className={cn("inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider", STATUS_STYLES[status])}>{status.replace("_", " ")}</span>
}

export function CalendarView({
  initialBookings,
  initialLeads,
  timezone,
  hasInstall,
  initialError,
  nowIso,
}: {
  initialBookings: CalendarBooking[]
  initialLeads: Lead[]
  timezone: string
  hasInstall: boolean
  initialError?: string | null
  nowIso: string
}) {
  const params = useSearchParams()
  const today = dateKeyInTimeZone(nowIso, timezone)
  const { data: bookings, setData: setBookings, refresh } = useRealtimeSubscription<CalendarBooking>({
    table: "calendar_bookings",
    initialData: initialBookings,
    orderBy: { column: "start_at", ascending: true },
    mapRow: mapCalendarBooking,
    getId: (booking) => booking.id,
  })
  const { data: leads } = useRealtimeSubscription<Lead>({
    table: "leads",
    initialData: initialLeads,
    orderBy: { column: "created_at", ascending: false },
    mapRow: mapLead,
    getId: (lead) => lead.id,
  })

  const [view, setView] = React.useState<ViewMode>("month")
  const [anchor, setAnchor] = React.useState(today)
  const [statusFilter, setStatusFilter] = React.useState("active")
  const [serviceFilter, setServiceFilter] = React.useState("all")
  const requestedLeadId = params.get("lead")
  const requestedBookingId = params.get("booking")
  const requestedRescheduleId = params.get("reschedule")
  const [selected, setSelected] = React.useState<CalendarBooking | null>(
    () => requestedRescheduleId ? null : initialBookings.find((booking) => booking.id === requestedBookingId) ?? null,
  )
  const [editing, setEditing] = React.useState<CalendarBooking | null | undefined>(
    () => requestedRescheduleId
      ? initialBookings.find((booking) => booking.id === requestedRescheduleId) ?? undefined
      : requestedLeadId ? null : undefined,
  )
  const [prefillLeadId, setPrefillLeadId] = React.useState<string | null>(requestedLeadId)
  const [pendingStatus, setPendingStatus] = React.useState(false)

  const safeBookings = React.useMemo(() => bookings.filter((booking) => booking.id && booking.startAt), [bookings])
  const safeLeads = React.useMemo(() => leads.filter((lead) => lead.id && !lead.deletedAt), [leads])
  const linkedActiveLeads = React.useMemo(
    () => new Set(safeBookings.filter((booking) => isActiveBooking(booking.status) && booking.leadId).map((booking) => booking.leadId!)),
    [safeBookings],
  )
  const needsScheduling = React.useMemo(
    () => safeLeads.filter((lead) => lead.status === "booked" && !linkedActiveLeads.has(lead.id)),
    [safeLeads, linkedActiveLeads],
  )
  const services = React.useMemo(
    () => Array.from(new Set([...safeBookings.map((booking) => booking.service), ...safeLeads.map((lead) => lead.service)].filter(Boolean))).sort(),
    [safeBookings, safeLeads],
  )
  const visible = React.useMemo(() => safeBookings.filter((booking) => {
    if (statusFilter === "active" && !isActiveBooking(booking.status)) return false
    if (statusFilter !== "all" && statusFilter !== "active" && booking.status !== statusFilter) return false
    return serviceFilter === "all" || booking.service === serviceFilter
  }), [safeBookings, statusFilter, serviceFilter])
  const upcomingCount = React.useMemo(
    () => safeBookings.filter((booking) => isActiveBooking(booking.status) && new Date(booking.startAt).getTime() >= new Date(nowIso).getTime()).length,
    [safeBookings, nowIso],
  )
  const eventsByDay = React.useMemo(() => {
    const grouped = new Map<string, CalendarBooking[]>()
    for (const booking of visible) {
      const key = dateKeyInTimeZone(booking.startAt, timezone)
      grouped.set(key, [...(grouped.get(key) ?? []), booking])
    }
    for (const list of grouped.values()) list.sort((a, b) => a.startAt.localeCompare(b.startAt))
    return grouped
  }, [visible, timezone])

  const updateStatus = async (booking: CalendarBooking, status: "confirmed" | "completed" | "cancelled" | "no_show") => {
    if (pendingStatus) return
    setPendingStatus(true)
    try {
      const result = await updateBookingStatusAction(booking.id, status)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setBookings((current) => current.map((item) => item.id === booking.id ? result.data : item))
      setSelected(result.data)
      toast.success(status === "cancelled" ? "Booking cancelled" : "Booking updated")
    } finally {
      setPendingStatus(false)
    }
  }

  if (initialError) {
    return <div className="p-5"><div className="rounded-2xl border border-[#EB5757]/30 bg-[#121316] p-8 text-center"><CalendarDays className="mx-auto size-8 text-[#EB5757]" /><h1 className="mt-3 text-lg font-semibold text-[#F7F8F8]">Calendar couldn’t be loaded</h1><p className="mt-1 text-xs text-[#8A8F98]">{initialError}</p><Button variant="outline" className="mt-4" onClick={() => void refresh()}><RotateCw className="size-4" /> Retry</Button></div></div>
  }

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F7F8F8]">Calendar</h1>
          <p className="mt-1 text-sm text-[#8A8F98]">Upcoming bookings captured by the chat widget. Enabled reminders are queued automatically by email.</p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-[#62666D]">Business timezone · {timezone}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#23252A] bg-[#121316] px-3 py-1.5 text-[11px] text-[#8A8F98]"><CalendarDays className="size-3 text-[#5E6AD2]" /> {upcomingCount} upcoming</span>
          <Button variant="outline" size="sm" onClick={() => { setPrefillLeadId(null); setEditing(null) }} disabled={!hasInstall}><Plus className="size-4" /> Add booking</Button>
        </div>
      </div>

      {needsScheduling.length > 0 ? (
        <section className="rounded-2xl border border-[#E2E54B]/25 bg-[#121316]">
          <div className="flex items-center justify-between border-b border-[#23252A] px-4 py-3">
            <div><h2 className="text-sm font-semibold text-[#F7F8F8]">Needs scheduling</h2><p className="text-[11px] text-[#8A8F98]">Booked leads without a confirmed date and time.</p></div>
            <span className="rounded-md bg-[#E2E54B]/10 px-2 py-1 text-[10px] font-semibold text-[#E2E54B]">{needsScheduling.length}</span>
          </div>
          <div className="grid gap-2 p-3 lg:grid-cols-2">
            {needsScheduling.slice(0, 6).map((lead) => (
              <div key={lead.id} className="flex items-center gap-3 rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-[#E2E54B]/10 text-[#E2E54B]"><Clock className="size-4" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#F7F8F8]">{lead.name}</p><p className="truncate text-[10px] text-[#8A8F98]">{lead.service} · {lead.preferredTime || "No time provided"}</p></div>
                <Button size="xs" onClick={() => { setPrefillLeadId(lead.id); setEditing(null) }}>Schedule</Button>
                <Button asChild size="xs" variant="ghost"><Link href={"/dashboard/leads/" + lead.id}>Open lead</Link></Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="rounded-2xl border border-[#23252A] bg-[#121316]">
        <div className="flex flex-col gap-3 border-b border-[#23252A] p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => setAnchor(today)}>Today</Button>
            <Button size="icon-sm" variant="ghost" aria-label="Previous" disabled={view === "upcoming"} onClick={() => setAnchor((value) => moveAnchor(value, view, -1))}><ChevronLeft className="size-4" /></Button>
            <Button size="icon-sm" variant="ghost" aria-label="Next" disabled={view === "upcoming"} onClick={() => setAnchor((value) => moveAnchor(value, view, 1))}><ChevronRight className="size-4" /></Button>
            <h2 className="ml-2 text-sm font-semibold text-[#F7F8F8]">{anchorLabel(anchor, view)}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="size-3.5 text-[#62666D]" />
            <select aria-label="Filter booking status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-8 rounded-lg border border-[#23252A] bg-[#0B0C0E] px-2 text-[11px] text-[#C9CCD2]">
              <option value="active">Active</option><option value="all">All statuses</option><option value="confirmed">Confirmed</option><option value="booked">Booked</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No show</option>
            </select>
            <select aria-label="Filter booking service" value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)} className="h-8 max-w-40 rounded-lg border border-[#23252A] bg-[#0B0C0E] px-2 text-[11px] text-[#C9CCD2]">
              <option value="all">All services</option>{services.map((service) => <option key={service} value={service}>{service}</option>)}
            </select>
            <div className="flex rounded-lg border border-[#23252A] bg-[#0B0C0E] p-0.5">
              {(["month", "week", "day", "upcoming"] as const).map((mode) => (
                <button key={mode} type="button" onClick={() => setView(mode)} className={cn("rounded-md px-2.5 py-1 text-[10px] font-semibold capitalize transition", view === mode ? "bg-[#E2E54B] text-[#08090A]" : "text-[#8A8F98] hover:text-[#F7F8F8]")}>
                  {mode === "upcoming" ? <span className="inline-flex items-center gap-1"><List className="size-3" /> List</span> : mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {visible.length === 0 && needsScheduling.length === 0 ? (
          <div className="p-12 text-center"><CalendarDays className="mx-auto size-9 text-[#5E6AD2]" /><p className="mt-3 text-sm font-semibold text-[#F7F8F8]">{hasInstall ? "No bookings yet" : "Connect your widget to start scheduling"}</p><p className="mx-auto mt-1 max-w-md text-xs text-[#8A8F98]">When a visitor confirms a real time—or your team schedules a booked lead—the appointment appears here automatically.</p>{hasInstall ? <Button size="sm" className="mt-4" onClick={() => { setPrefillLeadId(null); setEditing(null) }}><Plus className="size-4" /> Add booking</Button> : null}</div>
        ) : view === "month" ? (
          <MonthView anchor={anchor} today={today} timezone={timezone} events={eventsByDay} onSelect={setSelected} />
        ) : view === "week" ? (
          <WeekView anchor={anchor} today={today} timezone={timezone} events={eventsByDay} onSelect={setSelected} />
        ) : view === "day" ? (
          <DayView anchor={anchor} timezone={timezone} events={eventsByDay.get(anchor) ?? []} onSelect={setSelected} />
        ) : (
          <UpcomingView timezone={timezone} bookings={visible} nowIso={nowIso} onSelect={setSelected} />
        )}
      </div>

      <DetailsDialog booking={selected} timezone={timezone} pending={pendingStatus} onClose={() => setSelected(null)} onStatus={(status) => selected ? void updateStatus(selected, status) : undefined} onReschedule={() => { if (selected) { setEditing(selected); setPrefillLeadId(selected.leadId); setSelected(null) } }} />
      {editing !== undefined ? <EditorDialog key={editing?.id ?? prefillLeadId ?? "manual"} open booking={editing ?? null} leads={safeLeads} prefillLeadId={prefillLeadId} timezone={timezone} anchor={anchor} onClose={() => { setEditing(undefined); setPrefillLeadId(null) }} onSaved={(booking) => { setBookings((current) => current.some((item) => item.id === booking.id) ? current.map((item) => item.id === booking.id ? booking : item) : [...current, booking]); setEditing(undefined); setPrefillLeadId(null); setSelected(booking) }} /> : null}
    </div>
  )
}

function EventButton({ booking, timezone, onSelect, compact = false }: { booking: CalendarBooking; timezone: string; onSelect: (booking: CalendarBooking) => void; compact?: boolean }) {
  return <button type="button" onClick={() => onSelect(booking)} className={cn("w-full rounded-lg border p-2 text-left transition hover:border-[#E2E54B]/45", STATUS_STYLES[booking.status], compact && "p-1.5")}><p className="truncate text-[11px] font-semibold">{formatInTimeZone(booking.startAt, timezone, { hour: "numeric", minute: "2-digit" })} · {booking.visitorName}</p>{!compact ? <p className="mt-0.5 truncate text-[9px] opacity-75">{booking.service}</p> : null}</button>
}

function MonthView({ anchor, today, timezone, events, onSelect }: { anchor: string; today: string; timezone: string; events: Map<string, CalendarBooking[]>; onSelect: (booking: CalendarBooking) => void }) {
  const days = monthGrid(anchor)
  const month = anchor.slice(0, 7)
  return <div><div className="grid grid-cols-7 border-b border-[#23252A]">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[#62666D]">{day}</div>)}</div><div className="grid grid-cols-7">{days.map((day) => { const list = events.get(day) ?? []; return <div key={day} className={cn("min-h-28 border-b border-r border-[#23252A] p-1.5", !day.startsWith(month) && "bg-[#0B0C0E]/45", day === today && "bg-[#5E6AD2]/5")}><div className={cn("mb-1 flex size-6 items-center justify-center rounded-full text-[10px]", day === today ? "bg-[#E2E54B] font-bold text-[#08090A]" : day.startsWith(month) ? "text-[#C9CCD2]" : "text-[#62666D]")}>{Number(day.slice(-2))}</div><div className="space-y-1">{list.slice(0, 3).map((item) => <EventButton key={item.id} booking={item} timezone={timezone} onSelect={onSelect} compact />)}{list.length > 3 ? <p className="px-1 text-[9px] text-[#8A8F98]">+{list.length - 3} more</p> : null}</div></div> })}</div></div>
}

function WeekView({ anchor, today, timezone, events, onSelect }: { anchor: string; today: string; timezone: string; events: Map<string, CalendarBooking[]>; onSelect: (booking: CalendarBooking) => void }) {
  const start = startOfWeek(anchor)
  const days = Array.from({ length: 7 }, (_, index) => addCalendarDays(start, index))
  return <div className="grid min-h-[430px] grid-cols-1 divide-y divide-[#23252A] md:grid-cols-7 md:divide-x md:divide-y-0">{days.map((day) => <section key={day} className={cn("p-2", day === today && "bg-[#5E6AD2]/5")}><div className="mb-3 text-center"><p className="text-[9px] font-semibold uppercase tracking-wider text-[#62666D]">{new Date(day + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</p><p className={cn("mx-auto mt-1 flex size-7 items-center justify-center rounded-full text-xs", day === today ? "bg-[#E2E54B] font-bold text-[#08090A]" : "text-[#F7F8F8]")}>{Number(day.slice(-2))}</p></div><div className="space-y-1.5">{(events.get(day) ?? []).map((item) => <EventButton key={item.id} booking={item} timezone={timezone} onSelect={onSelect} />)}</div></section>)}</div>
}

function DayView({ anchor, timezone, events, onSelect }: { anchor: string; timezone: string; events: CalendarBooking[]; onSelect: (booking: CalendarBooking) => void }) {
  const hours = Array.from({ length: 14 }, (_, index) => index + 7)
  const byHour = new Map<number, CalendarBooking[]>()
  for (const event of events) { const hour = Number(formatInTimeZone(event.startAt, timezone, { hour: "2-digit", hourCycle: "h23" })); byHour.set(hour, [...(byHour.get(hour) ?? []), event]) }
  return <div className="divide-y divide-[#23252A]">{hours.map((hour) => <div key={hour} className="grid min-h-16 grid-cols-[80px_1fr]"><div className="border-r border-[#23252A] px-3 py-2 text-right text-[10px] text-[#62666D]">{new Date(anchor + "T" + String(hour).padStart(2, "0") + ":00:00Z").toLocaleTimeString("en-US", { hour: "numeric", timeZone: "UTC" })}</div><div className="grid gap-2 p-2 md:grid-cols-2">{(byHour.get(hour) ?? []).map((item) => <EventButton key={item.id} booking={item} timezone={timezone} onSelect={onSelect} />)}</div></div>)}</div>
}

function UpcomingView({ timezone, bookings, nowIso, onSelect }: { timezone: string; bookings: CalendarBooking[]; nowIso: string; onSelect: (booking: CalendarBooking) => void }) {
  const cutoff = new Date(nowIso).getTime()
  const upcoming = bookings.filter((booking) => new Date(booking.startAt).getTime() >= cutoff).sort((a, b) => a.startAt.localeCompare(b.startAt))
  return <div className="divide-y divide-[#23252A]">{upcoming.length === 0 ? <p className="p-10 text-center text-xs text-[#8A8F98]">No upcoming bookings match these filters.</p> : upcoming.map((booking) => <button key={booking.id} type="button" onClick={() => onSelect(booking)} className="grid w-full gap-3 p-4 text-left transition hover:bg-[#0B0C0E] sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center"><div><p className="text-xs font-semibold text-[#F7F8F8]">{formatInTimeZone(booking.startAt, timezone, { weekday: "short", month: "short", day: "numeric" })}</p><p className="text-[10px] text-[#8A8F98]">{formatInTimeZone(booking.startAt, timezone, { hour: "numeric", minute: "2-digit" })}</p></div><div><p className="text-sm font-semibold text-[#F7F8F8]">{booking.visitorName}</p><p className="text-[10px] text-[#8A8F98]">{booking.service} · {booking.durationMinutes} min</p></div><StatusBadge status={booking.status} /></button>)}</div>
}

function DetailsDialog({ booking, timezone, pending, onClose, onStatus, onReschedule }: { booking: CalendarBooking | null; timezone: string; pending: boolean; onClose: () => void; onStatus: (status: "confirmed" | "completed" | "cancelled" | "no_show") => void; onReschedule: () => void }) {
  return <Dialog open={Boolean(booking)} onOpenChange={(open) => { if (!open) onClose() }}>{booking ? <DialogContent className="max-w-xl border-[#23252A] bg-[#121316]"><DialogHeader><DialogTitle>{booking.visitorName}</DialogTitle><DialogDescription>{booking.service}</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Detail icon={CalendarDays} label="Appointment" value={formatInTimeZone(booking.startAt, timezone, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })} /><Detail icon={Clock} label="Duration" value={booking.durationMinutes + " minutes · " + booking.timezone} /><Detail icon={Phone} label="Phone" value={booking.visitorPhone || "Not provided"} /><Detail icon={Mail} label="Email" value={booking.visitorEmail || "Not provided"} /><Detail icon={Bell} label="Reminders" value={booking.reminderEmailEnabled ? "Email" : "Disabled"} /><Detail icon={CalendarDays} label="Created" value={formatInTimeZone(booking.createdAt, timezone, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} /><div className="rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3"><p className="text-[9px] uppercase tracking-wider text-[#62666D]">Status</p><div className="mt-1"><StatusBadge status={booking.status} /></div></div></div>{booking.notes ? <div className="rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3"><p className="text-[9px] uppercase tracking-wider text-[#62666D]">Notes</p><p className="mt-1 whitespace-pre-wrap text-xs text-[#C9CCD2]">{booking.notes}</p></div> : null}<div className="flex flex-wrap gap-2 border-t border-[#23252A] pt-4">{booking.leadId ? <Button asChild size="sm" variant="outline"><Link href={"/dashboard/leads/" + booking.leadId}><UserRound className="size-4" /> View lead</Link></Button> : null}{booking.conversationId ? <Button asChild size="sm" variant="outline"><Link href={"/dashboard/conversations?conversation=" + booking.conversationId}><ExternalLink className="size-4" /> Conversation</Link></Button> : null}{isActiveBooking(booking.status) ? <Button size="sm" variant="outline" onClick={onReschedule}><Clock className="size-4" /> Reschedule</Button> : null}<div className="ml-auto flex flex-wrap gap-2">{booking.status !== "confirmed" && isActiveBooking(booking.status) ? <Button size="sm" onClick={() => onStatus("confirmed")} disabled={pending}><CheckCircle2 className="size-4" /> Confirm</Button> : null}{isActiveBooking(booking.status) ? <Button size="sm" variant="outline" onClick={() => onStatus("completed")} disabled={pending}>Complete</Button> : null}{isActiveBooking(booking.status) ? <Button size="sm" variant="ghost" className="text-[#EB5757] hover:text-[#EB5757]" onClick={() => onStatus("cancelled")} disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Cancel</Button> : null}</div></div></DialogContent> : null}</Dialog>
}

function Detail({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return <div className="rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3"><div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-[#62666D]"><Icon className="size-3" /> {label}</div><p className="mt-1 text-xs text-[#C9CCD2]">{value}</p></div>
}

function EditorDialog({ open, booking, leads, prefillLeadId, timezone, anchor, onClose, onSaved }: { open: boolean; booking: CalendarBooking | null; leads: Lead[]; prefillLeadId: string | null; timezone: string; anchor: string; onClose: () => void; onSaved: (booking: CalendarBooking) => void }) {
  const initial = booking ? localParts(booking.startAt, timezone) : { date: anchor, time: "09:00" }
  const [leadId, setLeadId] = React.useState(booking?.leadId ?? prefillLeadId ?? "")
  const [name, setName] = React.useState(booking?.visitorName ?? "")
  const [email, setEmail] = React.useState(booking?.visitorEmail ?? "")
  const [phone, setPhone] = React.useState(booking?.visitorPhone ?? "")
  const [service, setService] = React.useState(booking?.service ?? "Consultation")
  const [date, setDate] = React.useState(initial.date)
  const [time, setTime] = React.useState(initial.time)
  const [duration, setDuration] = React.useState(String(booking?.durationMinutes ?? 30))
  const [notes, setNotes] = React.useState(booking?.notes ?? "")
  const [emailReminder, setEmailReminder] = React.useState(booking?.reminderEmailEnabled ?? true)
  const [saving, setSaving] = React.useState(false)


  const selectedLead = leads.find((lead) => lead.id === leadId)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return
    const startAtIso = zonedDateTimeToUtc(date, time, timezone)
    if (!startAtIso) { toast.error("Choose a valid date and time"); return }
    setSaving(true)
    try {
      const result = await saveBookingAction({ id: booking?.id, leadId: leadId || null, startAtIso, durationMinutes: Number(duration), service: service.trim(), visitorName: name.trim(), visitorEmail: email.trim(), visitorPhone: phone.trim(), timezone, notes, reminderEmailEnabled: emailReminder })
      if (!result.ok) { toast.error(result.error); return }
      toast.success(booking ? "Booking rescheduled" : "Booking created")
      onSaved(result.data)
    } finally { setSaving(false) }
  }

  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}><DialogContent className="max-w-2xl border-[#23252A] bg-[#121316]"><DialogHeader><DialogTitle>{booking ? "Reschedule booking" : "Add booking"}</DialogTitle><DialogDescription>Times are saved in UTC and displayed in {timezone}.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="text-[10px] uppercase tracking-wider text-[#62666D]">Linked lead</span><select value={leadId} onChange={(event) => { const id = event.target.value; setLeadId(id); const lead = leads.find((item) => item.id === id); if (lead) { setName(lead.name); setEmail(lead.email); setPhone(lead.phone); setService(lead.service) } }} className="mt-1 h-10 w-full rounded-lg border border-[#23252A] bg-[#0B0C0E] px-3 text-sm text-[#F7F8F8]"><option value="">No linked lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name} · {lead.service}</option>)}</select></label>{!selectedLead ? <><Field label="Visitor name"><Input required value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="Email"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field><Field label="Phone"><Input value={phone} onChange={(event) => setPhone(event.target.value)} /></Field></> : null}<Field label="Service"><Input required value={service} onChange={(event) => setService(event.target.value)} /></Field><Field label="Date"><Input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field><Field label="Time"><Input required type="time" value={time} onChange={(event) => setTime(event.target.value)} /></Field><Field label="Duration"><select value={duration} onChange={(event) => setDuration(event.target.value)} className="h-10 w-full rounded-lg border border-[#23252A] bg-[#0B0C0E] px-3 text-sm text-[#F7F8F8]"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option><option value="120">2 hours</option></select></Field><label className="sm:col-span-2"><span className="text-[10px] uppercase tracking-wider text-[#62666D]">Notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-[#23252A] bg-[#0B0C0E] p-3 text-sm text-[#F7F8F8]" /></label><div className="flex flex-wrap gap-4 sm:col-span-2"><label className="flex items-center gap-2 text-xs text-[#C9CCD2]"><input type="checkbox" checked={emailReminder} onChange={(event) => setEmailReminder(event.target.checked)} className="accent-[#E2E54B]" /> Email reminders</label></div><div className="flex justify-end gap-2 border-t border-[#23252A] pt-4 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <CalendarDays className="size-4" />} {booking ? "Save changes" : "Create booking"}</Button></div></form></DialogContent></Dialog>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="text-[10px] uppercase tracking-wider text-[#62666D]">{label}</span><div className="mt-1">{children}</div></label>
}