"use client"

import * as React from "react"
import {
  CalendarDays,
  Clock,
  Loader2,
  Mail,
  Phone,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn, formatDateTime } from "@/lib/utils"
import { toast } from "sonner"
import { useRealtimeSubscription } from "@/lib/hooks/use-realtime"

type Booking = {
  id: string
  spaId: string
  leadId: string | null
  source: "widget" | "api" | "lead" | "manual"
  startAt: string
  endAt: string
  durationMinutes: number
  service: string
  notes: string | null
  status: "confirmed" | "cancelled" | "completed" | "no_show"
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
  updatedAt: string
}

type Lead = {
  id: string
  name: string
  email: string
  phone: string
}

function groupByDay(bookings: Booking[]): Map<string, Booking[]> {
  const map = new Map<string, Booking[]>()
  for (const b of bookings) {
    const key = b.startAt.slice(0, 10)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(b)
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.startAt.localeCompare(b.startAt))
  }
  return map
}

function formatDayLabel(key: string): string {
  const d = new Date(`${key}T00:00:00`)
  if (Number.isNaN(d.getTime())) return key
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function CalendarView({
  initialBookings,
}: {
  spaId: string
  initialBookings: Booking[]
}) {
  const { data: bookings, setData } = useRealtimeSubscription<Booking>({
    table: "calendar_bookings",
    initialData: initialBookings,
    getId: (b) => b.id,
  })
  const { data: leads } = useRealtimeSubscription<Lead>({
    table: "leads",
    initialData: [],
    getId: (l) => l.id,
  })
  const [cancelling, setCancelling] = React.useState<string | null>(null)

  const leadById = React.useMemo(() => {
    const m = new Map<string, Lead>()
    for (const l of leads) m.set(l.id, l)
    return m
  }, [leads])

  const upcoming = React.useMemo(
    () => bookings.filter((b) => b.status !== "cancelled"),
    [bookings],
  )
  const groups = React.useMemo(() => groupByDay(upcoming), [upcoming])
  const dayKeys = React.useMemo(
    () => Array.from(groups.keys()).sort(),
    [groups],
  )

  const handleCancel = async (id: string) => {
    setCancelling(id)
    try {
      const res = await fetch("/api/calendar/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, reason: "Cancelled from dashboard" }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || "Failed to cancel")
      }
      toast.success("Booking cancelled")
      setData((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                status: "cancelled",
                cancelledAt: new Date().toISOString(),
              }
            : b,
        ),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel")
    } finally {
      setCancelling(null)
    }
  }

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F7F8F8]">Calendar</h1>
          <p className="mt-1 text-sm text-[#8A8F98]">
            Upcoming bookings captured by the chat widget. Reminders go out
            automatically by email and SMS.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#23252A] bg-[#121316] px-3 py-1.5 text-[11px] text-[#8A8F98]">
          <CalendarDays className="size-3 text-[#5E6AD2]" />
          {upcoming.length} upcoming
        </div>
      </div>

      {dayKeys.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#23252A] bg-[#121316] p-10 text-center">
          <CalendarDays className="mx-auto size-8 text-[#5E6AD2]" />
          <p className="mt-3 text-sm font-semibold text-[#F7F8F8]">
            No bookings yet
          </p>
          <p className="mt-1 text-xs text-[#8A8F98]">
            When visitors pick a time slot in the chat, their booking shows up
            here automatically.
          </p>
        </div>
      ) : null}

      {dayKeys.map((key) => {
        const list = groups.get(key) ?? []
        return (
          <section
            key={key}
            className="rounded-2xl border border-[#23252A] bg-[#121316]"
          >
            <div className="flex items-center justify-between border-b border-[#23252A] p-4">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-[#5E6AD2]/10 text-[#5E6AD2]">
                  <CalendarDays className="size-4" />
                </span>
                <h2 className="text-sm font-semibold text-[#F7F8F8]">
                  {formatDayLabel(key)}
                </h2>
              </div>
              <span className="rounded-md border border-[#23252A] bg-[#0B0C0E] px-2 py-0.5 text-[10px] font-mono text-[#8A8F98]">
                {list.length} booking{list.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="divide-y divide-[#23252A]">
              {list.map((b) => {
                const lead = b.leadId ? leadById.get(b.leadId) : null
                return (
                  <li
                    key={b.id}
                    className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[120px_minmax(0,1fr)_auto] md:items-center"
                  >
                    <div className="flex items-center gap-2 text-sm text-[#F7F8F8]">
                      <Clock className="size-3.5 text-[#5E6AD2]" />
                      <div>
                        <p className="font-semibold">
                          {formatDateTime(b.startAt).split(",").slice(1).join(",").trim()}
                        </p>
                        <p className="text-[10px] text-[#8A8F98]">
                          {b.durationMinutes} min · {b.service}
                        </p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#F7F8F8]">
                        {lead?.name ?? b.notes ?? "Anonymous booking"}
                      </p>
                      {lead ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#8A8F98]">
                          {lead.email ? (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="size-2.5" /> {lead.email}
                            </span>
                          ) : null}
                          {lead.phone ? (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="size-2.5" /> {lead.phone}
                            </span>
                          ) : null}
                          <span className="rounded-md border border-[#23252A] bg-[#0B0C0E] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#8A8F98]">
                            {b.source}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          b.status === "confirmed"
                            ? "border-[#4CB782]/30 bg-[#4CB782]/10 text-[#4CB782]"
                            : b.status === "cancelled"
                              ? "border-[#EB5757]/30 bg-[#EB5757]/10 text-[#EB5757]"
                              : "border-[#62666D]/30 bg-[#62666D]/10 text-[#8A8F98]",
                        )}
                      >
                        {b.status}
                      </span>
                      {b.status === "confirmed" ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          disabled={cancelling === b.id}
                          onClick={() => handleCancel(b.id)}
                          className="text-[#EB5757] hover:bg-[#EB5757]/10 hover:text-[#EB5757]"
                        >
                          {cancelling === b.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <X className="size-3" />
                          )}
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
