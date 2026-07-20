import type { NextRequest } from "next/server"

import { consume, getRequestIp, tooManyRequests } from "@/lib/security/limiter"
import {
  authenticateDemoSession,
  clearDemoCookieValue,
  createDemoSession,
  demoCookieValue,
  loadDemoState,
  looksAutomated,
  recordDemoEvent,
} from "@/lib/demo/server"
import { demoSessionSchema, firstZodError } from "@/lib/demo/schemas"
import { getDemoScenario, publicScenario } from "@/lib/demo/scenarios"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const START_LIMIT = { bucket: "public:demo:start", options: { maxRequests: 6, windowMs: 60 * 60_000 } } as const

const privateHeaders = {
  "cache-control": "no-store, private",
  pragma: "no-cache",
  "x-robots-tag": "noindex, nofollow, noarchive",
}

export async function GET(request: NextRequest) {
  try {
    const session = await authenticateDemoSession(request)
    if (!session) {
      return Response.json({ ok: false, errorType: "INVALID_OR_EXPIRED_SESSION" }, {
        status: 401,
        headers: { ...privateHeaders, "set-cookie": clearDemoCookieValue() },
      })
    }
    return Response.json({ ok: true, ...(await loadDemoState(session)) }, { headers: privateHeaders })
  } catch (error) {
    console.error("[demo-session] restore failed", error)
    return Response.json({ ok: false, error: "The demo session could not be restored." }, { status: 503, headers: privateHeaders })
  }
}

export async function POST(request: NextRequest) {
  const rate = consume(START_LIMIT, { ip: getRequestIp(request) })
  if (rate.limited) return tooManyRequests(rate, privateHeaders, "Please wait before starting another demo.")

  try {
    const existing = await authenticateDemoSession(request)
    if (existing && existing.row.status === "active") {
      return Response.json({ ok: true, restored: true, ...(await loadDemoState(existing)) }, { headers: privateHeaders })
    }

    if (process.env.NODE_ENV === "production" && looksAutomated(request)) {
      await recordDemoEvent(null, "DEMO_ABUSE_BLOCKED", { reason: "automated_client" })
      return Response.json({ ok: false, error: "The interactive demo is available in a standard web browser." }, { status: 403, headers: privateHeaders })
    }

    const raw = await request.json().catch(() => null)
    const parsed = demoSessionSchema.safeParse(raw)
    if (!parsed.success) {
      return Response.json({ ok: false, error: firstZodError(parsed.error) }, { status: 400, headers: privateHeaders })
    }

    const created = await createDemoSession({ request, ...parsed.data })
    const scenario = getDemoScenario(parsed.data.scenarioId)
    return Response.json({
      ok: true,
      restored: false,
      session: { id: created.id, status: "active", messageCount: 0, maxMessages: 12, leadCreated: false, salesLeadCreated: false, completionPercentage: 10, currentStep: "scenario", expiresAt: created.expiresAt },
      scenario: publicScenario(scenario),
      messages: [],
      lead: null,
    }, {
      status: 201,
      headers: { ...privateHeaders, "set-cookie": demoCookieValue(created.id, created.token) },
    })
  } catch (error) {
    console.error("[demo-session] start failed", error)
    return Response.json({ ok: false, error: "The demo could not start. Please try again." }, { status: 503, headers: privateHeaders })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await authenticateDemoSession(request).catch(() => null)
  if (session) await recordDemoEvent(session.row.id, "DEMO_COMPLETED", { restart: true })
  return Response.json({ ok: true }, { headers: { ...privateHeaders, "set-cookie": clearDemoCookieValue() } })
}

