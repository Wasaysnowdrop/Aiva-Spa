import "server-only"

import { headers } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"

export async function recordAdminAction(input: {
  adminId: string
  adminEmail: string | null
  action: string
  target?: string | null
  metadata?: Record<string, unknown>
}) {
  const requestHeaders = await headers()
  const admin = createAdminClient()
  const { error } = await admin.from("admin_audit_log").insert({
    admin_user_id: input.adminId,
    admin_email: input.adminEmail ?? "unknown-admin",
    action: input.action,
    target: input.target ?? null,
    metadata: input.metadata ?? {},
    ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
  } as never)
  if (error) throw new Error("The action completed, but its audit record could not be saved.")
}
