import { describe, expect, it } from "vitest"

describe("retired API key actions", () => {
  it("does not list or create credentials", async () => {
    const { listApiKeys, createApiKeyAction } = await import("@/app/actions/api-keys")
    expect(await listApiKeys()).toEqual([])
    const result = await createApiKeyAction(new FormData())
    expect(result).toMatchObject({ ok: false, errorType: "FEATURE_DISABLED" })
  })

  it("rejects revoke and authentication attempts with a controlled result", async () => {
    const { revokeApiKeyAction, authenticateApiKey } = await import("@/app/actions/api-keys")
    await expect(revokeApiKeyAction("legacy")).resolves.toMatchObject({
      ok: false,
      errorType: "FEATURE_DISABLED",
    })
    await expect(authenticateApiKey("aiva_live_legacy")).resolves.toMatchObject({
      ok: false,
      status: 404,
      errorType: "FEATURE_DISABLED",
    })
  })
})
