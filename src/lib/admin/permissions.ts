export type AdminRole = "super_admin" | "support_admin" | "billing_admin" | "read_only_admin"
export type AdminPermission = "users:write" | "businesses:write" | "subscriptions:write" | "incidents:write" | "configuration:write"

const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  super_admin: new Set(["users:write", "businesses:write", "subscriptions:write", "incidents:write", "configuration:write"]),
  support_admin: new Set(["users:write", "businesses:write", "incidents:write"]),
  billing_admin: new Set(["subscriptions:write"]),
  read_only_admin: new Set(),
}

export function normalizeAdminRole(value: unknown): AdminRole {
  return value === "support_admin" || value === "billing_admin" || value === "read_only_admin" ? value : "super_admin"
}

export function canAdmin(role: AdminRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role].has(permission)
}
