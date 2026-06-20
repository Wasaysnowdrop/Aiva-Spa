export type ApiKeyScope =
  | "leads:read"
  | "leads:write"
  | "conversations:read"
  | "webhooks:read"
  | "webhooks:write"

export const ALL_SCOPES: ApiKeyScope[] = [
  "leads:read",
  "leads:write",
  "conversations:read",
  "webhooks:read",
  "webhooks:write",
]

export const API_KEY_PREFIX = "aiva_live_"
export const API_KEY_TEST_PREFIX = "aiva_test_"
