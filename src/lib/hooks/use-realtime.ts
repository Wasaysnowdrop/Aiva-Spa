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
  initialData?: T[]
  event?: "*" | "INSERT" | "UPDATE" | "DELETE"
  filter?: string
  orderBy?: { column: string; ascending?: boolean }
  mapRow?: (row: Record<string, unknown>) => T
  getId?: (item: T) => string
}

export function useRealtimeSubscription<T>({
  table,
  initialData,
  event = "*",
  filter,
  orderBy,
  mapRow,
  getId,
}: UseRealtimeOptions<T>) {
  const [data, setData] = React.useState<T[]>(() => initialData ?? [])
  const [error, setError] = React.useState<Error | null>(null)
  const [loading, setLoading] = React.useState(true)

  const mapRowRef = React.useRef(mapRow)
  const getIdRef = React.useRef(getId)
  const orderByRef = React.useRef(orderBy)

  React.useEffect(() => {
    mapRowRef.current = mapRow
    getIdRef.current = getId
    orderByRef.current = orderBy
  }, [mapRow, getId, orderBy])

  const safeGetId = React.useCallback((item: unknown): string | undefined => {
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
  }, [table])

  const safeMapRow = React.useCallback((row: unknown): T | undefined => {
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
  }, [table])

  // Initial fetch — runs once on mount so the list is populated from the DB
  // even when Supabase Realtime is not configured for this table. Realtime
  // events are merged into this state via dedup-by-id below.
  const fetchInitialRef = React.useRef<(() => Promise<void>) | null>(null)
  React.useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function fetchInitial() {
      try {
        let query = supabase.from(table).select("*")
        const ob = orderByRef.current
        if (ob) {
          query = query.order(ob.column, { ascending: ob.ascending ?? true })
        }
        const result = await query
        if (cancelled) return
        const resultError = (result as { error: { message: string } | null }).error
        const resultData = (result as { data: Record<string, unknown>[] | null }).data
        if (resultError) {
          console.error(`[realtime:${table}] initial fetch failed:`, resultError.message)
          setError(new Error(resultError.message))
        } else {
          const rows = Array.isArray(resultData) ? resultData : []
          const mapped = rows
            .map((row) => safeMapRow(row))
            .filter((row): row is T => row != null)
          setData((prev) => {
            // Merge: keep any rows already added by realtime events, dedupe by id
            const byId = new Map<string, T>()
            for (const item of mapped) {
              const id = safeGetId(item)
              if (id) byId.set(id, item)
            }
            for (const item of prev) {
              const id = safeGetId(item)
              if (id && !byId.has(id)) byId.set(id, item)
            }
            return Array.from(byId.values())
          })
        }
      } catch (e) {
        if (!cancelled) {
          console.error(`[realtime:${table}] initial fetch threw:`, e)
          setError(e instanceof Error ? e : new Error(String(e)))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchInitialRef.current = fetchInitial
    void fetchInitial()

    return () => {
      cancelled = true
      fetchInitialRef.current = null
    }
  }, [table, safeMapRow, safeGetId])

  // Realtime subscription for live updates after the initial fetch.
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
        console.error(`[realtime:${table}] channel error`)
        setError(new Error(`Realtime connection error for ${table}`))
      }
      if (status === "TIMED_OUT") {
        console.error(`[realtime:${table}] channel subscribe timed out`)
      }
      if (status === "CLOSED") {
        console.warn(`[realtime:${table}] channel closed`)
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, event, filter, safeMapRow, safeGetId])

  const updateData = React.useCallback(
    (updater: T[] | ((prev: T[]) => T[])) => {
      setData(updater)
    },
    [],
  )

  const refresh = React.useCallback(async () => {
    await fetchInitialRef.current?.()
  }, [])

  return { data, error, loading, setData: updateData, refresh }
}
