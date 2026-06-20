import { createClient } from "@/lib/supabase/client"
import type { WidgetConfig, WidgetPosition } from "@/lib/supabase/types"
import { mapWidgetConfig } from "@/lib/supabase/types"

export type WidgetConfigUpdate = {
  brandName?: string
  logoInitial?: string
  bubbleLogoUrl?: string | null
  primaryColor?: string
  position?: WidgetPosition
  welcomeMessage?: string
  proactiveEnabled?: boolean
  proactiveDelaySeconds?: number
  proactiveMessage?: string
  showBranding?: boolean
  collectEmail?: boolean
  collectPhone?: boolean
  consentText?: string
  workingHours?: WidgetConfig["workingHours"]
  extendedKb?: Record<string, unknown>
}

function toSnake(update: Partial<WidgetConfigUpdate>): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if ("brandName" in update) payload.brand_name = update.brandName
  if ("logoInitial" in update) payload.logo_initial = update.logoInitial
  if ("bubbleLogoUrl" in update) payload.bubble_logo_url = update.bubbleLogoUrl
  if ("primaryColor" in update) payload.primary_color = update.primaryColor
  if ("position" in update) payload.position = update.position
  if ("welcomeMessage" in update) payload.welcome_message = update.welcomeMessage
  if ("proactiveEnabled" in update) payload.proactive_enabled = update.proactiveEnabled
  if ("proactiveDelaySeconds" in update)
    payload.proactive_delay_seconds = update.proactiveDelaySeconds
  if ("proactiveMessage" in update) payload.proactive_message = update.proactiveMessage
  if ("showBranding" in update) payload.show_branding = update.showBranding
  if ("collectEmail" in update) payload.collect_email = update.collectEmail
  if ("collectPhone" in update) payload.collect_phone = update.collectPhone
  if ("consentText" in update) payload.consent_text = update.consentText
  if ("workingHours" in update) payload.working_hours = update.workingHours as unknown as Record<string, unknown>
  if ("extendedKb" in update) payload.extended_kb = update.extendedKb ?? {}
  return payload
}

export async function getWidgetConfig(): Promise<WidgetConfig | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("widget_config")
    .select("*")
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapWidgetConfig(data as Record<string, unknown>) : null
}

export async function updateWidgetConfig(
  update: WidgetConfigUpdate,
): Promise<WidgetConfig> {
  const supabase = createClient()
  const existing = await getWidgetConfig()
  if (!existing) throw new Error("No widget config found")

  const { data, error } = await supabase
    .from("widget_config")
    .update(toSnake(update) as never)
    .eq("id", existing.id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapWidgetConfig(data as Record<string, unknown>)
}
