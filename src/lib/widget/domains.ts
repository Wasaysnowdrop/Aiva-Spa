import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { requireFeatureForUser, assertPlanLimit, EntitlementError } from "@/lib/subscription/entitlements.server"

export type CustomDomainStatus = "pending" | "active" | "disabled"

export type CustomDomain = {
  id: string
  userId: string
  spaId: string
  domain: string
  status: CustomDomainStatus
  verificationToken: string
  verifiedAt: string | null
  lastCheckedAt: string | null
  createdAt: string
  updatedAt: string
}

type RawDomain = {
  id: string
  user_id: string
  spa_id: string
  domain: string
  status: CustomDomainStatus
  verification_token: string
  verified_at: string | null
  last_checked_at: string | null
  created_at: string
  updated_at: string
}

function mapDomain(row: RawDomain): CustomDomain {
  return {
    id: row.id,
    userId: row.user_id,
    spaId: row.spa_id,
    domain: row.domain,
    status: row.status,
    verificationToken: row.verification_token,
    verifiedAt: row.verified_at,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i

export function normalizeDomain(input: string): string | null {
  let v = (input || "").trim().toLowerCase()
  v = v.replace(/^https?:\/\//, "")
  v = v.replace(/\/.*$/, "")
  v = v.replace(/:\d+$/, "")
  v = v.replace(/^www\./, "")
  if (!v || v.length > 253) return null
  if (!HOSTNAME_RE.test(v)) return null
  if (
    v === "localhost" ||
    v.endsWith(".localhost") ||
    v === "aivaspa.online" ||
    v.endsWith(".aivaspa.online")
  ) {
    return null
  }
  return v
}

type CacheEntry = { value: CustomDomain | null; at: number }
const CACHE_TTL_MS = 60_000
const cache = new Map<string, CacheEntry>()

export function invalidateCustomDomainCache(domain?: string) {
  if (domain) cache.delete(domain)
  else cache.clear()
}

export async function resolveCustomDomain(
  hostname: string,
): Promise<CustomDomain | null> {
  const domain = normalizeDomain(hostname)
  if (!domain) return null

  const cached = cache.get(domain)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("custom_domains")
    .select("*")
    .eq("domain", domain)
    .eq("status", "active")
    .maybeSingle()
  if (error) {
    console.error("resolveCustomDomain failed", error)
    return null
  }
  const value = data ? mapDomain(data as RawDomain) : null
  cache.set(domain, { value, at: Date.now() })
  return value
}

export async function listCustomDomains(userId: string): Promise<CustomDomain[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("custom_domains")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) return []
  return (data ?? []).map((r) => mapDomain(r as RawDomain))
}

export type CreateCustomDomainResult =
  | { ok: true; domain: CustomDomain }
  | { ok: false; error: string; code: "invalid" | "duplicate" | "limit" | "plan" }

export async function createCustomDomain(
  userId: string,
  input: { domain: string; spaId: string },
): Promise<CreateCustomDomainResult> {
  const domain = normalizeDomain(input.domain)
  if (!domain) {
    return { ok: false, code: "invalid", error: "Please enter a valid domain (e.g. chat.yourspa.com)." }
  }
  if (!input.spaId) {
    return { ok: false, code: "invalid", error: "spaId is required" }
  }

  let context
  try {
    context = await requireFeatureForUser(userId, "custom_domain")
  } catch (error) {
    if (error instanceof EntitlementError) {
      return { ok: false, code: "plan", error: error.message }
    }
    throw error
  }

  const existing = await listCustomDomains(userId)
  try {
    assertPlanLimit(context, "customDomains", existing.length)
  } catch (error) {
    if (error instanceof EntitlementError) {
      return { ok: false, code: "limit", error: error.message }
    }
    throw error
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("custom_domains")
    .insert({
      user_id: userId,
      spa_id: input.spaId,
      domain,
      status: "pending",
    } as never)
    .select()
    .single()
  if (error) {
    if (error.code === "23505") {
      return { ok: false, code: "duplicate", error: "This domain is already registered." }
    }
    return { ok: false, code: "invalid", error: error.message }
  }
  invalidateCustomDomainCache(domain)
  return { ok: true, domain: mapDomain(data as RawDomain) }
}

export async function deleteCustomDomain(
  userId: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: row, error: fetchErr } = await supabase
    .from("custom_domains")
    .select("domain")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle()
  if (fetchErr) return { ok: false, error: fetchErr.message }
  const { error } = await supabase
    .from("custom_domains")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
  if (error) return { ok: false, error: error.message }
  if (row && (row as { domain?: string }).domain) {
    invalidateCustomDomainCache((row as { domain: string }).domain)
  }
  return { ok: true }
}

export async function activateCustomDomain(
  userId: string,
  id: string,
): Promise<{ ok: boolean; error?: string; domain?: CustomDomain }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("custom_domains")
    .update({
      status: "active",
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  const domain = mapDomain(data as RawDomain)
  invalidateCustomDomainCache(domain.domain)
  return { ok: true, domain }
}
