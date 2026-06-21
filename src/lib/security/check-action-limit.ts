"use server";

/**
 * Per-user server-action rate limit. Wraps an action's body in a
 * check; if the user has exceeded the budget, return a structured
 * `{ ok: false, error }` so the caller can short-circuit.
 *
 * The user identity is resolved automatically from the Supabase
 * session. The IP is best-effort — it comes from `next/headers`, which
 * is only populated inside a real request scope (RSC / server action).
 *
 * Use this at the top of any state-mutating server action that has
 * significant cost (LLM call, email send, DB write, third-party
 * network call).
 */

import { consume, type NamedLimit } from "@/lib/security/limiter"
import { getRequestIpAsync } from "@/lib/security/limiter"
import { createClient } from "@/lib/supabase/server"

export type ActionLimitResult =
  | { ok: true; userId: string }
  | { ok: false; error: string; retryAfterSeconds: number }

export async function checkActionLimit(
  limit: NamedLimit,
  opts: { fallbackIdentity?: string } = {},
): Promise<ActionLimitResult> {
  const ip = await getRequestIpAsync()
  let userId: string | null = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    userId = data.user?.id ?? null
  } catch {
    userId = null
  }
  const identity = userId ?? opts.fallbackIdentity ?? `ip:${ip}`
  const decision = consume(limit, { ip, identity })
  if (decision.limited) {
    const retryAfterSeconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1000))
    return {
      ok: false,
      error: `Too many requests. Please slow down and try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}.`,
      retryAfterSeconds,
    }
  }
  return { ok: true, userId: identity }
}
