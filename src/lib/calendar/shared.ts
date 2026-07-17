export type CalendarBookingStatus =
  | "pending"
  | "booked"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"

export type CalendarBookingSource =
  | "widget"
  | "api"
  | "lead"
  | "manual"
  | "imported"
  | "follow_up"

export type CalendarBooking = {
  id: string
  userId: string
  spaId: string
  leadId: string | null
  conversationId: string | null
  source: CalendarBookingSource
  startAt: string
  endAt: string
  durationMinutes: number
  service: string
  visitorName: string
  visitorEmail: string
  visitorPhone: string
  timezone: string
  notes: string | null
  status: CalendarBookingStatus
  reminderEmailEnabled: boolean
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
  updatedAt: string
}

type DbRecord = Record<string, unknown>

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

export function mapCalendarBooking(row: DbRecord): CalendarBooking {
  return {
    id: stringValue(row.id),
    userId: stringValue(row.user_id ?? row.userId),
    spaId: stringValue(row.spa_id ?? row.spaId),
    leadId: stringValue(row.lead_id ?? row.leadId) || null,
    conversationId: stringValue(row.conversation_id ?? row.conversationId) || null,
    source: stringValue(row.source, "manual") as CalendarBookingSource,
    startAt: stringValue(row.start_at ?? row.startAt),
    endAt: stringValue(row.end_at ?? row.endAt),
    durationMinutes: Number(row.duration_minutes ?? row.durationMinutes ?? 30),
    service: stringValue(row.service, "Consultation"),
    visitorName: stringValue(row.visitor_name ?? row.visitorName, "Guest"),
    visitorEmail: stringValue(row.visitor_email ?? row.visitorEmail),
    visitorPhone: stringValue(row.visitor_phone ?? row.visitorPhone),
    timezone: stringValue(row.timezone, "UTC"),
    notes: stringValue(row.notes) || null,
    status: stringValue(row.status, "confirmed") as CalendarBookingStatus,
    reminderEmailEnabled: Boolean(row.reminder_email_enabled ?? row.reminderEmailEnabled ?? true),
    cancelledAt: stringValue(row.cancelled_at ?? row.cancelledAt) || null,
    cancelReason: stringValue(row.cancel_reason ?? row.cancelReason) || null,
    createdAt: stringValue(row.created_at ?? row.createdAt),
    updatedAt: stringValue(row.updated_at ?? row.updatedAt),
  }
}

export function isActiveBooking(status: CalendarBookingStatus): boolean {
  return status === "pending" || status === "booked" || status === "confirmed"
}
