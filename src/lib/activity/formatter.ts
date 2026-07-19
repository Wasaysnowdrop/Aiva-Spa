import type { AuditLog } from "@/lib/supabase/types"

export type ActivityCategory = "lead" | "booking" | "team" | "billing" | "setup" | "security" | "widget" | "notification"
export type ActivityStatus = "success" | "warning" | "error" | "info"

export type FormattedActivity = {
  title: string
  description?: string
  category: ActivityCategory
  actorName: string
  timestamp: string
  status: ActivityStatus
  target?: string
}

const INTERNAL_PATTERNS = [
  /setup_assistant_turn/i,
  /internal[._ -](ai|parsing|state|setup)/i,
  /token[._ -]?usage/i,
  /webhook/i,
  /retry/i,
  /state_machine/i,
]

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function plural(value: number, singular: string, pluralValue = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralValue}`
}

export function activityEventKey(event: Partial<AuditLog> | null | undefined): string {
  const metadata = object(event?.metadata)
  const supplied = text(metadata.key)
  if (supplied) return supplied.toUpperCase().replaceAll(".", "_")
  const action = text(event?.action)
  const firstCode = action.match(/[A-Z][A-Z0-9_.]+/)?.[0] ?? action.split(/\s+/)[0] ?? ""
  return firstCode.toUpperCase().replaceAll(".", "_")
}

export function isCustomerFacingActivity(event: Partial<AuditLog> | null | undefined): boolean {
  const action = text(event?.action)
  const key = activityEventKey(event)
  const combined = `${key} ${action}`
  if (INTERNAL_PATTERNS.some((pattern) => pattern.test(combined))) {
    if (process.env.NODE_ENV !== "production") console.info("ACTIVITY_INTERNAL_EVENT_EXCLUDED", { key: key || "unknown" })
    return false
  }
  return [
    "LEAD_", "BOOKING_", "CALENDAR_", "KNOWLEDGE_", "ONBOARDING_FINALIZED",
    "TEAM_INVITE_ACCEPTED", "TEAM_MEMBER_", "SUBSCRIPTION_", "PLAN_", "UPGRADE_",
    "WIDGET_", "NOTIFICATION_",
  ].some((prefix) => key.startsWith(prefix))
}

function legacyMetadata(action: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const match of action.matchAll(/([a-z_]+)=([^\s]+)/gi)) result[match[1]] = match[2]
  return result
}

function categoryFor(key: string): ActivityCategory {
  if (key.startsWith("LEAD_")) return "lead"
  if (key.startsWith("BOOKING_") || key.startsWith("CALENDAR_")) return "booking"
  if (key.startsWith("TEAM_")) return "team"
  if (key.includes("SUBSCRIPTION") || key.includes("PLAN") || key.includes("UPGRADE") || key.includes("BILLING")) return "billing"
  if (key.includes("KNOWLEDGE") || key.includes("ONBOARDING")) return "setup"
  if (key.includes("WIDGET")) return "widget"
  if (key.includes("NOTIFICATION")) return "notification"
  return "security"
}

function statusFor(value: unknown): ActivityStatus {
  const status = text(value).toLowerCase()
  if (status === "failed" || status === "error") return "error"
  if (status === "pending" || status === "warning") return "warning"
  if (status === "info") return "info"
  return "success"
}

export function formatActivityEvent(event: Partial<AuditLog> | null | undefined): FormattedActivity {
  try {
    const action = text(event?.action)
    const metadata = { ...legacyMetadata(action), ...object(event?.metadata) }
    const key = activityEventKey({ ...event, metadata })
    const actorName = text(event?.userName, "System")
    const timestamp = text(event?.createdAt)
    const from = text(metadata.from)
    const to = text(metadata.to)
    const leadName = text(metadata.leadName, "the lead")
    const service = text(metadata.service)
    const target = text(event?.target ?? metadata.target ?? metadata.email)
    let title = "Account activity"
    let description = "An account update was recorded."

    if (key === "SUBSCRIPTION_PLAN_CHANGED") {
      const order: Record<string, number> = { starter: 0, growth: 1, pro: 2 }
      const fromRank = order[from.toLowerCase()]
      const toRank = order[to.toLowerCase()]
      const change = from && to && fromRank !== undefined && toRank !== undefined && toRank > fromRank ? "upgraded" : from && to && fromRank !== undefined && toRank !== undefined && toRank < fromRank ? "changed" : "updated"
      title = to ? `Plan ${change} to ${titleCase(to)}` : "Subscription updated"
      description = from && to ? `The subscription changed from ${titleCase(from)} to ${titleCase(to)}.` : "The subscription plan was updated."
    } else if (key === "UPGRADE_STARTED") {
      title = to ? `Upgrade to ${titleCase(to)} started` : "Plan upgrade started"
      description = "The plan upgrade is being processed."
    } else if (key === "ONBOARDING_FINALIZED" || key === "KNOWLEDGE_BASE_PUBLISHED") {
      const services = Number(metadata.services ?? 0)
      const faqs = Number(metadata.faqs ?? 0)
      const guardrails = Number(metadata.guardrails ?? 0)
      title = key === "KNOWLEDGE_BASE_PUBLISHED" ? "Knowledge base published" : "Knowledge base setup completed"
      description = services || faqs || guardrails
        ? `${plural(services, "service")}, ${plural(faqs, "FAQ")}, and ${plural(guardrails, "safety rule")} were saved.`
        : "The approved business knowledge was saved."
    } else if (key === "LEAD_CAPTURED" || key === "LEAD_CREATED") {
      title = "New lead captured"
      description = service ? `${leadName} is interested in ${service}.` : `${leadName} shared their contact details.`
    } else if (key === "LEAD_ASSIGNED") {
      title = to ? `Lead assigned to ${to}` : "Lead assigned"
      description = `${actorName} assigned the ${service || "new"} lead to ${to || "a team member"}.`
    } else if (key === "LEAD_REASSIGNED") {
      title = to ? `Lead reassigned to ${to}` : "Lead reassigned"
      description = `${actorName} reassigned ${leadName} from ${from || "the previous assignee"} to ${to || "a team member"}.`
    } else if (key === "LEAD_UNASSIGNED") {
      title = "Lead assignment removed"
      description = `${actorName} removed ${from ? `${from}'s` : "the"} assignment from ${leadName}.`
    } else if (key === "LEAD_BOOKED") {
      title = "Consultation booked"
      description = `${leadName} booked${service ? ` a ${service} consultation` : " a consultation"}.`
    } else if (key === "BOOKING_RESCHEDULED") {
      title = "Booking rescheduled"
      description = `${leadName}'s consultation time was updated.`
    } else if (key === "TEAM_INVITE_ACCEPTED") {
      title = "Team invitation accepted"
      description = `${text(metadata.email, "A team member")} joined as ${text(metadata.role, "a team member")}.`
    } else if (key === "WIDGET_INSTALL_VERIFIED" || key === "WIDGET_VERIFIED") {
      title = "Widget installation verified"
      description = `AivaSpa was confirmed on ${text(metadata.checkedUrl, target || "the business website")}.`
    } else if (key === "NOTIFICATION_DELIVERY_FAILED") {
      title = "Email notification needs attention"
      description = "An email notification could not be delivered."
    } else if (key.startsWith("TEAM_INVITE_")) {
      title = key === "TEAM_INVITE_REVOKED" ? "Team invitation revoked" : key === "TEAM_INVITE_RESENT" ? "Team invitation resent" : "Team invitation updated"
      description = [text(metadata.email), text(metadata.role) && `as ${text(metadata.role)}`].filter(Boolean).join(" ") || "The team invitation was updated."
    } else if (key === "TEAM_MEMBER_ROLE_CHANGED") {
      title = "Team member role changed"
      description = from && to ? `${titleCase(from)} → ${titleCase(to)}` : "The team member's role was updated."
    } else if (key === "TEAM_MEMBER_REMOVED") {
      title = "Team member removed"
      description = target ? `${target} was removed from the team.` : "A team member was removed."
    }

    return { title, description, category: categoryFor(key), actorName, timestamp, status: statusFor(event?.status), target: target || undefined }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("ACTIVITY_FORMAT_FAILED", { error: error instanceof Error ? error.message : String(error) })
    return { title: "Account activity", description: "An account update was recorded.", category: "security", actorName: "System", timestamp: "", status: "info" }
  }
}
