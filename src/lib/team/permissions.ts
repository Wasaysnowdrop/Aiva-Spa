import type { TeamRole } from "@/lib/supabase/types"

export type TeamPermission =
  | "leads:read"
  | "leads:write"
  | "leads:read_assigned"
  | "leads:write_assigned"
  | "conversations:read"
  | "conversations:write"
  | "conversations:reply"
  | "knowledge_base:read"
  | "knowledge_base:write"
  | "widget:manage"
  | "team:manage"
  | "billing:manage"
  | "settings:manage"

export const ROLE_PERMISSIONS: Readonly<Record<TeamRole, readonly TeamPermission[]>> = {
  Owner: [
    "leads:read", "leads:write", "conversations:read", "conversations:write",
    "knowledge_base:read", "knowledge_base:write", "widget:manage", "team:manage",
    "billing:manage", "settings:manage",
  ],
  Manager: [
    "leads:read", "leads:write", "conversations:read", "conversations:write",
    "knowledge_base:read", "knowledge_base:write", "widget:manage", "team:manage",
    "settings:manage",
  ],
  Staff: ["leads:read_assigned", "leads:write_assigned", "conversations:read"],
  Receptionist: ["leads:read", "conversations:read", "conversations:reply"],
}

export function roleCan(role: TeamRole, permission: TeamPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export const TEAM_ROLE_INFO = [
  { value: "Owner" as const, label: "Owner", description: "Full access, billing, and team management." },
  { value: "Manager" as const, label: "Manager", description: "Manage leads, knowledge, widget settings, and the team." },
  { value: "Staff" as const, label: "Staff", description: "View and update assigned leads." },
  { value: "Receptionist" as const, label: "Receptionist", description: "View leads and respond to conversations." },
] as const

export const PERMISSION_LABELS: Record<TeamPermission, string> = {
  "leads:read": "Leads",
  "leads:write": "Edit leads",
  "leads:read_assigned": "Assigned leads",
  "leads:write_assigned": "Update assigned",
  "conversations:read": "Conversations",
  "conversations:write": "Manage chats",
  "conversations:reply": "Reply to chats",
  "knowledge_base:read": "Knowledge base",
  "knowledge_base:write": "Edit knowledge",
  "widget:manage": "Widget",
  "team:manage": "Team",
  "billing:manage": "Billing",
  "settings:manage": "Settings",
}

