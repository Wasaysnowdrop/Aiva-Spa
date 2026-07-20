import type { NextRequest } from "next/server"

import { authenticateDemoSession, recordDemoEvent } from "@/lib/demo/server"
import { demoSalesLeadSchema, firstZodError } from "@/lib/demo/schemas"
import { getDemoScenario } from "@/lib/demo/scenarios"
import { sendEmail } from "@/lib/notifications/email"
import { createAdminClient } from "@/lib/supabase/admin"
import { consume, getRequestIp, tooManyRequests } from "@/lib/security/limiter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SALES_LIMIT = { bucket: "public:demo:sales-lead", options: { maxRequests: 5, windowMs: 60 * 60_000 } } as const
const privateHeaders = { "cache-control": "no-store, private", "x-robots-tag": "noindex, nofollow, noarchive" }

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character)
}

export async function POST(request: NextRequest) {
  const rate = consume(SALES_LIMIT, { ip: getRequestIp(request) })
  if (rate.limited) return tooManyRequests(rate, privateHeaders)
  const session = await authenticateDemoSession(request).catch(() => null)
  if (!session) return Response.json({ ok: false, error: "This demo session has expired. Start a new demo to continue." }, { status: 401, headers: privateHeaders })

  const raw = await request.json().catch(() => null)
  const parsed = demoSalesLeadSchema.safeParse(raw)
  if (!parsed.success) return Response.json({ ok: false, error: firstZodError(parsed.error) }, { status: 400, headers: privateHeaders })

  const admin = createAdminClient()
  const { data: events } = await admin.from("demo_events").select("event_name").eq("demo_session_id", session.row.id).order("created_at")
  const interactions = [...new Set(((events || []) as unknown as Array<Record<string, unknown>>).map((event) => String(event.event_name)))].slice(0, 20)
  const scenario = getDemoScenario(session.row.scenario_id)
  const payload = {
    demo_session_id: session.row.id,
    lead_type: "aivaspa_sales",
    source: "interactive_demo",
    full_name: parsed.data.fullName,
    business_name: parsed.data.businessName,
    work_email: parsed.data.workEmail,
    phone: parsed.data.phone || null,
    website: parsed.data.website || null,
    locations: parsed.data.locations,
    monthly_enquiries: parsed.data.monthlyEnquiries,
    current_process: parsed.data.currentProcess,
    country_timezone: parsed.data.countryTimezone,
    preferred_contact_time: parsed.data.preferredContactTime,
    consent_given: true,
    consented_at: new Date().toISOString(),
    selected_scenario: session.row.scenario_id,
    completion_percentage: Math.max(Number(session.row.completion_percentage || 0), 80),
    important_interactions: interactions,
    campaign: session.row.campaign || {},
    notification_status: "pending",
    updated_at: new Date().toISOString(),
  }
  const { data: lead, error: saveError } = await admin.from("demo_sales_leads").upsert(payload as never, { onConflict: "demo_session_id" }).select("id").single()
  if (saveError || !lead) {
    console.error("[demo-sales] save failed", saveError?.message)
    return Response.json({ ok: false, saved: false, error: "We couldn't save your request. Your information has not been submitted." }, { status: 503, headers: privateHeaders })
  }

  const salesEmail = process.env.AIVASPA_SALES_EMAIL || process.env.SALES_EMAIL || "sales@aivaspa.com"
  const subject = `Interactive demo lead: ${parsed.data.businessName}`
  const text = [
    "New AivaSpa sales lead from the interactive demo",
    `Name: ${parsed.data.fullName}`,
    `Business: ${parsed.data.businessName}`,
    `Work email: ${parsed.data.workEmail}`,
    `Phone: ${parsed.data.phone || "Not provided"}`,
    `Website: ${parsed.data.website || "Not provided"}`,
    `Locations: ${parsed.data.locations}`,
    `Monthly website enquiries: ${parsed.data.monthlyEnquiries}`,
    `Current process: ${parsed.data.currentProcess}`,
    `Country / timezone: ${parsed.data.countryTimezone}`,
    `Preferred contact time: ${parsed.data.preferredContactTime}`,
    `Selected scenario: ${scenario.label}`,
    `Demo completion: ${Math.max(Number(session.row.completion_percentage || 0), 80)}%`,
    "Consent: Yes",
  ].join("\n")
  const result = await sendEmail({
    to: salesEmail,
    replyTo: parsed.data.workEmail,
    subject,
    text,
    html: `<h1>New interactive demo lead</h1><p><strong>${escapeHtml(parsed.data.fullName)}</strong> from ${escapeHtml(parsed.data.businessName)} asked to hear from AivaSpa.</p><ul><li>Work email: ${escapeHtml(parsed.data.workEmail)}</li><li>Phone: ${escapeHtml(parsed.data.phone || "Not provided")}</li><li>Website: ${escapeHtml(parsed.data.website || "Not provided")}</li><li>Locations: ${parsed.data.locations}</li><li>Monthly enquiries: ${escapeHtml(parsed.data.monthlyEnquiries)}</li><li>Preferred contact time: ${escapeHtml(parsed.data.preferredContactTime)}</li><li>Scenario: ${escapeHtml(scenario.label)}</li></ul><p>Consent was explicitly provided in the interactive demo.</p>`,
  })

  await Promise.all([
    admin.from("demo_sales_leads").update({ notification_status: result.ok ? "delivered" : "failed", notification_provider_id: result.id || null, notification_error: result.error || null, updated_at: new Date().toISOString() } as never).eq("id", String((lead as unknown as Record<string, unknown>).id)),
    admin.from("demo_sessions").update({ sales_lead_created: true, current_step: "complete", completion_percentage: 100, status: "completed", updated_at: new Date().toISOString() } as never).eq("id", session.row.id),
    recordDemoEvent(session.row.id, "DEMO_SALES_LEAD_SUBMITTED", { email_delivery: result.ok ? "delivered" : "failed", scenario_id: session.row.scenario_id }),
  ])

  if (!result.ok) {
    return Response.json({ ok: false, saved: true, retryable: true, error: "Your details were saved, but the sales notification could not be delivered yet. Please retry the notification." }, { status: 503, headers: privateHeaders })
  }
  return Response.json({ ok: true, saved: true, message: "Thanks. The AivaSpa team will contact you using the details you provided." }, { status: 201, headers: privateHeaders })
}

