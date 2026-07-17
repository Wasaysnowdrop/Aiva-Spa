import { createClient } from "@/lib/supabase/server"
import { getEntitlementContextForUser, assertPlanLimit, EntitlementError } from "@/lib/subscription/entitlements.server"
import { PLANS } from "@/lib/subscription/plans"

export type WidgetInstall = {
  id: string
  userId: string
  widgetKey: string
  domain: string
  label: string
  active: boolean
  lastSeenAt: string | null
  createdAt: string
  updatedAt: string
}

type RawInstall = {
  id: string
  user_id: string
  widget_key: string
  domain: string
  label: string
  active: boolean
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

function mapInstall(row: RawInstall): WidgetInstall {
  return {
    id: row.id,
    userId: row.user_id,
    widgetKey: row.widget_key,
    domain: row.domain,
    label: row.label ?? "",
    active: row.active,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeDomain(input: string) {
  let v = input.trim().toLowerCase()
  v = v.replace(/^https?:\/\//, "")
  v = v.replace(/\/.*$/, "")
  v = v.replace(/^www\./, "")
  return v
}

export async function listWidgetInstalls(userId: string): Promise<WidgetInstall[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("widget_installs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) return []
  return (data ?? []).map((r) => mapInstall(r as RawInstall))
}

export type CreateInstallResult =
  | { ok: true; install: WidgetInstall }
  | { ok: false; error: string; code: "limit" | "duplicate" | "no_active_subscription" | "invalid" }

function makeWidgetKey() {
  return (
    "wgt_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 10)
  )
}

export async function createWidgetInstall(
  userId: string,
  input: { domain: string; label?: string },
): Promise<CreateInstallResult> {
  const domain = normalizeDomain(input.domain ?? "")
  if (!domain || !domain.includes(".")) {
    return { ok: false, code: "invalid", error: "Please enter a valid domain (e.g. yourmedspa.com)." }
  }

  const context = await getEntitlementContextForUser(userId)
  const subscription = context.subscription
  if (!subscription.isActive) {
    return {
      ok: false,
      code: "no_active_subscription",
      error: "You need an active subscription to add a new widget install.",
    }
  }
  const existing = await listWidgetInstalls(userId)
  const activeCount = existing.filter((i) => i.active).length
  try {
    assertPlanLimit(context, "widgets", activeCount)
  } catch (error) {
    if (error instanceof EntitlementError) {
      return { ok: false, code: "limit", error: error.message }
    }
    throw error
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("widget_installs")
    .insert({
      user_id: userId,
      widget_key: makeWidgetKey(),
      domain,
      label: input.label?.trim() || domain,
      active: true,
    } as never)
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { ok: false, code: "duplicate", error: "This domain is already installed." }
    }
    return { ok: false, code: "invalid", error: error.message }
  }

  return { ok: true, install: mapInstall(data as RawInstall) }
}

export async function deleteWidgetInstall(
  userId: string,
  installId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("widget_installs")
    .delete()
    .eq("id", installId)
    .eq("user_id", userId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function touchWidgetInstall(widgetKey: string) {
  const supabase = await createClient()
  await supabase
    .from("widget_installs")
    .update({ last_seen_at: new Date().toISOString() } as never)
    .eq("widget_key", widgetKey)
}

export type WidgetUsageSummary = {
  planName: string
  planId: string
  maxWidgets: number
  maxLocations: number
  used: number
  remaining: number | null
  unlimited: boolean
}

export async function getWidgetUsageSummary(userId: string): Promise<WidgetUsageSummary> {
  const context = await getEntitlementContextForUser(userId)
  const subscription = context.subscription
  const plan = PLANS[subscription.planId]
  const installs = await listWidgetInstalls(userId)
  const active = installs.filter((i) => i.active).length
  const unlimited = plan.maxWidgets === Number.MAX_SAFE_INTEGER
  return {
    planName: plan.name,
    planId: plan.id,
    maxWidgets: plan.maxWidgets,
    maxLocations: plan.maxLocations,
    used: active,
    remaining: unlimited ? null : Math.max(0, plan.maxWidgets - active),
    unlimited,
  }
}
