"use client"

import * as React from "react"
import { CalendarDays, ChevronRight, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

export type Slot = {
  start: string
  end: string
  startLabel: string
  dateKey: string
}

export type SlotsResponse = {
  ok: boolean
  timezone?: string
  days?: { key: string; label: string; iso: string }[]
  slots?: Slot[]
  durationMinutes?: number
  error?: string
  reason?: string
}

export function TimeSlotPicker({
  spaId,
  value,
  onChange,
  className,
}: {
  spaId: string
  value: string
  onChange: (iso: string, label: string) => void
  className?: string
}) {
  const [data, setData] = React.useState<SlotsResponse | null>(() => null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [activeDay, setActiveDay] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch(
          `/api/calendar/slots?days=7&spaId=${encodeURIComponent(spaId)}`,
          { cache: "no-store" },
        )
        const json = (await r.json()) as SlotsResponse
        if (cancelled) return
        if (!json.ok) {
          setError(json.error || "Calendar unavailable")
          setData(json)
          return
        }
        setData(json)
        if (json.days && json.days.length > 0) {
          setActiveDay((current) => current ?? json.days![0].key)
        }
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load calendar")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [spaId])

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border border-[#23252A] bg-[#0B0C0E] p-3 text-[10px] text-[#8A8F98]", className)}>
        <Loader2 className="size-3 animate-spin" /> Loading availability…
      </div>
    )
  }

  if (!data?.ok || !data.days || data.days.length === 0) {
    return (
      <div className={cn("flex items-start gap-2 rounded-lg border border-[#23252A] bg-[#0B0C0E] p-3 text-[10px] text-[#8A8F98]", className)}>
        <CalendarDays className="mt-0.5 size-3 shrink-0" />
        <div>
          <p className="text-[#F7F8F8]">No live availability</p>
          <p className="mt-0.5">
            {error ||
              "Type a preferred time below and the team will confirm the exact slot."}
          </p>
        </div>
      </div>
    )
  }

  const slots = (data.slots || []).filter((s) => s.dateKey === activeDay)
  const currentDay = data.days.find((d) => d.key === activeDay)

  return (
    <div className={cn("rounded-lg border border-[#23252A] bg-[#0B0C0E] p-2.5", className)}>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8A8F98]">
        <CalendarDays className="size-3 text-[#5E6AD2]" />
        <span>Available times</span>
        {data.durationMinutes ? (
          <span className="ml-auto text-[9px] font-normal normal-case text-[#62666D]">
            {data.durationMinutes} min
          </span>
        ) : null}
      </div>
      <div className="no-scrollbar -mx-1 mb-2 flex gap-1 overflow-x-auto px-1">
        {data.days.map((d) => {
          const active = d.key === activeDay
          const hasSlots = (data.slots || []).some((s) => s.dateKey === d.key)
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setActiveDay(d.key)}
              disabled={!hasSlots}
              className={cn(
                "shrink-0 rounded-md border px-2.5 py-1.5 text-[10px] font-semibold transition",
                active
                  ? "border-[#5E6AD2] bg-[#5E6AD2]/15 text-[#F7F8F8]"
                  : hasSlots
                    ? "border-[#23252A] bg-[#121316] text-[#F7F8F8] hover:border-[#3A3D44]"
                    : "cursor-not-allowed border-[#23252A] bg-[#0B0C0E] text-[#62666D]",
              )}
            >
              {d.label}
            </button>
          )
        })}
      </div>
      {slots.length === 0 ? (
        <p className="py-2 text-center text-[10px] text-[#62666D]">
          No openings on {currentDay?.label}. Try another day.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {slots.map((s) => {
            const active = value === s.start
            return (
              <button
                key={s.start}
                type="button"
                onClick={() => onChange(s.start, `${s.startLabel} · ${currentDay?.label ?? ""}`)}
                className={cn(
                  "flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[10px] font-semibold transition",
                  active
                    ? "border-[#E2E54B] bg-[#E2E54B] text-[#08090A]"
                    : "border-[#23252A] bg-[#121316] text-[#F7F8F8] hover:border-[#3A3D44]",
                )}
              >
                {s.startLabel}
                {active ? <ChevronRight className="size-2.5" /> : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
