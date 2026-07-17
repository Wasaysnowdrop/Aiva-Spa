import type { AuditLog } from "@/lib/supabase/types"

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

const LABELS: Record<string, string> = {
  SUBSCRIPTION_PLAN_CHANGED: "Subscription plan changed",
  UPGRADE_STARTED: "Plan upgrade started",
  TEAM_INVITE_CREATED: "Team invitation created",
  TEAM_INVITE_SENT: "Team invitation sent",
  TEAM_INVITE_DELIVERY_FAILED: "Invitation delivery failed",
  TEAM_INVITE_RESENT: "Team invitation resent",
  TEAM_INVITE_REVOKED: "Team invitation revoked",
  TEAM_INVITE_ACCEPTED: "Team invitation accepted",
  TEAM_MEMBER_ROLE_CHANGED: "Team member role changed",
  TEAM_MEMBER_REMOVED: "Team member removed",
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function parseLegacy(action: string): { key: string; metadata: Record<string, unknown> } {
  const trimmed = action.trim()
  if (/^team\.invited\s+/i.test(trimmed)) {
    const match = trimmed.match(/^team\.invited\s+(.+?)\s+as\s+(.+)$/i)
    return { key: "TEAM_INVITE_SENT", metadata: { email: match?.[1], role: match?.[2] } }
  }
  if (/^team\.role_changed\s+/i.test(trimmed)) {
    const match = trimmed.match(/^team\.role_changed\s+(.+?)\s+->\s+(.+)$/i)
    return { key: "TEAM_MEMBER_ROLE_CHANGED", metadata: { target: match?.[1], to: match?.[2] } }
  }
  if (/^team\.removed\s+/i.test(trimmed)) {
    return { key: "TEAM_MEMBER_REMOVED", metadata: { target: trimmed.replace(/^team\.removed\s+/i, "") } }
  }
  const key = (trimmed.match(/[A-Z][A-Z0-9_.]+/)?.[0] ?? trimmed.split(/\s+/)[0] ?? "ACTIVITY").replaceAll(".", "_")
  const metadata: Record<string, unknown> = {}
  for (const match of trimmed.matchAll(/([a-z_]+)=([^\s]+)/gi)) metadata[match[1]] = match[2]
  return { key, metadata }
}

function inferCategory(key: string, supplied: string): FormattedAuditEvent["category"] {
  if (["team", "billing", "security", "settings"].includes(supplied)) return supplied as FormattedAuditEvent["category"]
  if (key.includes("TEAM_")) return "team"
  if (key.includes("SUBSCRIPTION") || key.includes("PLAN") || key.includes("BILLING")) return "billing"
  if (key.includes("SECURITY") || key.includes("AUTH") || key.includes("ACCESS_DENIED")) return "security"
  return "settings"
}

export function formatAuditEvent(event: Partial<AuditLog> | null | undefined): FormattedAuditEvent {
  try {
    const action = text(event?.action, "Activity recorded")
    const legacy = parseLegacy(action)
    const metadata = { ...legacy.metadata, ...record(event?.metadata) }
    const key = legacy.key.toUpperCase()
    const email = text(metadata.email ?? metadata.recipient)
    const role = text(metadata.role)
    const from = text(metadata.from)
    const to = text(metadata.to)
    const target = text(event?.target ?? metadata.target ?? email, "Workspace")
    let description = text(metadata.description)
    if (!description && key === "SUBSCRIPTION_PLAN_CHANGED") description = `${titleCase(from || "Previous plan")} → ${titleCase(to || "New plan")}`
    if (!description && key.includes("TEAM_INVITE")) description = [email, role && `as ${role}`].filter(Boolean).join(" ")
    if (!description && key === "TEAM_MEMBER_ROLE_CHANGED") description = from && to ? `${from} → ${to}` : `Role changed to ${to || role || "a new role"}`
    if (!description && key === "TEAM_MEMBER_REMOVED") description = target === "Workspace" ? "A team member was removed." : `${target} was removed from the team.`
    if (!description) description = action.includes("=") ? "Workspace activity was recorded." : action
    const rawStatus = text(event?.status, "success").toLowerCase()
    return {
      title: LABELS[key] ?? titleCase(key || "Activity recorded"),
      description,
      actor: text(event?.userName, "System"),
      target,
      category: inferCategory(key, text(event?.category).toLowerCase()),
      timestamp: text(event?.createdAt),
      status: rawStatus === "failed" ? "failed" : rawStatus === "pending" ? "pending" : "success",
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("AUDIT_LOG_FORMAT_FAILED", { error: error instanceof Error ? error.message : String(error) })
    return { title: "Activity recorded", description: "Details are unavailable.", actor: "System", target: "Workspace", category: "settings", timestamp: "", status: "success" }
  }
}

