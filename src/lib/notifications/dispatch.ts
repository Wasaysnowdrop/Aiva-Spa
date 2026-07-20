import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail, buildLeadNotificationEmail, type EmailSendResult } from "./email"
import type { Lead, NotificationLog } from "@/lib/supabase/types"

export type DispatchInput = {
  lead: Lead
  brandName: string
  transcriptExcerpt?: string
  ownerUserId?: string | null
}

type ChannelConfig = {
  id: string
  enabled: boolean
  recipients: string[]
  userId: string | null
}

async function getEnabledEmailChannels(
  ownerUserId?: string | null,
): Promise<ChannelConfig[]> {
  try {
    const admin = createAdminClient()
    let query = admin
      .from("notification_channels")
      .select("id, enabled, recipients, user_id")
      .eq("channel", "email")
    if (ownerUserId) query = query.eq("user_id", ownerUserId)
    const { data, error } = await query
    if (error) return []
    return (data ?? [])
      .map((row) => {
        const r = row as Record<string, unknown>
        return {
          id: String(r.id),
          enabled: Boolean(r.enabled),
          recipients: Array.isArray(r.recipients)
            ? (r.recipients as unknown[]).map(String)
            : [],
          userId: (r.user_id as string | null) ?? null,
        }
      })
      .filter((channel) =>
        ownerUserId ? channel.userId === ownerUserId : true,
      )
  } catch {
    return []
  }
}

const MAX_ATTEMPTS = 3

async function withRetry<T>(fn: () => Promise<T>, attempts = MAX_ATTEMPTS): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt))
    }
  }
  throw lastError
}

async function logNotification(
  lead: Lead,
  recipient: string,
  status: "delivered" | "failed",
  ownerUserId: string | null | undefined,
  result: EmailSendResult,
  latencyMs: number,
): Promise<NotificationLog | null> {
  try {
    const admin = createAdminClient()
    const { data, error: dbError } = await admin
      .from("notification_logs")
      .insert({
        user_id: ownerUserId ?? lead.userId ?? null,
        lead_id: lead.id,
        lead_name: lead.name,
        channel: "Email",
        recipient,
        status,
        email_type: "new_lead",
        provider: result.provider,
        provider_message_id: result.id ?? null,
        delivered_at: result.ok ? new Date().toISOString() : null,
        latency_ms: latencyMs,
        error_reason: result.ok ? null : result.error ?? "Email delivery failed",
        provider_response: result.id ? { id: result.id } : {},
        detail: result.ok ? {} : { error: result.error ?? "Email delivery failed" },
      } as never)
      .select()
      .single()
    return dbError ? null : (data as NotificationLog)
  } catch {
    return null
  }
}

export async function dispatchLeadNotifications(
  input: DispatchInput,
): Promise<{ email: number; failed: number }> {
  const { lead, brandName, transcriptExcerpt, ownerUserId } = input
  const channels = await getEnabledEmailChannels(ownerUserId ?? null)
  let email = 0
  let failed = 0
  const excerpt = transcriptExcerpt
    ? transcriptExcerpt.split("\n").slice(-12).join("\n")
    : undefined

  const message = buildLeadNotificationEmail({
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

  for (const channel of channels) {
    if (!channel.enabled) continue
    for (const recipient of channel.recipients) {
      const startedAt = Date.now()
      const result: EmailSendResult = await withRetry(() =>
        sendEmail({ to: recipient, ...message }),
      )
      await logNotification(
        lead,
        recipient,
        result.ok ? "delivered" : "failed",
        ownerUserId,
        result,
        Date.now() - startedAt,
      )
      if (result.ok) email += 1
      else failed += 1
    }
  }

  return { email, failed }
}
