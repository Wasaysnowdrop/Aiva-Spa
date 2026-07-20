"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"

export type AdminEvent = {
  id: string
  eventType: string
  category: string
  businessId: string | null
  businessName: string
  status: string
  title: string
  detail: string
  occurredAt: string
  href: string | null
}

type FeedContextValue = {
  events: AdminEvent[]
  isPaused: boolean
  pendingCount: number
  connection: "connecting" | "live" | "reconnecting" | "offline"
  pause: () => void
  resume: () => void
  clear: () => void
}

const FeedContext = React.createContext<FeedContextValue | null>(null)
export function useAdminFeed() { const value = React.useContext(FeedContext); if (!value) throw new Error("useAdminFeed must be used inside AdminRealtimeProvider"); return value }

function realtimeEvent(row: Record<string, unknown>): AdminEvent {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>
  const eventType = String(row.event_type ?? "operational.event")
  const category = String(row.category ?? "admin")
  const readable = eventType.replaceAll(/[._]/g, " ").replace(/^./, (letter) => letter.toUpperCase())
  return {
    id: String(row.id), eventType, category,
    businessId: typeof row.business_id === "string" ? row.business_id : null,
    businessName: "Customer business",
    status: String(row.status ?? "info"),
    title: readable,
    detail: String(metadata.summary ?? metadata.service ?? metadata.delivery_status ?? "New persisted platform event"),
    occurredAt: String(row.occurred_at ?? new Date().toISOString()),
    href: category === "leads" ? "/admin/leads" : category === "conversations" ? "/admin/conversations" : category === "bookings" ? "/admin/bookings" : category === "email" ? "/admin/email" : null,
  }
}

export function AdminRealtimeProvider({ children, initialEvents = [] }: { children: React.ReactNode; initialEvents?: AdminEvent[] }) {
  const [events, setEvents] = React.useState(initialEvents)
  const [paused, setPaused] = React.useState(false)
  const [queued, setQueued] = React.useState<AdminEvent[]>([])
  const [connection, setConnection] = React.useState<FeedContextValue["connection"]>("connecting")
  const [attempt, setAttempt] = React.useState(0)
  const pausedRef = React.useRef(paused)
  React.useEffect(() => { pausedRef.current = paused }, [paused])

  const push = React.useCallback((event: AdminEvent) => {
    if (pausedRef.current) setQueued((current) => current.some((item) => item.id === event.id) ? current : [event, ...current].slice(0, 200))
    else setEvents((current) => [event, ...current.filter((item) => item.id !== event.id)].slice(0, 300))
  }, [])

  React.useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`admin-operations-${attempt}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_events" }, (payload) => push(realtimeEvent(payload.new as Record<string, unknown>)))
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") setConnection("live")
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConnection("reconnecting")
        window.setTimeout(() => setAttempt((value) => value + 1), Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)))
      }
      if (status === "CLOSED") setConnection("offline")
    })
    return () => { void supabase.removeChannel(channel) }
  }, [attempt, push])

  const value = React.useMemo<FeedContextValue>(() => ({
    events, isPaused: paused, pendingCount: queued.length, connection,
    pause: () => setPaused(true),
    resume: () => { setEvents((current) => [...queued, ...current].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index).slice(0, 300)); setQueued([]); setPaused(false) },
    clear: () => setEvents([]),
  }), [events, paused, queued, connection])
  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>
}