"use client"

import * as React from "react"
import Link from "next/link"
import {
  Bot,
  ChevronRight,
  Clock,
  MessageSquareText,
  Radio,
  Search,
  Sparkles,
  User,
  Wand2,
} from "lucide-react"

import { LeadStatusBadge } from "@/components/dashboard/lead-status-badge"
import { Input } from "@/components/ui/input"
import type { ChatSession, Lead } from "@/lib/supabase/types"
import { cn, formatRelativeTime } from "@/lib/utils"
import { useRealtimeSubscription } from "@/lib/hooks/use-realtime"
import { mapChatSession, mapLead } from "@/lib/supabase/types"
import { isCustomerConversation } from "@/lib/conversations/eligibility"

type OutcomeFilter = "all" | "lead" | "abandoned" | "live"
type ConversationItem =
  | { kind: "lead"; data: Lead; lastActivity: string }
  | { kind: "session"; data: ChatSession; lastActivity: string }

export function ConversationsList({
  leads: initialLeads,
  liveSessions: initialLiveSessions,
  initialConversationId,
}: {
  leads: Lead[]
  liveSessions: ChatSession[]
  initialConversationId?: string | null
}) {
  const { data: leads } = useRealtimeSubscription<Lead>({
    table: "leads",
    initialData: initialLeads,
    mapRow: (row) => mapLead(row),
    getId: (item) => item.id,
  })

  const { data: sessions, setData: setSessions } = useRealtimeSubscription<ChatSession>({
    table: "chat_sessions",
    initialData: initialLiveSessions,
    mapRow: (row) => mapChatSession(row),
    getId: (item) => item.id,
  })

  // Drop sessions that have already been captured as leads (the lead view
  // already shows the full transcript — no need to duplicate).
  const visibleSessions = React.useMemo(
    () =>
      sessions.filter(
        (session) => isCustomerConversation(session) && !session.leadCaptured,
      ),
    [sessions],
  )

  const items = React.useMemo<ConversationItem[]>(() => {
    const reopenedLeadIds = new Set(
      visibleSessions.map((session) => session.leadId).filter(Boolean),
    )
    const leadItems: ConversationItem[] = leads
      .filter((lead) => !reopenedLeadIds.has(lead.id))
      .map((l) => ({
        kind: "lead",
        data: l,
        lastActivity: l.lastActivityAt,
      }))
    const sessionItems: ConversationItem[] = visibleSessions.map((s) => ({
      kind: "session",
      data: s,
      lastActivity: s.lastMessageAt,
    }))
    const merged = [...sessionItems, ...leadItems]
    merged.sort((a, b) => (a.lastActivity < b.lastActivity ? 1 : -1))
    return merged
  }, [leads, visibleSessions])

  const [query, setQuery] = React.useState("")
  const [outcome, setOutcome] = React.useState<OutcomeFilter>("all")
  const [activeId, setActiveId] = React.useState<string | null>(() =>
    initialConversationId ? "session:" + initialConversationId : null,
  )

  const filtered = React.useMemo(
    () =>
      items.filter((item) => {
        if (outcome === "live" && item.kind !== "session") return false
        if (outcome === "lead" && item.kind !== "lead") return false
        if (outcome === "abandoned") {
          if (item.kind === "lead" && item.data.status !== "lost") return false
          if (item.kind === "session" && item.data.status !== "abandoned") return false
        }
        if (query) {
          const q = query.toLowerCase()
          if (item.kind === "lead") {
            const inTranscript = item.data.transcript.some((m) =>
              m.content.toLowerCase().includes(q),
            )
            const inLead = item.data.name.toLowerCase().includes(q)
            if (!inTranscript && !inLead) return false
          } else {
            const inTranscript = item.data.transcript.some((m) =>
              m.content.toLowerCase().includes(q),
            )
            const inName = (item.data.visitorName ?? "").toLowerCase().includes(q)
            if (!inTranscript && !inName) return false
          }
        }
        return true
      }),
    [items, query, outcome],
  )

  // Derive the active item purely from the user's selection (activeId). If
  // the user hasn't picked anything, or the picked item is no longer in the
  // filtered list, fall back to the first item. Pure derivation — no effects.
  const active = React.useMemo(() => {
    if (activeId) {
      const found = filtered.find((i) => itemKey(i) === activeId)
      if (found) return found
    }
    return filtered[0]
  }, [filtered, activeId])

  const liveCount = visibleSessions.length

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="flex max-h-[calc(100vh-220px)] flex-col overflow-hidden rounded-2xl border border-[#23252A] bg-[#121316]">
        <div className="flex flex-col gap-3 border-b border-[#23252A] p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#62666D]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transcripts…"
              className="h-9 w-full pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {(
              [
                { v: "all" as const, label: "All" },
                { v: "live" as const, label: `Live${liveCount ? ` (${liveCount})` : ""}` },
                { v: "lead" as const, label: "Converted" },
                { v: "abandoned" as const, label: "Abandoned" },
              ]
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setOutcome(opt.v)}
                className={cn(
                  "flex-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition",
                  outcome === opt.v
                    ? "border-[#E2E54B]/40 bg-[#E2E54B]/10 text-[#E2E54B]"
                    : "border-[#23252A] bg-[#0B0C0E] text-[#8A8F98] hover:text-[#F7F8F8]",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-[#23252A]">
          {filtered.map((item) =>
            item.kind === "lead" ? (
              <LeadRow
                key={`lead:${item.data.id}`}
                lead={item.data}
                active={active ? itemKey(active) === `lead:${item.data.id}` : false}
                onSelect={() => setActiveId(`lead:${item.data.id}`)}
              />
            ) : (
              <SessionRow
                key={`session:${item.data.id}`}
                session={item.data}
                active={active ? itemKey(active) === `session:${item.data.id}` : false}
                onSelect={() => setActiveId(`session:${item.data.id}`)}
              />
            ),
          )}
          {filtered.length === 0 ? (
            <li className="p-6 text-center text-xs text-[#8A8F98]">
              No conversations match your filter.
            </li>
          ) : null}
        </ul>
      </aside>

      <section className="flex max-h-[calc(100vh-220px)] flex-col overflow-hidden rounded-2xl border border-[#23252A] bg-[#121316]">
        {active ? (
          active.kind === "lead" ? (
            <LeadDetailPanel lead={active.data} />
          ) : (
            <SessionDetailPanel
              session={active.data}
              onCapturedLead={(leadId) => {
                setSessions((prev) =>
                  prev.filter((s) => s.id !== active.data.id && s.leadId !== leadId),
                )
                setActiveId(null)
              }}
            />
          )
        ) : (
          <EmptyConversations />
        )}
      </section>
    </div>
  )
}

function itemKey(item: ConversationItem): string {
  return item.kind === "lead" ? `lead:${item.data.id}` : `session:${item.data.id}`
}

function LeadRow({
  lead,
  active,
  onSelect,
}: {
  lead: Lead
  active: boolean
  onSelect: () => void
}) {
  const last = lead.transcript[lead.transcript.length - 1]
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "group flex w-full items-start gap-3 px-3 py-3 text-left transition",
          active ? "bg-[#1A1B1E]" : "hover:bg-[#1A1B1E]/60",
        )}
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[#08090A]"
          style={{
            background: `linear-gradient(135deg, ${lead.service === "Botox"
                ? "#E2E54B"
                : lead.service === "Fillers"
                  ? "#5E6AD2"
                  : lead.service === "Laser"
                    ? "#22D3EE"
                    : lead.service === "Facials"
                      ? "#34D399"
                      : lead.service === "Microneedling"
                        ? "#FF77E9"
                        : "#8A8F98"
              }, #1A1B1E)`,
          }}
        >
          {lead.name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p
              className={cn(
                "truncate text-xs font-semibold",
                active ? "text-[#E2E54B]" : "text-[#F7F8F8]",
              )}
            >
              {lead.name}
            </p>
            <span className="text-[10px] text-[#62666D]">
              {formatRelativeTime(lead.lastActivityAt)}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-[#8A8F98]">
            {last ? `${last.role === "visitor" ? "" : "AI: "}${last.content}` : "—"}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <LeadStatusBadge status={lead.status} className="!h-4 !text-[9px]" />
            <span className="text-[10px] text-[#62666D]">
              {lead.transcript.length} msgs
            </span>
          </div>
        </div>
      </button>
    </li>
  )
}

function SessionRow({
  session,
  active,
  onSelect,
}: {
  session: ChatSession
  active: boolean
  onSelect: () => void
}) {
  const last = session.transcript[session.transcript.length - 1]
  const name = session.visitorName?.trim() || `Visitor · ${session.sessionId.slice(-6)}`
  const initials = (session.visitorName ?? "V")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]!.toUpperCase())
    .join("") || "V"
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "group flex w-full items-start gap-3 px-3 py-3 text-left transition",
          active ? "bg-[#1A1B1E]" : "hover:bg-[#1A1B1E]/60",
        )}
      >
        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5E6AD2] to-[#1A1B1E] text-xs font-semibold text-[#F7F8F8]">
          {initials}
          <span className="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-[#4CB782] ring-2 ring-[#121316]">
            <Radio className="size-1.5 text-[#08090A]" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p
              className={cn(
                "truncate text-xs font-semibold",
                active ? "text-[#E2E54B]" : "text-[#F7F8F8]",
              )}
            >
              {name}
            </p>
            <span className="text-[10px] text-[#4CB782]">
              live · {formatRelativeTime(session.lastMessageAt)}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-[#8A8F98]">
            {last ? `${last.role === "visitor" ? "" : "AI: "}${last.content}` : "—"}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="inline-flex h-4 items-center rounded-md border border-[#4CB782]/30 bg-[#4CB782]/10 px-1.5 text-[9px] font-semibold text-[#4CB782]">
              LIVE
            </span>
            <span className="text-[10px] text-[#62666D]">
              {session.messageCount} msgs
            </span>
          </div>
        </div>
      </button>
    </li>
  )
}

