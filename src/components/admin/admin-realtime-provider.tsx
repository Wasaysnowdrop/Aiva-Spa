"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"

export type AdminEvent = {
  id: string
  source:
    | "lead.created"
    | "lead.updated"
    | "conversation.started"
    | "conversation.completed"
    | "webhook.delivered"
    | "webhook.failed"
    | "notification.delivered"
    | "notification.failed"
    | "api_key.used"
    | "user.signed_up"
    | "subscription.changed"
  severity: "info" | "warn" | "error" | "success"
  title: string
  detail: string
  href?: string
  occurredAt: string
}

const MAX_EVENTS = 200

type FeedState = {
  events: AdminEvent[]
  isPaused: boolean
  lastEventAt: string | null
  totalCount: number
}

type FeedContextValue = FeedState & {
  pause: () => void
  resume: () => void
  clear: () => void
  push: (event: AdminEvent) => void
}

const FeedContext = React.createContext<FeedContextValue | null>(null)

export function useAdminFeed() {
  const ctx = React.useContext(FeedContext)
  if (!ctx) throw new Error("useAdminFeed must be used inside AdminRealtimeProvider")
  return ctx
}

const TABLE_TO_EVENT = {
  leads: {
    INSERT: (row: Record<string, unknown>): AdminEvent => ({
      id: `lead-${row.id}-${row.created_at}`,
      source: "lead.created",
      severity: "success",
      title: `New lead · ${String(row.name ?? "Visitor")}`,
      detail: `${String(row.service ?? "Not specified")} · ${String(row.phone ?? "")}`,
      occurredAt: String(row.created_at ?? new Date().toISOString()),
    }),
    UPDATE: (row: Record<string, unknown>): AdminEvent => ({
      id: `lead-upd-${row.id}-${row.updated_at ?? row.last_activity_at ?? Date.now()}`,
      source: "lead.updated",
      severity: "info",
      title: `Lead updated · ${String(row.name ?? "Visitor")}`,
      detail: `Status: ${String(row.status ?? "—")}`,
      occurredAt: String(row.updated_at ?? row.last_activity_at ?? new Date().toISOString()),
    }),
  },
  chat_sessions: {
    INSERT: (row: Record<string, unknown>): AdminEvent => ({
      id: `chat-${row.session_id}-${row.created_at}`,
      source: "conversation.started",
      severity: "info",
      title: `New chat · ${String(row.visitor_name ?? "Visitor")}`,
      detail: String(row.source_url ?? ""),
      occurredAt: String(row.created_at ?? new Date().toISOString()),
    }),
    UPDATE: (row: Record<string, unknown>): AdminEvent => ({
      id: `chat-upd-${row.session_id}-${row.updated_at ?? Date.now()}`,
      source: row.lead_captured
        ? "conversation.completed"
        : "conversation.started",
      severity: row.lead_captured ? "success" : "info",
      title: row.lead_captured
        ? `Lead captured · ${String(row.visitor_name ?? "Visitor")}`
        : `Chat updated · ${String(row.visitor_name ?? "Visitor")}`,
      detail: `Status: ${String(row.status ?? "active")}`,
      occurredAt: String(row.updated_at ?? new Date().toISOString()),
    }),
  },
  webhook_deliveries: {
    INSERT: (row: Record<string, unknown>): AdminEvent => ({
      id: `wh-${row.id}`,
      source: row.success ? "webhook.delivered" : "webhook.failed",
      severity: row.success ? "success" : "error",
      title: row.success
        ? `Webhook ${String(row.response_status ?? "—")} · ${String(row.event ?? "—")}`
        : `Webhook FAILED · ${String(row.event ?? "—")}`,
      detail: String(row.error ?? ""),
      occurredAt: String(row.created_at ?? new Date().toISOString()),
    }),
  },
  notification_logs: {
    INSERT: (row: Record<string, unknown>): AdminEvent => ({
      id: `notif-${row.id}`,
      source:
        row.status === "delivered"
          ? "notification.delivered"
          : "notification.failed",
      severity: row.status === "delivered" ? "success" : "warn",
      title: `${String(row.channel ?? "—")} ${String(row.status ?? "—")}`,
      detail: String(row.recipient ?? ""),
      occurredAt: String(row.sent_at ?? new Date().toISOString()),
    }),
  },
  api_keys: {
    INSERT: (row: Record<string, unknown>): AdminEvent => ({
      id: `apikey-${row.id}`,
      source: "api_key.used",
      severity: "info",
      title: `API key created · ${String(row.name ?? "—")}`,
      detail: Array.isArray(row.scopes) ? (row.scopes as unknown[]).map(String).join(", ") : "",
      occurredAt: String(row.created_at ?? new Date().toISOString()),
    }),
  },
} as const

export function AdminRealtimeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<FeedState>({
    events: [],
    isPaused: false,
    lastEventAt: null,
    totalCount: 0,
  })

  const push = React.useCallback((event: AdminEvent) => {
    setState((prev) => {
      if (prev.isPaused) {
        return { ...prev, totalCount: prev.totalCount + 1, lastEventAt: event.occurredAt }
      }
      const dedup = [event, ...prev.events.filter((e) => e.id !== event.id)]
      return {
        ...prev,
        events: dedup.slice(0, MAX_EVENTS),
        lastEventAt: event.occurredAt,
        totalCount: prev.totalCount + 1,
      }
    })
  }, [])

  React.useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`admin-feed-${Date.now()}`)

    const bind = (
      table: keyof typeof TABLE_TO_EVENT,
      events: Array<"INSERT" | "UPDATE" | "DELETE">,
    ) => {
      const handlers = TABLE_TO_EVENT[table] as Record<string, (row: Record<string, unknown>) => AdminEvent>
      for (const evt of events) {
        const handler = handlers[evt]
        if (!handler) continue
        channel.on(
          "postgres_changes",
          { event: evt, schema: "public", table },
          (payload) => {
            const row =
              (payload.eventType === "DELETE" ? payload.old : payload.new) ?? {}
            push(handler(row as Record<string, unknown>))
          },
        )
      }
    }

    bind("leads", ["INSERT", "UPDATE"])
    bind("chat_sessions", ["INSERT", "UPDATE"])
    bind("webhook_deliveries", ["INSERT"])
    bind("notification_logs", ["INSERT"])
    bind("api_keys", ["INSERT"])

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [push])

  const value = React.useMemo<FeedContextValue>(
    () => ({
      ...state,
      pause: () => setState((s) => ({ ...s, isPaused: true })),
      resume: () =>
        setState((s) => ({ ...s, isPaused: false, totalCount: 0 })),
      clear: () => setState((s) => ({ ...s, events: [], totalCount: 0 })),
      push,
    }),
    [state, push],
  )

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>
}
