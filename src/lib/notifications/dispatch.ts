import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail, buildLeadNotificationEmail, type EmailSendResult } from "./email"
import { sendSms, buildLeadNotificationSms, type SmsSendResult } from "./sms"
import type { Lead, NotificationLog } from "@/lib/supabase/types"

export type DispatchInput = {
  lead: Lead
  brandName: string
  transcriptExcerpt?: string
}

type ChannelConfig = {
  id: string
  channel: string
  enabled: boolean
  recipients: string[]
}

async function getEnabledChannels(): Promise<ChannelConfig[]> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("notification_channels")
      .select("id, channel, enabled, recipients")
    if (error) return []
    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>
      const recipients = Array.isArray(r.recipients)
        ? (r.recipients as unknown[]).map((x) => String(x))
        : []
      return {
        id: String(r.id),
        channel: String(r.channel),
        enabled: Boolean(r.enabled),
        recipients,
      }
    })
  } catch {
    return []
  }
}

const MAX_ATTEMPTS = 3

async function withRetry<T>(fn: () => Promise<T>, attempts = MAX_ATTEMPTS): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, 200 * Math.pow(2, i)))
    }
  }
  throw lastErr
}

async function logNotification(
  lead: Lead,
  channel: "Email" | "SMS",
  recipient: string,
  status: "delivered" | "pending" | "failed",
): Promise<NotificationLog | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("notification_logs")
      .insert({
        lead_id: lead.id,
        lead_name: lead.name,
        channel,
        recipient,
        status,
      } as never)
      .select()
      .single()
    if (error) return null
    return data as NotificationLog
  } catch {
    return null
  }
}

export async function dispatchLeadNotifications(
  input: DispatchInput,
): Promise<{ email: number; sms: number; failed: number }> {
  const { lead, brandName, transcriptExcerpt } = input
  const channels = await getEnabledChannels()
  let emailCount = 0
  let smsCount = 0
  let failed = 0

  const excerpt = transcriptExcerpt
    ? transcriptExcerpt.split("\n").slice(-12).join("\n")
    : undefined

  for (const ch of channels) {
    if (!ch.enabled) continue
    if (ch.recipients.length === 0) continue

    if (ch.channel === "email") {
      const { subject, text, html } = buildLeadNotificationEmail({
        brandName,
        leadName: lead.name,
        service: lead.service,
        preferredTime: lead.preferredTime,
        phone: lead.phone,
        email: lead.email,
        sourceUrl: lead.sourceUrl,
        afterHours: lead.afterHours,
        transcriptExcerpt: excerpt,
      })
      for (const recipient of ch.recipients) {
        const result: EmailSendResult = await withRetry(() =>
          sendEmail({ to: recipient, subject, text, html }),
        )
        await logNotification(
          lead,
          "Email",
          recipient,
          result.ok ? "delivered" : "failed",
        )
        if (result.ok) emailCount++
        else failed++
      }
    } else if (ch.channel === "sms") {
      const body = buildLeadNotificationSms({
        brandName,
        leadName: lead.name,
        service: lead.service,
        phone: lead.phone,
      })
      for (const recipient of ch.recipients) {
        const result: SmsSendResult = await withRetry(() =>
          sendSms({ to: recipient, body }),
        )
        await logNotification(
          lead,
          "SMS",
          recipient,
          result.ok ? "delivered" : "failed",
        )
        if (result.ok) smsCount++
        else failed++
      }
    } else if (ch.channel === "daily_summary") {
      // Daily summaries are handled by a scheduled job, not per-lead.
      // Recipients are stored on the channel so the future cron can read them.
      // For now we just acknowledge the channel is configured.
    }
  }

  return { email: emailCount, sms: smsCount, failed }
}
