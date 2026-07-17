import { createClient as createBrowserClient } from "@/lib/supabase/client"
import type {
  NotificationLog,
  NotificationChannel,
  NotificationStatus,
  NotificationChannelConfig,
} from "@/lib/supabase/types"
import {
  mapNotificationLog,
  mapNotificationChannelConfig,
} from "@/lib/supabase/types"

export async function getNotificationChannelsClient(): Promise<
  NotificationChannelConfig[]
> {
  try {
    const supabase = createBrowserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    // RLS already scopes to auth.uid() = user_id; the explicit filter
    // is belt-and-braces in case RLS is ever loosened in a future
    // migration.
    let query = supabase
      .from("notification_channels")
      .select("*")
      .in("channel", ["email", "daily_summary"])
      .order("channel")
    query = user
      ? query.eq("user_id", user.id)
      : query.eq("user_id", "00000000-0000-0000-0000-000000000000")
    const { data, error } = await query
    if (error) {
      console.error("[notifications] client getNotificationChannels failed:", error.message)
      return []
    }
    return (data ?? []).map((row: Record<string, unknown>) =>
      mapNotificationChannelConfig(row),
    )
  } catch (e) {
    console.error("[notifications] client getNotificationChannels threw:", e)
    return []
  }
}

export async function updateNotificationChannelClient(
  id: string,
  update: { enabled?: boolean; recipients?: string[] },
): Promise<NotificationChannelConfig | null> {
  try {
    const supabase = createBrowserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const payload: Record<string, unknown> = {}
    if ("enabled" in update) payload.enabled = update.enabled
    if ("recipients" in update) payload.recipients = update.recipients
    const { data, error } = await supabase
      .from("notification_channels")
      .update(payload as never)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()
    if (error) {
      console.error("[notifications] client updateNotificationChannel failed:", error.message)
      return null
    }
    return mapNotificationChannelConfig(data as Record<string, unknown>)
  } catch (e) {
    console.error("[notifications] client updateNotificationChannel threw:", e)
    return null
  }
}

// Backwards-compatible names. These default to the browser client because
// that's what the existing client component (`settings-view.tsx`) needs.
// Server components that want to read channels should call
// `getNotificationChannelsServer` from `@/lib/db/notifications.server`.
export async function getNotificationChannels(): Promise<NotificationChannelConfig[]> {
  return getNotificationChannelsClient()
}

export async function updateNotificationChannel(
  id: string,
  update: { enabled?: boolean; recipients?: string[] },
): Promise<NotificationChannelConfig | null> {
  return updateNotificationChannelClient(id, update)
}

export type NotificationLogInsert = {
  leadId: string
  leadName: string
  channel: NotificationChannel
  recipient: string
  status: NotificationStatus
}

export async function getNotificationLogs(): Promise<NotificationLog[]> {
  try {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from("notification_logs")
      .select("*")
      .eq("channel", "Email")
      .order("sent_at", { ascending: false })
      .limit(20)
    if (error) {
      console.error("[notifications] client getNotificationLogs failed:", error.message)
      return []
    }
    return (data ?? []).map((row: Record<string, unknown>) =>
      mapNotificationLog(row),
    )
  } catch (e) {
    console.error("[notifications] client getNotificationLogs threw:", e)
    return []
  }
}

export async function createNotificationLog(
  log: NotificationLogInsert,
): Promise<NotificationLog | null> {
  try {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from("notification_logs")
      .insert({
        lead_id: log.leadId,
        lead_name: log.leadName,
        channel: log.channel,
        recipient: log.recipient,
        status: log.status,
      } as never)
      .select()
      .single()
    if (error) {
      console.error("[notifications] client createNotificationLog failed:", error.message)
      return null
    }
    return mapNotificationLog(data as Record<string, unknown>)
  } catch (e) {
    console.error("[notifications] client createNotificationLog threw:", e)
    return null
  }
}