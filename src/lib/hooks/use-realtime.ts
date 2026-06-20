"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

export type TableName =
  | "leads"
  | "chat_sessions"
  | "team_members"
  | "knowledge_services"
  | "knowledge_faqs"
  | "knowledge_guardrails"
  | "widget_config"
  | "notification_logs"
  | "spa_settings"
  | "audit_logs"
  | "integrations_config"
  | "notification_channels"
  | "calendar_settings"
  | "calendar_bookings"
  | "calendar_reminders"

export interface UseRealtimeOptions<T> {
  table: TableName
  initialData: T[]
  event?: "*" | "INSERT" | "UPDATE" | "DELETE"
  filter?: string
  mapRow?: (row: Record<string, unknown>) => T
  getId?: (item: T) => string
}

export function useRealtimeSubscription<T>({
  table,
  initialData,
  event = "*",
  filter,
  mapRow,
  getId,
}: UseRealtimeOptions<T>) {
  const [data, setData] = React.useState<T[]>(() => initialData)
  const [error, setError] = React.useState<Error | null>(null)
  const [loading, setLoading] = React.useState(false)

  const mapRowRef = React.useRef(mapRow)
  const getIdRef = React.useRef(getId)

  React.useEffect(() => {
    const supabase = createClient()

    const channelName = `${table}-realtime-${Math.random().toString(36).slice(2, 8)}`
    const channel = supabase.channel(channelName)

    const events = event === "*" ? ["INSERT", "UPDATE", "DELETE"] : [event]

    events.forEach((evt) => {
      channel.on(
        "postgres_changes",
        {
          event: evt as "INSERT" | "UPDATE" | "DELETE",
          schema: "public",
          table,
          filter,
        },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setData((prev) => {
            const resolveMapRow = mapRowRef.current
            const resolveGetId = getIdRef.current
            if (payload.eventType === "INSERT") {
              const mapped = resolveMapRow
                ? resolveMapRow(payload.new as Record<string, unknown>)
                : (payload.new as unknown as T)
              return [mapped, ...prev]
            }

            if (payload.eventType === "UPDATE") {
              const mapped = resolveMapRow
                ? resolveMapRow(payload.new as Record<string, unknown>)
                : (payload.new as unknown as T)
              const id = resolveGetId ? resolveGetId(mapped) : (mapped as unknown as { id: string }).id
              return prev.map((item) => {
                const itemId = resolveGetId ? resolveGetId(item) : (item as unknown as { id: string }).id
                return itemId === id ? mapped : item
              })
            }

            if (payload.eventType === "DELETE") {
              const id = resolveGetId
                ? resolveGetId(payload.old as unknown as T)
                : (payload.old as unknown as { id: string }).id
              return prev.filter((item) => {
                const itemId = resolveGetId ? resolveGetId(item) : (item as unknown as { id: string }).id
                return itemId !== id
              })
            }

            return prev
          })
        },
      )
    })

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setLoading(false)
      }
      if (status === "CHANNEL_ERROR") {
        setError(new Error(`Realtime connection error for ${table}`))
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, event, filter])

  const updateData = React.useCallback(
    (updater: T[] | ((prev: T[]) => T[])) => {
      setData(updater)
    },
    [],
  )

  return { data, error, loading, setData: updateData }
}
