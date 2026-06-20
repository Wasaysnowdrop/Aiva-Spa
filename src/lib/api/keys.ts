// Lightweight server-only guard. Equivalent to the `server-only` package, but
// doesn't require the dependency and works in any runtime (Node, edge, tests).
if (typeof window !== "undefined") {
  throw new Error(
    "This module can only be imported on the server. Move the import to a server-only file.",
  )
}

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

import { API_KEY_PREFIX } from "./keys-shared"

export { ALL_SCOPES, API_KEY_PREFIX, type ApiKeyScope } from "./keys-shared"

export const API_KEY_BYTES = 32

export function generateApiKey() {
  const body = randomBytes(API_KEY_BYTES).toString("base64url")
  const full = `${API_KEY_PREFIX}${body}`
  const displayPrefix = full.slice(0, 12) + "…"
  return { full, prefix: displayPrefix, hash: hashApiKey(full) }
}

export function hashApiKey(fullKey: string) {
  return createHash("sha256").update(fullKey, "utf8").digest("hex")
}

export function isLikelyApiKey(value: string) {
  if (!value) return false
  return value.startsWith(API_KEY_PREFIX)
}

export function constantTimeEqual(a: string, b: string) {
  const ab = Buffer.from(a, "utf8")
  const bb = Buffer.from(b, "utf8")
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
