import { beforeEach, describe, expect, it, vi } from "vitest"

import { hashApiKey, generateApiKey } from "@/lib/api/keys"
import { installSupabaseMocks } from "./helpers/mock-supabase"

beforeEach(() => {
  vi.resetModules()
})

const baseKeyRow = {
  id: "key_1",
  user_id: "u_1",
  scopes: ["leads:write"],
  revoked_at: null,
  expires_at: null,
}

describe("createApiKeyAction", () => {
  it("rejects when name is empty", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    const { createApiKeyAction } = await import("@/app/actions/api-keys")
    const fd = new FormData()
    fd.set("name", "   ")
    fd.append("scopes", "leads:write")
    const result = await createApiKeyAction(fd)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/name/i)
    }
  })

  it("rejects when no scopes are selected", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    const { createApiKeyAction } = await import("@/app/actions/api-keys")
    const fd = new FormData()
    fd.set("name", "Production")
    const result = await createApiKeyAction(fd)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/scope/i)
    }
  })

  it("inserts the key and returns the plaintext once", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("api_keys", "insert", {
      data: [
        {
          id: "key_new",
          name: "Production",
          key_prefix: "aiva_live_…",
          scopes: ["leads:write"],
          last_used_at: null,
          expires_at: null,
          revoked_at: null,
          created_at: "2024-01-01T00:00:00Z",
        },
      ],
      error: null,
    })

    const { createApiKeyAction } = await import("@/app/actions/api-keys")
    const fd = new FormData()
    fd.set("name", "Production")
    fd.append("scopes", "leads:write")
    const result = await createApiKeyAction(fd)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.key.id).toBe("key_new")
      expect(result.plaintext.startsWith("aiva_live_")).toBe(true)
    }

    const insert = server
      .getCalls()
      .find((c) => c.table === "api_keys" && c.op === "insert")
    expect(insert).toBeDefined()
    const payload = insert!.args[0] as {
      name: string
      key_prefix: string
      key_hash: string
      scopes: string[]
    }
    expect(payload.name).toBe("Production")
    expect(payload.key_prefix).toMatch(/^aiva_live_/)
    expect(payload.key_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(payload.scopes).toEqual(["leads:write"])
  })
})

describe("revokeApiKeyAction", () => {
  it("sets revoked_at to a timestamp", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("api_keys", "update", { data: null, error: null })

    const { revokeApiKeyAction } = await import("@/app/actions/api-keys")
    const result = await revokeApiKeyAction("key_1")
    expect(result.ok).toBe(true)
    const update = server
      .getCalls()
      .find((c) => c.table === "api_keys" && c.op === "update")
    const payload = update!.args[0] as { revoked_at: string }
    expect(typeof payload.revoked_at).toBe("string")
    expect(new Date(payload.revoked_at).getTime()).toBeLessThanOrEqual(Date.now())
  })
})

describe("authenticateApiKey", () => {
  it("returns 401 when no key is provided", async () => {
    installSupabaseMocks()
    const { authenticateApiKey } = await import("@/app/actions/api-keys")
    const result = await authenticateApiKey(null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
    }
  })

  it("returns 401 when the key does not have the right prefix", async () => {
    installSupabaseMocks()
    const { authenticateApiKey } = await import("@/app/actions/api-keys")
    const result = await authenticateApiKey("bearer_token")
    expect(result.ok).toBe(false)
  })

  it("returns ok=true with the userId + scopes on a valid, unrevoked key", async () => {
    const { server } = installSupabaseMocks()
    const { full, hash } = generateApiKey()
    server.setResult("api_keys", "select", {
      data: [{ ...baseKeyRow, key_hash: hash }],
      error: null,
    })
    const { authenticateApiKey } = await import("@/app/actions/api-keys")
    const result = await authenticateApiKey(full)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.userId).toBe("u_1")
      expect(result.scopes).toEqual(["leads:write"])
    }
  })

  it("returns 401 when the key has been revoked", async () => {
    const { server } = installSupabaseMocks()
    const { full, hash } = generateApiKey()
    server.setResult("api_keys", "select", {
      data: [{ ...baseKeyRow, key_hash: hash, revoked_at: "2024-01-01T00:00:00Z" }],
      error: null,
    })
    const { authenticateApiKey } = await import("@/app/actions/api-keys")
    const result = await authenticateApiKey(full)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error).toMatch(/revoked/i)
    }
  })

  it("returns 401 when the key has expired", async () => {
    const { server } = installSupabaseMocks()
    const { full, hash } = generateApiKey()
    server.setResult("api_keys", "select", {
      data: [{ ...baseKeyRow, key_hash: hash, expires_at: "2000-01-01T00:00:00Z" }],
      error: null,
    })
    const { authenticateApiKey } = await import("@/app/actions/api-keys")
    const result = await authenticateApiKey(full)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/expired/i)
    }
  })

  it("returns 401 when the key hash is not in the table", async () => {
    const { server } = installSupabaseMocks()
    server.setResult("api_keys", "select", { data: null, error: null })
    const { authenticateApiKey } = await import("@/app/actions/api-keys")
    const result = await authenticateApiKey("aiva_live_nope")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error).toMatch(/invalid/i)
    }
  })

  it("uses the same hash as hashApiKey()", async () => {
    const { full, hash } = generateApiKey()
    expect(hashApiKey(full)).toBe(hash)
  })
})
