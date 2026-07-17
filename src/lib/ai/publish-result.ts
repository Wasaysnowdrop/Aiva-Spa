export type SuccessfulPublishResult = {
  ok: true
  success: true
  published: true
  knowledgeBaseId: string
  redirectTo: "/dashboard"
}

export function isSuccessfulPublishResult(value: unknown): value is SuccessfulPublishResult {
  if (!value || typeof value !== "object") return false
  const result = value as Record<string, unknown>
  return (
    result.ok === true &&
    result.success === true &&
    result.published === true &&
    typeof result.knowledgeBaseId === "string" &&
    result.knowledgeBaseId.length > 0 &&
    result.redirectTo === "/dashboard"
  )
}