import { NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/notifications/email"
import { sendSms } from "@/lib/notifications/sms"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_ATTEMPTS = 3

function buildReminderContent(opts: {
  brandName: string
  recipientName: string
  service: string
  startAt: string
  durationMinutes: number
}): { subject: string; text: string; html: string; sms: string } {
  const startDate = new Date(opts.startAt)
  const human = Number.isNaN(startDate.getTime())
    ? opts.startAt
    : startDate.toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
  const subject = `Reminder: your ${opts.service} appointment is coming up`
  const text = [
    `Hi ${opts.recipientName.split(/\s+/)[0] || "there"},`,
    ``,
    `This is a reminder of your upcoming appointment at ${opts.brandName}.`,
    ``,
    `  Service:     ${opts.service}`,
    `  When:        ${human}`,
    `  Duration:    ${opts.durationMinutes} min`,
    ``,
    `Need to reschedule? Just reply to this message.`,
    ``,
    `— ${opts.brandName}`,
  ].join("\n")
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#08090A;color:#F7F8F8;padding:24px;">
<div style="max-width:520px;margin:0 auto;background:#121316;border:1px solid #23252A;border-radius:16px;padding:24px;">
  <h1 style="margin:0 0 8px 0;font-size:20px;">Appointment reminder</h1>
  <p style="margin:0 0 16px 0;color:#8A8F98;">Hi ${opts.recipientName.split(/\s+/)[0] || "there"}, this is a reminder of your upcoming visit to <strong style="color:#F7F8F8;">${opts.brandName}</strong>.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:6px 0;color:#8A8F98;width:120px;">Service</td><td style="padding:6px 0;color:#F7F8F8;">${opts.service}</td></tr>
    <tr><td style="padding:6px 0;color:#8A8F98;">When</td><td style="padding:6px 0;color:#F7F8F8;">${human}</td></tr>
    <tr><td style="padding:6px 0;color:#8A8F98;">Duration</td><td style="padding:6px 0;color:#F7F8F8;">${opts.durationMinutes} min</td></tr>
  </table>
  <p style="margin:18px 0 0 0;font-size:13px;color:#8A8F98;">Need to reschedule? Just reply to this message.</p>
</div></body></html>`
  const sms = `Reminder: your ${opts.service} appointment at ${opts.brandName} is ${human}. Reply to reschedule.`
  return { subject, text, html, sms }
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") || ""
  const expected = process.env.CRON_SECRET
  if (expected) {
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : ""
    if (token !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()
  const { data: due, error } = await admin
    .from("calendar_reminders")
    .select("id, booking_id, channel, recipient, send_at, attempts")
    .is("sent_at", null)
    .lte("send_at", nowIso)
    .order("send_at", { ascending: true })
    .limit(50)
  if (error) {
    console.error("reminders fetch failed", error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  const rows = (due ?? []) as Array<Record<string, unknown>>
  const results: Array<{ id: string; status: string; error?: string }> = []
  for (const row of rows) {
    const id = String(row.id)
    const bookingId = String(row.booking_id)
    const channel = String(row.channel) as "email" | "sms"
    const recipient = String(row.recipient)
    const attempts = Number(row.attempts ?? 0)
    if (attempts >= MAX_ATTEMPTS) {
      results.push({ id, status: "skipped_max_attempts" })
      continue
    }
    const { data: booking } = await admin
      .from("calendar_bookings")
      .select(
        "id, start_at, duration_minutes, service, status, spa_id, lead_id",
      )
      .eq("id", bookingId)
      .maybeSingle()
    if (!booking) {
      results.push({ id, status: "skipped_no_booking" })
      continue
    }
    const b = booking as Record<string, unknown>
    if (b.status === "cancelled" || b.status === "completed") {
      await admin
        .from("calendar_reminders")
        .update({ sent_at: new Date().toISOString() } as never)
        .eq("id", id)
      results.push({ id, status: "skipped_booking_final" })
      continue
    }
    let leadName = "there"
    if (b.lead_id) {
      const { data: lead } = await admin
        .from("leads")
        .select("name")
        .eq("id", b.lead_id as string)
        .maybeSingle()
      if (lead && (lead as { name?: string }).name) {
        leadName = (lead as { name: string }).name
      }
    }
    const { data: spa } = await admin
      .from("widget_config")
      .select("brand_name")
      .limit(1)
      .maybeSingle()
    const brandName =
      (spa as { brand_name?: string } | null)?.brand_name || "your med spa"
    const content = buildReminderContent({
      brandName,
      recipientName: leadName,
      service: String(b.service ?? "Consultation"),
      startAt: String(b.start_at),
      durationMinutes: Number(b.duration_minutes ?? 30),
    })
    let ok = false
    let errorMsg: string | null = null
    if (channel === "email") {
      const r = await sendEmail({
        to: recipient,
        subject: content.subject,
        text: content.text,
        html: content.html,
      })
      ok = r.ok
      errorMsg = r.error ?? null
    } else {
      const r = await sendSms({ to: recipient, body: content.sms })
      ok = r.ok
      errorMsg = r.error ?? null
    }
    if (ok) {
      await admin
        .from("calendar_reminders")
        .update({
          sent_at: new Date().toISOString(),
          attempts: attempts + 1,
          error: null,
        } as never)
        .eq("id", id)
      results.push({ id, status: "delivered" })
    } else {
      await admin
        .from("calendar_reminders")
        .update({
          attempts: attempts + 1,
          error: errorMsg,
        } as never)
        .eq("id", id)
      results.push({ id, status: "failed", error: errorMsg ?? undefined })
    }
  }
  return NextResponse.json({ ok: true, processed: results.length, results })
}

export async function POST(request: Request) {
  return GET(request)
}
