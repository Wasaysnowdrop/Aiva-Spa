"use server"

export type ApiKeyScope = "leads:write" | "leads:read" | "webhooks:read" | "webhooks:write"

export type ApiKeyRecord = {
  id: string
  name: string
  keyPrefix: string
  scopes: ApiKeyScope[]
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

export type CreateApiKeyResult =
  | { ok: true; key: ApiKeyRecord; plaintext: string }
  | { ok: false; error: string; errorType: "FEATURE_DISABLED" }

const disabled = {
  ok: false as const,
  error: "The external API is not available.",
  errorType: "FEATURE_DISABLED" as const,
}

export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  return []
}

export async function createApiKeyAction(
  formData: FormData,
): Promise<CreateApiKeyResult> {
  void formData
  return disabled
}

export async function revokeApiKeyAction(
  id: string,
): Promise<{ ok: false; error: string; errorType: "FEATURE_DISABLED" }> {
  void id
  return disabled
}

export async function authenticateApiKey(
  plaintext: string | null | undefined,
): Promise<
  | { ok: true; userId: string; scopes: ApiKeyScope[]; keyId: string }
  | { ok: false; status: number; error: string; errorType: "FEATURE_DISABLED" }
> {
  void plaintext
  return { ...disabled, status: 404 }
}