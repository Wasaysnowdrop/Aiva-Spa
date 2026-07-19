import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { recordAudit } from "@/lib/audit"
import type { WidgetVerificationResult, WidgetVerificationStatus } from "@/lib/widget/verify-installation"

export type StoredWidgetInstallCheck = {
  id: string
  businessId: string
  widgetId: string
  checkedUrl: string
  status: WidgetVerificationStatus
  scriptFound: boolean
  widgetIdMatched: boolean
  failureReason: string | null
  checkedAt: string
}

function mapRow(row: Record<string, unknown>): StoredWidgetInstallCheck {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    widgetId: String(row.widget_id ?? ""),
    checkedUrl: String(row.checked_url ?? ""),
    status: String(row.status ?? "incomplete") as WidgetVerificationStatus,
    scriptFound: Boolean(row.script_found),
    widgetIdMatched: Boolean(row.widget_id_matched),
    failureReason: typeof row.failure_reason === "string" ? row.failure_reason : null,
    checkedAt: String(row.checked_at ?? ""),
  }
}

export async function saveWidgetVerification(input: { businessId: string; actorUserId: string; actorName: string; widgetId: string; result: WidgetVerificationResult }): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from("widget_install_checks").insert({
    business_id: input.businessId,
    widget_id: input.widgetId,
    checked_url: input.result.checkedUrl.slice(0, 2000),
    status: input.result.status,
    script_found: input.result.scriptFound,
    widget_id_matched: input.result.widgetIdMatched,
    failure_reason: input.result.failureReason ?? null,
    checked_at: input.result.checkedAt,
  } as never)
  if (error) throw new Error(error.message)
  await admin.rpc("prune_widget_install_checks" as never, { p_business_id: input.businessId, p_widget_id: input.widgetId, p_keep: 5 } as never)
  if (input.result.status === "installed") {
    await recordAudit({
      userName: input.actorName,
      userId: input.actorUserId,
      actorUserId: input.actorUserId,
      businessId: input.businessId,
      action: "WIDGET_INSTALL_VERIFIED",
      category: "settings",
      targetType: "widget_install",
      targetId: input.widgetId,
      metadata: { key: "WIDGET_INSTALL_VERIFIED", checkedUrl: input.result.checkedUrl, widgetId: input.widgetId },
      status: "success",
    })
  }
}

export async function getLatestWidgetVerification(businessId: string, widgetId?: string): Promise<StoredWidgetInstallCheck | null> {
  const admin = createAdminClient()
  let query = admin.from("widget_install_checks").select("*").eq("business_id", businessId).order("checked_at", { ascending: false }).limit(1)
  if (widgetId) query = query.eq("widget_id", widgetId)
  const { data, error } = await query.maybeSingle()
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function getOwnedWidgetInstall(widgetId: string): Promise<{ businessId: string; active: boolean } | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.from("widget_installs").select("user_id, active").eq("widget_key", widgetId).maybeSingle()
  if (error || !data) return null
  const row = data as { user_id: string; active: boolean }
  return { businessId: row.user_id, active: row.active }
}
