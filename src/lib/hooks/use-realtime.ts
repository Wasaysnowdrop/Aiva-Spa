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

    const safeGetId = (item: unknown): string | undefined => {
      if (item == null) return undefined
      try {
        if (getIdRef.current) {
          const id = getIdRef.current(item as never)
          return typeof id === "string" && id.length > 0 ? id : undefined
        }
      } catch (e) {
        console.error(`[realtime:${table}] getId threw:`, e)
        return undefined
      }
      const fallback = (item as { id?: unknown })?.id
      return typeof fallback === "string" && fallback.length > 0 ? fallback : undefined
    }

    const safeMapRow = (row: unknown): T | undefined => {
      if (row == null) return undefined
      try {
        if (!mapRowRef.current) return row as T
        const mapped = mapRowRef.current(row as Record<string, unknown>)
        if (mapped == null) return undefined
        return mapped
      } catch (e) {
        console.error(`[realtime:${table}] mapRow threw:`, e, { row })
        return undefined
      }
    }

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
            if (payload.eventType === "INSERT") {
              const mapped = safeMapRow(payload.new)
              if (!mapped) return prev
              const newId = safeGetId(mapped)
              if (!newId) return prev
              if (prev.some((item) => safeGetId(item) === newId)) {
                return prev.map((item) =>
                  safeGetId(item) === newId ? mapped : item,
                )
              }
              return [mapped, ...prev]
            }

            if (payload.eventType === "UPDATE") {
              const mapped = safeMapRow(payload.new)
              if (!mapped) return prev.filter((item) => item != null)
              const id = safeGetId(mapped)
              if (!id) return prev.filter((item) => item != null)
              return prev
                .filter((item) => item != null)
                .map((item) => (safeGetId(item) === id ? mapped : item))
            }

            if (payload.eventType === "DELETE") {
              const id = safeGetId(payload.old)
              if (!id) return prev.filter((item) => item != null)
              return prev
                .filter((item) => item != null)
                .filter((item) => safeGetId(item) !== id)
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
