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

type EventLog = {
  at: number
  eventType: "INSERT" | "UPDATE" | "DELETE" | "FETCH" | "ERROR"
  id?: string
  count?: number
  note?: string
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
  const [lastEvent, setLastEvent] = React.useState<EventLog | null>(null)
  const [fetchCount, setFetchCount] = React.useState(0)

  const mapRowRef = React.useRef(mapRow)
  const getIdRef = React.useRef(getId)
  const orderByRef = React.useRef(orderBy)

  React.useEffect(() => {
    mapRowRef.current = mapRow
    getIdRef.current = getId
    orderByRef.current = orderBy
  }, [mapRow, getId, orderBy])

  const safeGetId = React.useCallback(
    (item: unknown): string | undefined => {
      if (item == null) return undefined
      try {
        if (getIdRef.current) {
          const id = getIdRef.current(item as never)
          if (typeof id === "string" && id.length > 0) return id
        }
      } catch (e) {
        console.error(`[realtime:${table}] getId threw:`, e)
        return undefined
      }
      const fallback = (item as { id?: unknown })?.id
      return typeof fallback === "string" && fallback.length > 0
        ? fallback
        : undefined
    },
    [table],
  )

  const safeMapRow = React.useCallback(
    (row: unknown): T | undefined => {
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
    },
    [table],
  )

  // Stable ref to fetchInitial that survives every effect cleanup.
  // Keyed by [table] only; safeMapRow/safeGetId are always read via the
  // current refs at call time, so we never need to rebuild this on a
  // re-render.
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
        const resultError = (result as { error: { message: string } | null })
          .error
        const resultData = (result as { data: Record<string, unknown>[] | null })
          .data
        if (resultError) {
          console.error(
            `[realtime:${table}] initial fetch failed:`,
            resultError.message,
          )
          setError(new Error(resultError.message))
          setLastEvent({
            at: Date.now(),
            eventType: "ERROR",
            note: resultError.message,
          })
        } else {
          const rows = Array.isArray(resultData) ? resultData : []
          const mapped = rows
            .map((row) => safeMapRow(row))
            .filter((row): row is T => row != null)
          if (process.env.NODE_ENV !== "production") {
            console.log(
              `[realtime:${table}] initial fetch returned ${mapped.length} rows`,
              mapped.map((m) => safeGetId(m)),
            )
          }
          setLastEvent({
            at: Date.now(),
            eventType: "FETCH",
            count: mapped.length,
          })
          setFetchCount((c) => c + 1)
          setData((prev) => {
            // Never-lose merge: any row already in `prev` is preserved
            // even if the server response doesn't include it. Fetched
            // rows are authoritative (replace any optimistic copy).
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
      // Do NOT null the ref here. Keeping the latest fetchInitial alive
      // means a re-render's refresh() call always finds a function to
      // invoke. Cleanup is purely about the in-flight request.
    }
  }, [table, safeMapRow, safeGetId])

  // Realtime subscription for live updates after the initial fetch.
  React.useEffect(() => {
    const supabase = createClient()

    const channelName = `${table}-realtime-${Math.random()
      .toString(36)
      .slice(2, 8)}`
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
          if (process.env.NODE_ENV !== "production") {
            console.log(
              `[realtime:${table}] ${payload.eventType}`,
              {
                new: payload.new,
                old: payload.old,
              },
            )
          }
          setLastEvent({
            at: Date.now(),
            eventType: payload.eventType,
            id:
              payload.eventType === "DELETE"
                ? safeGetId(payload.old)
                : payload.eventType === "INSERT" || payload.eventType === "UPDATE"
                  ? safeGetId(payload.new)
                  : undefined,
          })
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
              if (!mapped) return prev
              const id = safeGetId(mapped)
              if (!id) return prev
              return prev.map((item) =>
                safeGetId(item) === id ? mapped : item,
              )
            }

            if (payload.eventType === "DELETE") {
              // Defensive: only remove if we actually have a positive id
              // AND the id is in the current local state. A blank/unknown
              // id must NEVER shrink the list.
              const id = safeGetId(payload.old)
              if (!id) return prev
              const known = prev.some((item) => safeGetId(item) === id)
              if (!known) return prev
              return prev.filter((item) => safeGetId(item) !== id)
            }

            return prev
          })
        },
      )
    })

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setLoading(false)
        if (process.env.NODE_ENV !== "production") {
          console.log(`[realtime:${table}] subscribed`)
        }
      }
      if (status === "CHANNEL_ERROR") {
        console.error(`[realtime:${table}] channel error`)
        setError(new Error(`Realtime connection error for ${table}`))
      }
      if (status === "TIMED_OUT") {
        console.error(`[realtime:${table}] channel subscribe timed out`)
      }
      if (status === "CLOSED") {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[realtime:${table}] channel closed`)
        }
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
    if (fetchInitialRef.current) {
      await fetchInitialRef.current()
      return
    }
    // Fallback: re-run a one-shot fetch if the effect hasn't run yet.
    try {
      const supabase = createClient()
      let query = supabase.from(table).select("*")
      const ob = orderByRef.current
      if (ob) {
        query = query.order(ob.column, { ascending: ob.ascending ?? true })
      }
      const { data: rows, error: err } = await query
      if (err) {
        setError(new Error(err.message))
        return
      }
      const mapped = ((rows ?? []) as Record<string, unknown>[])
        .map((row) => safeMapRow(row))
        .filter((row): row is T => row != null)
      setFetchCount((c) => c + 1)
      setLastEvent({ at: Date.now(), eventType: "FETCH", count: mapped.length })
      setData((prev) => {
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
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    }
  }, [table, safeMapRow, safeGetId])

  return {
    data,
    error,
    loading,
    setData: updateData,
    refresh,
    lastEvent,
    fetchCount,
  }
}
