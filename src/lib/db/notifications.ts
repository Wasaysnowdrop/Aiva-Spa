import { createClient } from "@/lib/supabase/client"
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

export async function getNotificationLogs(): Promise<NotificationLog[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("notification_logs")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(20)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    mapNotificationLog(row as Record<string, unknown>),
  )
}

export type NotificationLogInsert = {
  leadId: string
  leadName: string
  channel: NotificationChannel
  recipient: string
  status: NotificationStatus
}

export async function createNotificationLog(
  log: NotificationLogInsert,
): Promise<NotificationLog> {
  const supabase = createClient()
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

  if (error) throw new Error(error.message)
  return mapNotificationLog(data as Record<string, unknown>)
}

export async function getNotificationChannels(): Promise<
  NotificationChannelConfig[]
> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("notification_channels")
    .select("*")
    .order("channel")

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    mapNotificationChannelConfig(row as Record<string, unknown>),
  )
}

export async function updateNotificationChannel(
  id: string,
  update: { enabled?: boolean; recipients?: string[] },
): Promise<NotificationChannelConfig> {
  const supabase = createClient()
  const payload: Record<string, unknown> = {}
  if ("enabled" in update) payload.enabled = update.enabled
  if ("recipients" in update) payload.recipients = update.recipients

  const { data, error } = await supabase
    .from("notification_channels")
    .update(payload as never)
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapNotificationChannelConfig(data as Record<string, unknown>)
}
