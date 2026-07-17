"use server"

import { consume, type NamedLimit } from "./limiter"
import { getRequestIpAsync } from "./limiter"
import { createClient } from "@/lib/supabase/server"

/**
 * Result of a rate-limit check inside a server action.
 */
export type ServerActionLimitResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterSeconds: number }

/**
 * Server-action rate-limit helper. Composes a per-user (or per-email)
 * + per-IP limit, fetches the actor from the request scope, and
 * returns a structured result the action can return directly.
 *
 * Usage:
 *
 *   const limit = await checkActionLimit(LIMITS.actionSettings, { email })
 *   if (!limit.ok) return limit
 */
export async function checkActionLimit(
  limit: NamedLimit,
  extra?: { email?: string; identityOverride?: string },
): Promise<ServerActionLimitResult> {
  const ip = await getRequestIpAsync()
  let identity = extra?.identityOverride
  if (!identity && !extra?.email) {
    try {
      const supabase = await createClient()
      const { data } = await supabase.auth.getUser()
      identity = data.user?.id ?? undefined
    } catch {
      identity = undefined
    }
  }
  const decision = consume(limit, {
    ip,
    identity: identity ?? extra?.email ?? ip ?? "unknown",
  })
  if (decision.limited) {
    const retryAfterSeconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1000))
    return {
      ok: false,
      error: `Too many requests. Please slow down and try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}.`,
      retryAfterSeconds,
    }
  }
  return { ok: true }
}
