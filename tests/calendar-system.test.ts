import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import {
  addCalendarDays,
  dateKeyInTimeZone,
  monthGrid,
  startOfWeek,
  zonedDateTimeToUtc,
} from "@/lib/calendar/date"
import { isActiveBooking, mapCalendarBooking } from "@/lib/calendar/shared"

describe("calendar timezone utilities", () => {
  it("converts a Los Angeles business time to UTC during daylight saving", () => {
    expect(zonedDateTimeToUtc("2026-07-23", "14:00", "America/Los_Angeles"))
      .toBe("2026-07-23T21:00:00.000Z")
  })

  it("uses the business timezone when assigning a booking to a date", () => {
    expect(dateKeyInTimeZone("2026-07-24T01:00:00.000Z", "America/Los_Angeles"))
      .toBe("2026-07-23")
  })

  it("builds stable month and week navigation ranges", () => {
    expect(startOfWeek("2026-07-17")).toBe("2026-07-12")
    expect(addCalendarDays("2026-07-17", 7)).toBe("2026-07-24")
    const grid = monthGrid("2026-07-17")
    expect(grid).toHaveLength(42)
    expect(grid[0]).toBe("2026-06-28")
  })
})

describe("calendar booking mapping", () => {
  it("maps persisted booking rows for realtime rendering", () => {
    const booking = mapCalendarBooking({
      id: "booking-1",
      user_id: "owner-1",
      spa_id: "spa-1",
      lead_id: "lead-1",
      source: "lead",
      start_at: "2026-07-23T21:00:00.000Z",
      end_at: "2026-07-23T21:30:00.000Z",
      duration_minutes: 30,
      service: "Botox",
      visitor_name: "Visitor",
      timezone: "America/Los_Angeles",
      status: "confirmed",
      reminder_email_enabled: true,
      reminder_sms_enabled: false,
    })
    expect(booking).toMatchObject({
      id: "booking-1",
      userId: "owner-1",
      leadId: "lead-1",
      service: "Botox",
      reminderEmailEnabled: true,
      reminderSmsEnabled: false,
    })
    expect(isActiveBooking(booking.status)).toBe(true)
    expect(isActiveBooking("cancelled")).toBe(false)
  })
})

describe("calendar migration contract", () => {
  const migration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/00032_complete_calendar_system.sql"),
    "utf8",
  )

  it("enforces ownership, relationship validation, and one active booking per lead", () => {
    expect(migration).toContain("add column if not exists user_id uuid")
    expect(migration).toContain("validate_calendar_booking_owner")
    expect(migration).toContain("BOOKING_LEAD_OWNERSHIP_MISMATCH")
    expect(migration).toContain("calendar_bookings_one_active_per_lead")
    expect(migration).toContain("auth.uid() = user_id")
  })

  it("syncs exact booked lead times and cancels lost or deleted leads", () => {
    expect(migration).toContain("sync_lead_calendar_booking")
    expect(migration).toContain("new.status = 'lost'")
    expect(migration).toContain("new.status <> 'booked'")
    expect(migration).toContain("try_parse_calendar_timestamp")
  })

  it("queues only enabled reminders for active future bookings", () => {
    expect(migration).toContain("sync_calendar_booking_reminders")
    expect(migration).toContain("new.reminder_email_enabled")
    expect(migration).toContain("new.reminder_sms_enabled")
    expect(migration).toContain("new.start_at <= now()")
  })
  it("validates settings and reminder relationships, not only caller ownership", () => {
    const integrityMigration = readFileSync(
      resolve(process.cwd(), "supabase/migrations/00033_calendar_relationship_integrity.sql"),
      "utf8",
    )
    expect(integrityMigration).toContain("validate_calendar_settings_owner")
    expect(integrityMigration).toContain("CALENDAR_SETTINGS_SPA_OWNERSHIP_MISMATCH")
    expect(integrityMigration).toContain("validate_calendar_reminder_owner")
    expect(integrityMigration).toContain("CALENDAR_REMINDER_BOOKING_OWNERSHIP_MISMATCH")
  })
})

describe("Settings API cleanup", () => {
  it("keeps API key management and removes the outgoing webhook UI", () => {
    const apiSection = readFileSync(
      resolve(process.cwd(), "src/components/dashboard/api-section.tsx"),
      "utf8",
    )
    const settings = readFileSync(
      resolve(process.cwd(), "src/components/dashboard/settings-view.tsx"),
      "utf8",
    )
    expect(apiSection).toContain("Generate key")
    expect(apiSection).not.toContain("Outgoing webhooks")
    expect(apiSection).not.toContain("Add endpoint")
    expect(settings).toContain('label: "API"')
    expect(settings).not.toContain('label: "API & webhooks"')
  })
})
