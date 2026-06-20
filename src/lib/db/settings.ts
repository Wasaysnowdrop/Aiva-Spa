import { createClient } from "@/lib/supabase/client"
import type {
  SpaSettings,
  IntegrationConfig,
  AuditLog,
} from "@/lib/supabase/types"
import {
  mapSpaSettings,
  mapIntegrationConfig,
  mapAuditLog,
} from "@/lib/supabase/types"

// --- Spa Settings ---

export type SpaSettingsUpdate = {
  spaName?: string
  website?: string
  ownerName?: string
  ownerEmail?: string
  address?: string
}

export async function getSpaSettings(): Promise<SpaSettings | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("spa_settings")
    .select("*")
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapSpaSettings(data as Record<string, unknown>) : null
}

export async function updateSpaSettings(
  update: SpaSettingsUpdate,
): Promise<SpaSettings> {
  const supabase = createClient()
  const existing = await getSpaSettings()
  if (!existing) throw new Error("No spa settings found")

  const payload: Record<string, unknown> = {}
  if ("spaName" in update) payload.spa_name = update.spaName
  if ("website" in update) payload.website = update.website
  if ("ownerName" in update) payload.owner_name = update.ownerName
  if ("ownerEmail" in update) payload.owner_email = update.ownerEmail
  if ("address" in update) payload.address = update.address

  const { data, error } = await supabase
    .from("spa_settings")
    .update(payload as never)
    .eq("id", existing.id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapSpaSettings(data as Record<string, unknown>)
}

// --- Integrations ---

export async function getIntegrations(): Promise<IntegrationConfig[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("integrations_config")
    .select("*")
    .order("name")

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    mapIntegrationConfig(row as Record<string, unknown>),
  )
}

// --- Audit Logs ---

export async function getAuditLogs(): Promise<AuditLog[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    mapAuditLog(row as Record<string, unknown>),
  )
}

export async function createAuditLog(
  userName: string,
  action: string,
): Promise<AuditLog> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("audit_logs")
    .insert({ user_name: userName, action } as never)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapAuditLog(data as Record<string, unknown>)
}
