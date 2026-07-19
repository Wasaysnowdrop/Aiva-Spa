import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

vi.mock("server-only", () => ({}))

import { inspectWidgetHtml, verifyWidgetInstallation } from "@/lib/widget/verify-installation"

const widgetId = "wgt_current_123"
const publicUrl = "https://93.184.216.34/"

beforeEach(() => vi.restoreAllMocks())
afterEach(() => vi.useRealTimers())

describe("widget installation verification", () => {
  it("finds the exact current-business loader script", async () => {
    const html = `<html><body><script src="https://aivaspa.online/embed/${widgetId}/loader" data-spa-id="${widgetId}" defer></script></body></html>`
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(html, { status: 200, headers: { "content-type": "text/html" } })))
    const result = await verifyWidgetInstallation({ url: publicUrl, widgetId })
    expect(result).toMatchObject({ success: true, status: "installed", scriptFound: true, widgetIdMatched: true })
  })

  it("returns not_found for a normal HTML page without the widget", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html><body><h1>Glow Spa</h1></body></html>", { status: 200, headers: { "content-type": "text/html" } })))
    const result = await verifyWidgetInstallation({ url: publicUrl, widgetId })
    expect(result).toMatchObject({ success: true, status: "not_found", scriptFound: false })
  })

  it("blocks localhost and private network targets before fetch", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect((await verifyWidgetInstallation({ url: "http://127.0.0.1/admin", widgetId })).status).toBe("blocked")
    expect((await verifyWidgetInstallation({ url: "http://10.0.0.5/", widgetId })).status).toBe("blocked")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("warns when the discovered script belongs to another widget", async () => {
    const html = '<script src="https://aivaspa.online/embed/wgt_other/loader" data-spa-id="wgt_other"></script>'
    expect(inspectWidgetHtml(html, widgetId)).toMatchObject({ scriptFound: true, widgetIdMatched: false })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(html, { status: 200, headers: { "content-type": "text/html" } })))
    const result = await verifyWidgetInstallation({ url: publicUrl, widgetId })
    expect(result).toMatchObject({ success: false, status: "mismatch", scriptFound: true, widgetIdMatched: false })
  })

  it("returns a timeout result without crashing", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("fetch", vi.fn((_url, init: RequestInit | undefined) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
    })))
    const pending = verifyWidgetInstallation({ url: publicUrl, widgetId })
    await vi.advanceTimersByTimeAsync(10_001)
    await expect(pending).resolves.toMatchObject({ success: false, status: "timeout" })
  })

  it("removes the developer section and performs a real POST check from Step 3", () => {
    const guide = readFileSync(join(process.cwd(), "src/components/dashboard/guide-view.tsx"), "utf8")
    expect(guide).not.toMatch(/For developers & power users|architecture overview|webhook|widget controls/i)
    expect(guide).not.toMatch(/\bAPI\b/)
    expect(guide).toContain('fetch("/api/widget/verify"')
    expect(guide).toContain('method: "POST"')
    expect(guide).toContain("Checking your site")
  })
})
