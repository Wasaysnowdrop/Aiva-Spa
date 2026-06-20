import "server-only"
import { mapNotificationLog, mapNotificationChannelConfig } from "@/lib/supabase/types"
import type {
  NotificationChannelConfig,
  NotificationLog,
} from "@/lib/supabase/types"

export async function getNotificationChannelsServer(): Promise<
  NotificationChannelConfig[]
> {
  try {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("notification_channels")
      .select("*")
      .order("channel")
    if (error) {
      console.error("[notifications] server getNotificationChannels failed:", error.message)
      return []
    }
    return (data ?? []).map((row: Record<string, unknown>) =>
      mapNotificationChannelConfig(row),
    )
  } catch (e) {
    console.error("[notifications] server getNotificationChannels threw:", e)
    return []
  }
}

export async function getNotificationLogsServer(): Promise<NotificationLog[]> {
  try {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("notification_logs")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(20)
    if (error) {
      console.error("[notifications] server getNotificationLogs failed:", error.message)
      return []
    }
    return (data ?? []).map((row: Record<string, unknown>) =>
      mapNotificationLog(row),
    )
  } catch (e) {
    console.error("[notifications] server getNotificationLogs threw:", e)
    return []
  }
}