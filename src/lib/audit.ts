import { createAdminClient } from "@/lib/supabase/admin"

export type AuditEvent = {
  userName: string
  action: string
  userId?: string | null
}

export async function recordAudit(event: AuditEvent): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from("audit_logs").insert({
      user_name: event.userName.slice(0, 200),
      action: event.action.slice(0, 1000),
      user_id: event.userId ?? null,
    } as never)
  } catch (err) {
    // Best-effort logging. Surface the error to the platform log so audit
    // failures are visible, but never block the user action.
    console.error("[audit] failed to record event", {
      action: event.action,
      err: err instanceof Error ? err.message : String(err),
    })
  }
}

export async function recordAuditForUser(
  user: { id?: string; email?: string | null } | null | undefined,
  action: string,
): Promise<void> {
  if (!user) {
    await recordAudit({ userName: "system", action, userId: null })
    return
  }
  const name = (user.email && user.email.split("@")[0]) || user.id || "user"
  await recordAudit({ userName: name, action, userId: user.id ?? null })
}