function LeadDetailPanel({ lead }: { lead: Lead }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#23252A] p-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-[#F7F8F8]">{lead.name}</h2>
            <LeadStatusBadge status={lead.status} />
          </div>
          <p className="mt-0.5 text-xs text-[#8A8F98]">
            {lead.service} · started {formatRelativeTime(lead.createdAt)} · {lead.transcript.length} messages
          </p>
        </div>
        <Link
          href={`/dashboard/leads/${lead.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#E2E54B] hover:underline"
        >
          Open lead <ChevronRight className="size-3" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto flex max-w-2xl flex-col gap-3.5">
          {lead.transcript.map((msg, i) => (
            <Bubble key={msg.id} msg={msg} prev={lead.transcript[i - 1]} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[#23252A] bg-[#0B0C0E] px-5 py-3 text-xs text-[#8A8F98]">
        <Sparkles className="size-3.5 text-[#E2E54B]" />
        All answers came from the approved knowledge base. No medical or pricing claims.
      </div>
    </>
  )
}

function SessionDetailPanel({
  session,
  onCapturedLead,
}: {
  session: ChatSession
  onCapturedLead: (leadId: string) => void
}) {
  const name = session.visitorName?.trim() || `Visitor · ${session.sessionId.slice(-6)}`
  // Watch for the session being linked to a captured lead.
  React.useEffect(() => {
    if (session.leadCaptured && session.leadId) {
      onCapturedLead(session.leadId)
    }
  }, [session.leadCaptured, session.leadId, onCapturedLead])

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#23252A] p-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-[#F7F8F8]">{name}</h2>
            <span className="inline-flex items-center gap-1 rounded-md border border-[#4CB782]/30 bg-[#4CB782]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#4CB782]">
              <span className="size-1.5 rounded-full bg-[#4CB782]" /> Live
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#8A8F98]">
            started {formatRelativeTime(session.createdAt)} · {session.messageCount} messages ·{" "}
            {session.afterHours ? "after hours" : "in hours"}
          </p>
        </div>
        {session.leadCaptured && session.leadId ? (
          <Link
            href={`/dashboard/leads/${session.leadId}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#E2E54B] hover:underline"
          >
            Open lead <ChevronRight className="size-3" />
          </Link>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto flex max-w-2xl flex-col gap-3.5">
          {session.transcript.map((msg, i) => (
            <Bubble key={msg.id} msg={msg} prev={session.transcript[i - 1]} />
          ))}
          {session.transcript.length === 0 ? (
            <p className="text-center text-xs text-[#62666D]">
              Waiting for the first message…
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[#23252A] bg-[#0B0C0E] px-5 py-3 text-xs text-[#8A8F98]">
        <Radio className="size-3.5 animate-pulse text-[#4CB782]" />
        This visitor is chatting right now. New messages appear instantly.
      </div>
    </>
  )
}

function Bubble({
  msg,
  prev,
}: {
  msg: Lead["transcript"][number]
  prev?: Lead["transcript"][number]
}) {
  const isVisitor = msg.role === "visitor"
  const grouped = prev?.role === msg.role
  return (
    <div className={cn("flex gap-3", isVisitor ? "" : "flex-row-reverse")}>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
          msg.role === "ai"
            ? "bg-[#5E6AD2]/15 text-[#5E6AD2]"
            : msg.role === "staff"
              ? "bg-[#4CB782]/15 text-[#4CB782]"
              : "bg-[#E2E54B]/15 text-[#E2E54B]",
          grouped && "opacity-0",
        )}
      >
        {msg.role === "ai" ? (
          <Bot className="size-3.5" />
        ) : msg.role === "staff" ? (
          <User className="size-3.5" />
        ) : (
          <Wand2 className="size-3.5" />
        )}
      </span>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-6",
          isVisitor
            ? "rounded-tl-sm border border-[#23252A] bg-[#0B0C0E] text-[#F7F8F8]"
            : "rounded-tr-sm bg-[#E2E54B] text-[#08090A]",
        )}
      >
        <p>{msg.content}</p>
        <p
          className={cn(
            "mt-1.5 flex items-center gap-1 text-[10px]",
            isVisitor ? "text-[#62666D]" : "text-[#08090A]/60",
          )}
        >
          <Clock className="size-2.5" />
          {msg.timestamp}
        </p>
      </div>
    </div>
  )
}

function EmptyConversations() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-[#23252A] bg-[#1A1B1E] text-[#8A8F98]">
        <MessageSquareText className="size-5" />
      </span>
      <p className="text-sm font-semibold text-[#F7F8F8]">No conversations yet</p>
      <p className="max-w-sm text-xs text-[#8A8F98]">
        When visitors start chats on your website, every transcript will land here — live as it happens.
      </p>
    </div>
  )
}
