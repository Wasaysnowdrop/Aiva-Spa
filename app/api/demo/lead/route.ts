import type { NextRequest } from "next/server"

import { authenticateDemoSession, recordDemoEvent } from "@/lib/demo/server"
import { demoTestLeadSchema, firstZodError } from "@/lib/demo/schemas"
import { getDemoScenario } from "@/lib/demo/scenarios"
import { createAdminClient } from "@/lib/supabase/admin"
import { consume, getRequestIp, tooManyRequests } from "@/lib/security/limiter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LEAD_LIMIT = { bucket: "public:demo:test-lead", options: { maxRequests: 8, windowMs: 60 * 60_000 } } as const
const privateHeaders = { "cache-control": "no-store, private", "x-robots-tag": "noindex, nofollow, noarchive" }

export async function POST(request: NextRequest) {
  const rate = consume(LEAD_LIMIT, { ip: getRequestIp(request) })
  if (rate.limited) return tooManyRequests(rate, privateHeaders)
  const session = await authenticateDemoSession(request).catch(() => null)
  if (!session) return Response.json({ ok: false, error: "This demo session has expired. Start a new demo to continue." }, { status: 401, headers: privateHeaders })

  const raw = await request.json().catch(() => null)
  const parsed = demoTestLeadSchema.safeParse(raw)
  if (!parsed.success) return Response.json({ ok: false, error: firstZodError(parsed.error) }, { status: 400, headers: privateHeaders })
  const scenario = getDemoScenario(session.row.scenario_id)
  if (!scenario.services.some((service) => service.name === parsed.data.service)) {
    return Response.json({ ok: false, error: "Choose a service from this demo business." }, { status: 400, headers: privateHeaders })
  }

  const admin = createAdminClient()
  const expiresAt = new Date(Math.min(new Date(session.row.expires_at).getTime(), Date.now() + 24 * 60 * 60_000)).toISOString()
  const payload = {
    demo_session_id: session.row.id,
    lead_type: "demo_test",
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    service: parsed.data.service,
    preferred_date: parsed.data.preferredDate,
    preferred_time: parsed.data.preferredTime,
    notes: parsed.data.notes || null,
    consent_given: true,
    status: "new",
    is_billable: false,
    environment: "public_demo",
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await admin.from("demo_leads").upsert(payload as never, { onConflict: "demo_session_id" }).select("*").single()
  if (error || !data) {
    console.error("[demo-lead] save failed", error?.message)
    return Response.json({ ok: false, error: "We couldn't save this demo request. Your information has not been submitted." }, { status: 503, headers: privateHeaders })
  }

  const saved = data as unknown as Record<string, unknown>

  await Promise.all([
    admin.from("demo_sessions").update({ lead_created: true, current_step: "lead", completion_percentage: 70, last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never).eq("id", session.row.id),
    recordDemoEvent(session.row.id, "DEMO_TEST_LEAD_CREATED", { scenario_id: session.row.scenario_id, service: parsed.data.service }),
  ])

  return Response.json({
    ok: true,
    lead: {
      id: String(saved.id),
      name: String(saved.name),
      email: String(saved.email),
      phone: saved.phone ? String(saved.phone) : "",
      service: String(saved.service),
      preferredDate: String(saved.preferred_date),
      preferredTime: String(saved.preferred_time),
      notes: saved.notes ? String(saved.notes) : "",
      consentGiven: Boolean(saved.consent_given),
      status: String(saved.status),
      assignedTo: saved.assigned_to ? String(saved.assigned_to) : "",
      createdAt: String(saved.created_at),
      environment: "public_demo",
      isBillable: false,
    },
  }, { status: 201, headers: privateHeaders })
}

