import type { NextRequest } from "next/server"

import { runDailySummary } from "@/lib/notifications/daily-summary"
import { recordAudit } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Vercel Cron sends Authorization: Bearer <CRON_SECRET>. If no secret
    // is configured, reject in production but allow in development.
    if (process.env.NODE_ENV === "production") return false
    return true
  }
  const header = request.headers.get("authorization") ?? ""
  if (header === `Bearer ${secret}`) return true
  // Allow Vercel's cron query token as a fallback
  try {
    const url = new URL(request.url)
    const queryToken = url.searchParams.get("token")
    if (queryToken && queryToken === secret) return true
  } catch {
    // ignore parse errors
  }
  return false
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runDailySummary()
    try {
      await recordAudit({
        userName: "cron",
        action: `daily_summary.sent recipients=${result.recipients} ok=${result.sent} failed=${result.failed}`,
      })
    } catch {
      // non-fatal
    }
    return Response.json({ ok: true, ...result }, { status: 200 })
  } catch (err) {
    console.error("daily-summary cron failed", err)
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "cron failed" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}