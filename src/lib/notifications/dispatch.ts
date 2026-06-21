import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail, buildLeadNotificationEmail, type EmailSendResult } from "./email"
import { sendSms, buildLeadNotificationSms, type SmsSendResult } from "./sms"
import type { Lead, NotificationLog } from "@/lib/supabase/types"

export type DispatchInput = {
  lead: Lead
  brandName: string
  transcriptExcerpt?: string
  /**
   * Optional owner filter. When provided, only channels whose `user_id`
   * matches (or, for legacy rows predating the column, fall back to the
   * default global channel) are dispatched. This prevents cross-tenant
   * fanout where one spa's lead notifies every other spa's owners.
   */
  ownerUserId?: string | null
}

type ChannelConfig = {
  id: string
  channel: string
  enabled: boolean
  recipients: string[]
  userId: string | null
}

async function getEnabledChannels(
  ownerUserId?: string | null,
): Promise<ChannelConfig[]> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("notification_channels")
      .select("id, channel, enabled, recipients, user_id")
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
        userId: (r.user_id as string | null) ?? null,
      }
    }).filter((c) => {
      // No owner filter => legacy single-tenant behavior (all enabled
      // channels fire). Used for pre-signup flows (e.g. welcome email
      // on signup).
      if (!ownerUserId) return true
      // Owner-scoped channels only fire for their owning user.
      if (c.userId) return c.userId === ownerUserId
      // Legacy rows (no user_id assigned yet) are intentionally NOT
      // fired when an owner filter is provided — this prevents cross-
      // tenant leakage during the migration window. After migration
      // 00018 runs, every newly written channel carries a user_id, so
      // this branch should be unreachable in steady state. If a legacy
      // NULL-user_id row is still around and unclaimed, the dashboard
      // will surface it as a global default only when no owner filter
      // is in play (i.e. system flows like the welcome email).
      return false
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
  error?: string,
): Promise<NotificationLog | null> {
  try {
    const admin = createAdminClient()
    const { data, error: dbErr } = await admin
      .from("notification_logs")
      .insert({
        lead_id: lead.id,
        lead_name: lead.name,
        channel,
        recipient,
        status,
        // Surface the underlying provider error in the audit trail even
        // though the table has no dedicated `error` column.
        ...(error ? { detail: { error } } : {}),
      } as never)
      .select()
      .single()
    if (dbErr) return null
    return data as NotificationLog
  } catch {
    return null
  }
}

export async function dispatchLeadNotifications(
  input: DispatchInput,
): Promise<{ email: number; sms: number; failed: number }> {
  const { lead, brandName, transcriptExcerpt, ownerUserId } = input
  const channels = await getEnabledChannels(ownerUserId ?? null)
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
          result.ok ? undefined : result.error,
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
          result.ok ? undefined : result.error,
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
