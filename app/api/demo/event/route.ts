import type { NextRequest } from "next/server"

import { consume, getRequestIp, tooManyRequests } from "@/lib/security/limiter"
import { authenticateDemoSession, recordDemoEvent } from "@/lib/demo/server"
import { demoEventSchema, firstZodError } from "@/lib/demo/schemas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const EVENT_LIMIT = { bucket: "public:demo:event", options: { maxRequests: 90, windowMs: 60_000 } } as const

export async function POST(request: NextRequest) {
  const rate = consume(EVENT_LIMIT, { ip: getRequestIp(request) })
  if (rate.limited) return tooManyRequests(rate)
  const raw = await request.json().catch(() => null)
  const parsed = demoEventSchema.safeParse(raw)
  if (!parsed.success) return Response.json({ ok: false, error: firstZodError(parsed.error) }, { status: 400 })
  const session = await authenticateDemoSession(request).catch(() => null)
  if (!session && parsed.data.eventName !== "DEMO_PAGE_VIEWED") {
    return Response.json({ ok: false, error: "Demo session unavailable." }, { status: 401 })
  }
  await recordDemoEvent(session?.row.id || null, parsed.data.eventName, parsed.data.metadata)
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } })
}

