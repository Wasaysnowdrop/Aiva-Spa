import type { AuditLog } from "@/lib/supabase/types"
import { formatActivityEvent, type ActivityCategory } from "@/lib/activity/formatter"

export type AuditCategory = "all" | "team" | "billing" | "security" | "settings"

export type FormattedAuditEvent = {
  title: string
  description: string
  actor: string
  target: string
  category: Exclude<AuditCategory, "all">
  timestamp: string
  status: "success" | "failed" | "pending"
}

function auditCategory(category: ActivityCategory): FormattedAuditEvent["category"] {
  if (category === "team" || category === "billing" || category === "security") return category
  return "settings"
}

export function formatAuditEvent(event: Partial<AuditLog> | null | undefined): FormattedAuditEvent {
  const formatted = formatActivityEvent(event)
  return {
    title: formatted.title,
    description: formatted.description ?? "Workspace activity was recorded.",
    actor: formatted.actorName,
    target: formatted.target ?? event?.target ?? "Workspace",
    category: auditCategory(formatted.category),
    timestamp: formatted.timestamp,
    status: formatted.status === "error" ? "failed" : formatted.status === "warning" ? "pending" : "success",
  }
}