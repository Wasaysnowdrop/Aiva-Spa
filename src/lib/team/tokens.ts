import { createHash, randomBytes } from "node:crypto"

export function hashInviteToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex")
}

export function generateInviteToken() {
  const rawToken = randomBytes(32).toString("hex")
  return { rawToken, tokenHash: hashInviteToken(rawToken) }
}

