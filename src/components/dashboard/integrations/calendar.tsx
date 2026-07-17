"use client"

import * as React from "react"
import { CalendarDays, Loader2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type DaySchedule = {
  day: number
  open: boolean
  from: string
  to: string
}

type Settings = {
  spaId: string
  bookingDurationMinutes: number
  bufferMinutes: number
  workingHours: { tz: string; schedule: DaySchedule[] }
  reminderOffsetsMinutes: number[]
  enabled: boolean
}

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const defaultSchedule: DaySchedule[] = [
  { day: 0, open: false, from: "09:00", to: "17:00" },
  { day: 1, open: true,  from: "09:00", to: "19:00" },
  { day: 2, open: true,  from: "09:00", to: "19:00" },
  { day: 3, open: true,  from: "09:00", to: "19:00" },
  { day: 4, open: true,  from: "09:00", to: "19:00" },
  { day: 5, open: true,  from: "09:00", to: "19:00" },
  { day: 6, open: true,  from: "09:00", to: "17:00" },
]

export function CustomCalendarSettings({
  initialLocked,
}: {
  initialLocked?: boolean
}) {
  const [, setSettings] = React.useState<Settings | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [locked, setLocked] = React.useState(Boolean(initialLocked))

  const [duration, setDuration] = React.useState(30)
  const [buffer, setBuffer] = React.useState(15)
  const [tz, setTz] = React.useState("America/Los_Angeles")
  const [schedule, setSchedule] = React.useState<DaySchedule[]>(defaultSchedule)
  const [reminderHours, setReminderHours] = React.useState<string>("24, 1")
  const [enabled, setEnabled] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/calendar/settings", { cache: "no-store" })
        if (!res.ok) {
          if (!cancelled) setLoading(false)
          return
        }
        const data = (await res.json()) as {
          settings: Settings
          planAllowsCalendar: boolean
        }
        if (cancelled) return
        setSettings(data.settings)
        setLocked(!data.planAllowsCalendar)
        setDuration(data.settings.bookingDurationMinutes)
        setBuffer(data.settings.bufferMinutes)
        setTz(data.settings.workingHours.tz)
        setSchedule(
          data.settings.workingHours.schedule.length === 7
            ? data.settings.workingHours.schedule
            : defaultSchedule,
        )
        setReminderHours(
          data.settings.reminderOffsetsMinutes
            .map((m) => String(Math.round(m / 60)))
            .join(", "),
        )
        setEnabled(data.settings.enabled)
      } catch {
        // network error — keep defaults
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const toggleDay = (idx: number) => {
    setSchedule((prev) =>
      prev.map((d) => (d.day === idx ? { ...d, open: !d.open } : d)),
    )
  }

  const updateDay = (idx: number, key: "from" | "to", value: string) => {
    setSchedule((prev) =>
      prev.map((d) => (d.day === idx ? { ...d, [key]: value } : d)),
    )
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (locked) {
      toast.error("Custom Calendar is not available on the Starter plan")
      return
    }
    setBusy(true)
    try {
      const offsets = reminderHours
        .split(/[,\s]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
        .map((h) => Math.round(h * 60))
      const res = await fetch("/api/calendar/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingDurationMinutes: duration,
          bufferMinutes: buffer,
          workingHours: { tz, schedule },
          reminderOffsetsMinutes: offsets.length > 0 ? offsets : [1440, 60],
          enabled,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || "Failed to save")
      }
      toast.success("Calendar settings saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
        <div className="flex items-center gap-2 text-xs text-[#8A8F98]">
          <Loader2 className="size-3.5 animate-spin" /> Loading calendar…
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-[#23252A] bg-[#121316]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#23252A] p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-[#23252A] bg-[#0B0C0E] text-lg">
              <CalendarDays className="size-5 text-[#5E6AD2]" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#F7F8F8]">Custom Calendar</p>
              <p className="text-xs text-[#8A8F98]">
                Show live availability in the chat. Bookings are stored in AivaSpa
                and email reminders go out automatically.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            disabled={locked}
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full border transition disabled:opacity-60",
              enabled
                ? "border-[#4CB782]/50 bg-[#4CB782]"
                : "border-[#23252A] bg-[#1A1B1E]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-3.5 rounded-full bg-[#F7F8F8] transition-all",
                enabled ? "left-[18px]" : "left-0.5",
              )}
            />
          </button>
        </div>

        {locked ? (
          <div className="space-y-3 p-5">
            <div className="flex items-start gap-2 rounded-xl border border-[#E2E54B]/30 bg-[#E2E54B]/10 p-3 text-xs text-[#F7F8F8]">
              <CalendarDays className="mt-0.5 size-3.5 shrink-0 text-[#E2E54B]" />
              <div>
                <p className="font-semibold">Custom Calendar is a Growth feature.</p>
                <p className="mt-0.5 text-[#8A8F98]">
                  Upgrade to Growth or Pro to enable live booking slots and
                  automated email reminders.
                </p>
              </div>
            </div>
            <Button asChild size="sm" className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90">
              <a href="/pricing">View plans</a>
            </Button>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={handleSave}
        className={cn("rounded-2xl border border-[#23252A] bg-[#121316]", locked && "opacity-60 pointer-events-none")}
      >
        <div className="border-b border-[#23252A] p-5">
          <h3 className="text-base font-semibold text-[#F7F8F8]">Booking preferences</h3>
          <p className="mt-0.5 text-xs text-[#8A8F98]">
            Controls which slots the widget offers visitors.
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="cal-duration" className="text-xs text-[#8A8F98]">
                Consultation duration (minutes)
              </Label>
              <Input
                id="cal-duration"
                type="number"
                min={5}
                max={240}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Math.max(5, Number(e.target.value) || 30))}
                className="mt-1.5 h-9 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="cal-buffer" className="text-xs text-[#8A8F98]">
                Buffer between appointments (minutes)
              </Label>
              <Input
                id="cal-buffer"
                type="number"
                min={0}
                max={120}
                step={5}
                value={buffer}
                onChange={(e) => setBuffer(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1.5 h-9 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="cal-tz" className="text-xs text-[#8A8F98]">
                Timezone (IANA)
              </Label>
              <Input
                id="cal-tz"
                value={tz}
                onChange={(e) => setTz(e.target.value)}
                placeholder="America/Los_Angeles"
                className="mt-1.5 h-9 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="cal-reminders" className="text-xs text-[#8A8F98]">
                Reminder offsets (hours before, comma-separated)
              </Label>
              <Input
                id="cal-reminders"
                value={reminderHours}
                onChange={(e) => setReminderHours(e.target.value)}
                placeholder="24, 1"
                className="mt-1.5 h-9 text-xs"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-[#8A8F98]">Working days & hours</Label>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {dayLabels.map((label, idx) => {
                const day = schedule.find((d) => d.day === idx) ?? {
                  day: idx,
                  open: false,
                  from: "09:00",
                  to: "17:00",
                }
                return (
                  <div
                    key={label}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-2.5",
                      day.open
                        ? "border-[#5E6AD2]/30 bg-[#5E6AD2]/5"
                        : "border-[#23252A] bg-[#0B0C0E]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={cn(
                        "h-7 w-12 shrink-0 rounded-md border text-[10px] font-semibold transition",
                        day.open
                          ? "border-[#4CB782]/40 bg-[#4CB782]/10 text-[#4CB782]"
                          : "border-[#23252A] bg-[#121316] text-[#62666D]",
                      )}
                    >
                      {day.open ? "Open" : "Closed"}
                    </button>
                    <span className="w-10 text-xs font-semibold text-[#F7F8F8]">{label}</span>
                    <Input
                      type="time"
                      value={day.from}
                      onChange={(e) => updateDay(idx, "from", e.target.value)}
                      className="h-8 w-24 text-xs"
                      disabled={!day.open}
                    />
                    <span className="text-[10px] text-[#62666D]">to</span>
                    <Input
                      type="time"
                      value={day.to}
                      onChange={(e) => updateDay(idx, "to", e.target.value)}
                      className="h-8 w-24 text-xs"
                      disabled={!day.open}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#23252A] p-4">
          <Button
            type="submit"
            size="sm"
            disabled={busy || locked}
            className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save preferences
          </Button>
        </div>
      </form>

      <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
        <h3 className="text-sm font-semibold text-[#F7F8F8]">How it works</h3>
        <ul className="mt-3 space-y-2 text-xs text-[#8A8F98]">
          <li>• Visitors see live available slots in the chat lead form.</li>
          <li>• A confirmed booking creates a Custom Calendar event and notifies your team.</li>
          <li>• Reminders go out by email to the lead automatically.</li>
          <li>• Bookings are visible in <a className="text-[#E2E54B] underline" href="/dashboard/calendar">Calendar</a>.</li>
        </ul>
      </div>
    </div>
  )
}
