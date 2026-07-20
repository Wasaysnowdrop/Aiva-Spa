import type { NextRequest } from "next/server"

import { authenticateDemoSession, recordDemoEvent } from "@/lib/demo/server"
import { demoSummaryEmailSchema, firstZodError } from "@/lib/demo/schemas"
import { getDemoScenario } from "@/lib/demo/scenarios"
import { sendEmail } from "@/lib/notifications/email"
import { consume, getRequestIp, tooManyRequests } from "@/lib/security/limiter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SUMMARY_LIMIT = { bucket: "public:demo:summary", options: { maxRequests: 3, windowMs: 60 * 60_000 } } as const

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character)
}

export async function POST(request: NextRequest) {
  const rate = consume(SUMMARY_LIMIT, { ip: getRequestIp(request) })
  if (rate.limited) return tooManyRequests(rate)
  const session = await authenticateDemoSession(request).catch(() => null)
  if (!session) return Response.json({ ok: false, error: "This demo session is no longer available." }, { status: 401 })
  const parsed = demoSummaryEmailSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ ok: false, error: firstZodError(parsed.error) }, { status: 400 })

  const scenario = getDemoScenario(session.row.scenario_id)
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://aivaspa.online").replace(/\/$/, "")
  const events = parsed.data.completedEvents.map((event) => event.replace(/[<>]/g, "")).slice(0, 12)
  const text = [
    `Your AivaSpa demo summary - ${scenario.businessName}`,
    "",
    ...events.map((event) => `- ${event}`),
    "",
    "No chat transcript or test contact details are included in this email.",
    `Try AivaSpa again: ${siteUrl}/demo`,
    `Start your setup: ${siteUrl}/signup`,
  ].join("\n")
  const result = await sendEmail({
    to: parsed.data.email,
    subject: "Your AivaSpa interactive demo summary",
    text,
    html: `<h1>Your AivaSpa demo summary</h1><p>You explored AivaSpa using the fictional ${escapeHtml(scenario.businessName)} scenario.</p><ul>${events.map((event) => `<li>${escapeHtml(event)}</li>`).join("")}</ul><p>No chat transcript or test contact details are included.</p><p><a href="${siteUrl}/demo">Try the demo again</a> or <a href="${siteUrl}/signup">start your setup</a>.</p>`,
  })
  if (!result.ok) return Response.json({ ok: false, retryable: true, error: "The summary email could not be delivered. Please try again." }, { status: 503 })
  await recordDemoEvent(session.row.id, "DEMO_COMPLETED", { summary_emailed: true })
  return Response.json({ ok: true, message: "Your demo summary is on its way." }, { headers: { "cache-control": "no-store" } })
}

