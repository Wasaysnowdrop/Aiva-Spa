"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock,
  Combine,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquareText,
  MoreHorizontal,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Trash2,
  User,
} from "lucide-react"

import { LeadStatusBadge } from "@/components/dashboard/lead-status-badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Lead, NotificationLog, TeamMember } from "@/lib/supabase/types"
import { mapLead, mapNotificationLog } from "@/lib/supabase/types"
import { cn, formatDateTime, formatRelativeTime } from "@/lib/utils"
import { useRealtimeSubscription } from "@/lib/hooks/use-realtime"
import { isActiveBooking, mapCalendarBooking, type CalendarBooking } from "@/lib/calendar/shared"
import { updateBookingStatusAction } from "@/app/actions/calendar"
import {
  deleteLeadAction,
  findDuplicateAction,
  reopenLeadChatAction,
  sendLeadMessageAction,
  updateLeadNotesAction,
  updateLeadStatusAction,
} from "@/app/actions/leads"
import {
  MergeDuplicatesDialog,
  MergedHistoryList,
  type Candidate,
} from "@/components/dashboard/merge-duplicates-dialog"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"


const statusOptions = [
  { value: "new" as const, label: "New" },
  { value: "contacted" as const, label: "Contacted" },
  { value: "booked" as const, label: "Booked" },
  { value: "lost" as const, label: "Lost" },
]

export function LeadDetail({ lead: initialLead }: { lead: Lead }) {
  const router = useRouter()
  const safeInitialLead: Lead = initialLead ?? ({} as Lead)

  const { data: liveLeads } = useRealtimeSubscription<Lead>({
    table: "leads",
    initialData: [safeInitialLead],
    mapRow: (row) => mapLead(row),
    getId: (item) => item.id,
  })

  const { data: teamMembers } = useRealtimeSubscription<TeamMember>({
    table: "team_members",
    initialData: [],
    getId: (item) => item.id,
  })

  const { data: events, setData: setEvents } = useRealtimeSubscription<CalendarBooking>({
    table: "calendar_bookings",
    initialData: [],
    mapRow: (row) => mapCalendarBooking(row),
    getId: (item) => item.id,
  })

  const { data: notificationLogs } = useRealtimeSubscription<NotificationLog>({
    table: "notification_logs",
    initialData: [],
    orderBy: { column: "sent_at", ascending: false },
    mapRow: (row) => mapNotificationLog(row),
    getId: (item) => item.id,
  })

  if (typeof window !== "undefined") {
    console.log("[aivaspa] Selected Lead:", safeInitialLead)
  }

  const safeLiveLeads = (Array.isArray(liveLeads) ? liveLeads : [])
    .filter((l): l is Lead => Boolean(l?.id))
    .map((l) => ({ ...l }))
  const safeTeamMembers = (Array.isArray(teamMembers) ? teamMembers : [])
    .filter((m): m is TeamMember => Boolean(m?.id))
    .map((m) => ({ ...m }))
  const safeEvents = (Array.isArray(events) ? events : [])
    .filter((e): e is CalendarBooking => Boolean(e?.id))
    .map((e) => ({ ...e }))
  const leadNotifications = (Array.isArray(notificationLogs) ? notificationLogs : [])
    .filter((log): log is NotificationLog => Boolean(log?.id) && log.leadId === safeInitialLead.id)
    .slice(0, 5)

  const calendarEvent = safeInitialLead?.id
    ? safeEvents
        .filter((event) => event.leadId === safeInitialLead.id)
        .sort((a, b) => Number(isActiveBooking(b.status)) - Number(isActiveBooking(a.status)) || b.createdAt.localeCompare(a.createdAt))[0]
    : undefined

  const lead: Lead = (safeInitialLead?.id
    ? safeLiveLeads.find((l) => l?.id === safeInitialLead.id) ?? safeInitialLead
    : safeLiveLeads[0] ?? safeInitialLead) || ({} as Lead)
  const safeLead: Lead = lead?.id ? lead : ({} as Lead)
  const [status, setStatus] = React.useState(() => safeLead?.status ?? "new")
  const [note, setNote] = React.useState(() => safeLead?.notes ?? "")
  const [updating, setUpdating] = React.useState(false)
  const [candidates, setCandidates] = React.useState<Candidate[] | null>(null)
  const [loadingDupes, setLoadingDupes] = React.useState(false)
  const [mergeOpen, setMergeOpen] = React.useState(false)
  const [savingNote, setSavingNote] = React.useState(false)
  const messageChannel = "email" as const
  const [messageBody, setMessageBody] = React.useState("")
  const [sendingMessage, setSendingMessage] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [reopening, setReopening] = React.useState(false)
  const [cancellingBooking, setCancellingBooking] = React.useState(false)

  React.useEffect(() => {
    if (!safeLead?.id) {
      Promise.resolve().then(() => setCandidates([]))
      return
    }
    if (!safeLead.phoneNormalized && !safeLead.emailNormalized) {
      Promise.resolve().then(() => setCandidates([]))
      return
    }
    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) setLoadingDupes(true)
    })
    void (async () => {
      const out: Candidate[] = []
      try {
        if (safeLead.phoneNormalized) {
          const phoneRes = await findDuplicateAction({
            phone: safeLead.phone ?? "",
            excludeLeadId: safeLead.id,
          })
          if (phoneRes.ok && phoneRes.data.duplicate?.id && phoneRes.data.matchType === "phone") {
            out.push({ lead: phoneRes.data.duplicate, matchType: "phone" })
          }
        }
        if (safeLead.emailNormalized) {
          const emailRes = await findDuplicateAction({
            email: safeLead.email ?? "",
            excludeLeadId: safeLead.id,
          })
          if (
            emailRes.ok &&
            emailRes.data.duplicate?.id &&
            emailRes.data.matchType === "email"
          ) {
            const dup = emailRes.data.duplicate
            if (dup?.id && !out.find((c) => c.lead.id === dup.id)) {
              out.push({ lead: dup, matchType: "email" })
            }
          }
        }
      } finally {
        if (!cancelled) {
          setCandidates(out)
          setLoadingDupes(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [safeLead?.id, safeLead?.phone, safeLead?.email, safeLead?.phoneNormalized, safeLead?.emailNormalized])

  const handleStatusChange = async (newStatus: typeof status) => {
    if (!safeLead?.id) return
    setStatus(newStatus)
    setUpdating(true)
    try {
      const result = await updateLeadStatusAction(safeLead.id, newStatus)
      if (!result.ok) throw new Error(result.error)
      toast.success("Status updated")
    } catch {
      setStatus(safeLead?.status ?? "new")
      toast.error("Failed to update status")
    } finally {
      setUpdating(false)
    }
  }

  const handleCancelBooking = async () => {
    if (!calendarEvent || cancellingBooking) return
    setCancellingBooking(true)
    try {
      const result = await updateBookingStatusAction(calendarEvent.id, "cancelled")
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setEvents((current) => current.map((event) => event.id === result.data.id ? result.data : event))
      toast.success("Booking cancelled")
    } finally {
      setCancellingBooking(false)
    }
  }
  const handleSaveNote = async () => {
    if (!safeLead?.id) {
      toast.error("Lead is not loaded yet")
      return
    }
    setSavingNote(true)
    try {
      const result = await updateLeadNotesAction(safeLead.id, note)
      if (result.ok) {
        toast.success("Note saved")
      } else {
        toast.error(result.error ?? "Failed to save note")
      }
    } finally {
      setSavingNote(false)
    }
  }

  const handleSendMessage = async () => {
    if (!safeLead?.id) {
      toast.error("Lead is not loaded yet")
      return
    }
    if (!messageBody.trim()) {
      toast.error("Type a message first")
      return
    }
    setSendingMessage(true)
    try {
      const result = await sendLeadMessageAction({
        leadId: safeLead.id,
        channel: messageChannel,
        body: messageBody,
      })
      if (result.ok) {
        toast.success(
          `Sent via ${result.data.channel} to ${result.data.recipient}`,
        )
        setMessageBody("")
      } else {
        toast.error(result.error ?? "Failed to send")
      }
    } finally {
      setSendingMessage(false)
    }
  }

  const handleReopenChat = async () => {
    if (!safeLead.id || reopening) return
    setReopening(true)
    try {
      const result = await reopenLeadChatAction(safeLead.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Chat reopened")
      router.push(
        "/dashboard/conversations?conversation=" +
          encodeURIComponent(result.data.conversationId),
      )
    } finally {
      setReopening(false)
    }
  }

  const handleDelete = async () => {
    if (!safeLead.id || deleting) return
    setDeleting(true)
    try {
      const result = await deleteLeadAction(safeLead.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setDeleteOpen(false)
      toast.success("Lead deleted")
      router.replace("/dashboard/leads")
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  const copyValue = async (label: string, value: string) => {
    if (!value) {
      toast.error("No " + label.toLowerCase() + " is available")
      return
    }
    await navigator.clipboard.writeText(value)
    toast.success(label + " copied")
  }

  const assignee = safeLead?.assignedTo
    ? safeTeamMembers.find((m) => m?.id === safeLead.assignedTo)
    : undefined
  const safeAssignee: TeamMember | null = assignee?.id ? assignee : null

  const leadName = safeLead?.name ?? "Unknown lead"
  const leadInitials =
    leadName
      .split(" ")
      .map((n) => n?.[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "?"

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-5">
        <section className="rounded-2xl border border-[#23252A] bg-[#121316]">
          <div className="flex flex-wrap items-start gap-4 border-b border-[#23252A] p-5">
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-[#08090A]"
              style={{
                background: `linear-gradient(135deg, ${
                  safeLead?.service === "Botox"
                    ? "#E2E54B"
                    : safeLead?.service === "Fillers"
                      ? "#5E6AD2"
                      : safeLead?.service === "Laser"
                        ? "#22D3EE"
                        : safeLead?.service === "Facials"
                          ? "#34D399"
                          : safeLead?.service === "Microneedling"
                            ? "#FF77E9"
                            : "#8A8F98"
                }, #1A1B1E)`,
              }}
            >
              {leadInitials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-[#F7F8F8]">{leadName}</h2>
                <LeadStatusBadge status={status} />
                {lead?.afterHours ? (
                  <span className="rounded-md border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#22D3EE]">
                    After hours
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-[#8A8F98]">
                Interested in{" "}
                <span className="font-semibold text-[#F7F8F8]">{lead?.service ?? "—"}</span> · preferred{" "}
                <span className="text-[#F7F8F8]">{lead?.preferredTime ?? "—"}</span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <a
                  href={lead?.email ? `mailto:${lead.email}` : "#"}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#23252A] bg-[#0B0C0E] px-2.5 py-1.5 text-[#F7F8F8] hover:border-[#3A3D44]"
                >
                  <Send className="size-3" /> {lead?.email ?? "no email"}
                </a>
                <a
                  href={lead?.phone ? `tel:${lead.phone.replace(/\D/g, "")}` : "#"}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#23252A] bg-[#0B0C0E] px-2.5 py-1.5 text-[#F7F8F8] hover:border-[#3A3D44]"
                >
                  <Phone className="size-3" /> {lead?.phone ?? "no phone"}
                </a>
                {lead?.sourceUrl ? (
                  <a
                    href={lead.sourceUrl}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#23252A] bg-[#0B0C0E] px-2.5 py-1.5 text-[#8A8F98] hover:border-[#3A3D44] hover:text-[#F7F8F8]"
                  >
                    <ExternalLink className="size-3" /> {lead.sourceUrl}
                  </a>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={status} onValueChange={handleStatusChange} disabled={updating}>
                <SelectTrigger className="h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <LeadStatusBadge status={s.value} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMergeOpen(true)}
                disabled={!candidates || candidates.length === 0}
                title={
                  !candidates || candidates.length === 0
                    ? "No duplicates detected for this lead"
                    : `Merge ${candidates.length} duplicate${candidates.length === 1 ? "" : "s"} into this lead`
                }
              >
                <Combine className="size-4" />
                {candidates && candidates.length > 0 ? `Merge (${candidates.length})` : "Find duplicates"}
              </Button>
              <Button size="sm" className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90">
                <Sparkles className="size-4" /> Call back
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px border-b border-[#23252A] bg-[#23252A] sm:grid-cols-4">
            {[
              { label: "Source", value: safeLead?.source ?? "—" },
              { label: "Created", value: safeLead?.createdAt ? formatDateTime(safeLead.createdAt) : "—" },
              { label: "Last activity", value: safeLead?.lastActivityAt ? formatRelativeTime(safeLead.lastActivityAt) : "—" },
              { label: "Consent", value: safeLead?.consentGiven ? "Captured" : "Not recorded" },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#121316] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#62666D]">
                  {stat.label}
                </p>
                <p className="mt-1.5 text-sm font-medium text-[#F7F8F8]">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[#F7F8F8]">Conversation transcript</h3>
                <span className="rounded-md border border-[#23252A] bg-[#0B0C0E] px-1.5 py-0.5 text-[10px] font-mono text-[#8A8F98]">
                  {(lead?.transcript ?? []).length} messages
                </span>
              </div>
              <Button variant="ghost" size="sm">
                <FileText className="size-4" />
                Export transcript
              </Button>
            </div>

            <ol className="space-y-4">
              {(safeLead?.transcript ?? []).map((msg, idx) => (
                <li
                  key={msg?.id ?? `transcript-${idx}`}
                  className={cn(
                    "flex gap-3",
                    msg?.role === "visitor" ? "" : "flex-row-reverse",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                      msg?.role === "ai"
                        ? "bg-[#5E6AD2]/15 text-[#5E6AD2]"
                        : msg?.role === "staff"
                          ? "bg-[#4CB782]/15 text-[#4CB782]"
                          : "bg-[#E2E54B]/15 text-[#E2E54B]",
                    )}
                  >
                    {msg?.role === "ai" ? (
                      <Bot className="size-3.5" />
                    ) : msg?.role === "staff" ? (
                      <User className="size-3.5" />
                    ) : (
                      (msg?.content ?? "")
                        .split(" ")
                        .map((w) => w?.[0])
                        .filter(Boolean)
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    )}
                  </span>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-6",
                      msg?.role === "ai"
                        ? "rounded-tl-sm border border-[#23252A] bg-[#0B0C0E] text-[#F7F8F8]"
                        : msg?.role === "staff"
                          ? "rounded-tl-sm border border-[#4CB782]/30 bg-[#4CB782]/10 text-[#F7F8F8]"
                          : "rounded-tr-sm bg-[#E2E54B] text-[#08090A]",
                    )}
                  >
                    <p>{msg?.content ?? ""}</p>
                    <p
                      className={cn(
                        "mt-1.5 text-[10px]",
                        msg?.role === "visitor" ? "text-[#08090A]/60" : "text-[#62666D]",
                      )}
                    >
                      {msg?.role === "ai" ? "AivaSpa" : msg?.role === "staff" ? "Staff" : leadName}{" "}
                      · {msg?.timestamp ?? ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#23252A] bg-[#0B0C0E] p-2.5">
              <div className="flex-1 space-y-2">
                <Textarea
                  placeholder="Send an email to the lead..."
                  className="min-h-12 border-0 bg-transparent focus-visible:ring-0"
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                />
                <div className="flex items-center gap-2 px-1">
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition",
                      "border-[#5E6AD2]/40 bg-[#5E6AD2]/10 text-[#5E6AD2]",
                    )}
                  >
                    Email
                  </button>
<span className="text-[10px] text-[#62666D]">{safeLead?.email ?? "no email"}</span>
                </div>
              </div>
              <Button
                size="sm"
                className="shrink-0 bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
                onClick={handleSendMessage}
                disabled={sendingMessage || !messageBody.trim()}
              >
                {sendingMessage ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Send
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
          <div className="mb-3 flex items-center gap-2">
            <StickyNote className="size-4 text-[#8A8F98]" />
            <h3 className="text-sm font-semibold text-[#F7F8F8]">Internal notes</h3>
            <span className="text-xs text-[#62666D]">Only visible to your team</span>
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add notes about this lead…"
            className="min-h-24"
          />
          <div className="mt-3 flex items-center justify-between text-xs text-[#62666D]">
            <span>{note.length} chars · saved on click</span>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleSaveNote}
              disabled={savingNote || note === (safeLead?.notes ?? "")}
            >
              {savingNote ? (
                <><Loader2 className="size-3 animate-spin" /> Saving…</>
              ) : (
                "Save note"
              )}
            </Button>
          </div>
        </section>
      </div>

      <aside className="flex flex-col gap-5">
        <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
          <div className="flex items-center gap-2">
            <Combine className="size-4 text-[#E2E54B]" />
            <h3 className="text-sm font-semibold text-[#F7F8F8]">Possible duplicates</h3>
            {loadingDupes ? <Loader2 className="size-3.5 animate-spin text-[#62666D]" /> : null}
          </div>
          {(!candidates || candidates.length === 0) && !loadingDupes ? (
            <p className="mt-3 text-[10px] text-[#8A8F98]">
              No other leads share this phone or email. The widget, the API, and the inbox all
              auto-merge at capture time.
            </p>
          ) : null}
          {candidates && candidates.length > 0 ? (
            <>
          <ul className="mt-3 space-y-2">
            {candidates
              ?.filter((c) => Boolean(c?.lead?.id))
              .map((c) => (
                <li
                  key={c.lead.id}
                  className="rounded-lg border border-[#23252A] bg-[#0B0C0E] p-2.5 text-xs"
                >
                  <p className="truncate font-semibold text-[#F7F8F8]">{c.lead.name}</p>
                  <p className="truncate text-[10px] text-[#8A8F98]">
                    {c.lead.email || "no email"} · {c.lead.phone || "no phone"}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="rounded-md border border-[#5E6AD2]/30 bg-[#5E6AD2]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#5E6AD2]">
                      {c.matchType}
                    </span>
                    <span className="text-[10px] text-[#62666D]">
                      {c.lead.source} · {formatRelativeTime(c.lead.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
          </ul>
              <Button
                size="sm"
                className="mt-3 w-full bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
                onClick={() => setMergeOpen(true)}
              >
                <Combine className="size-4" />
                Review & merge
              </Button>
            </>
          ) : null}

          {safeLead?.mergedFrom && safeLead.mergedFrom.length > 0 ? (
            <div className="mt-4 border-t border-[#23252A] pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A8F98]">
                Merged into this lead
              </p>
              <MergedHistoryList entries={safeLead.mergedFrom} />
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
          <h3 className="text-sm font-semibold text-[#F7F8F8]">Pipeline progress</h3>
          <ol className="mt-4 space-y-3">
            {(["new", "contacted", "booked"] as const).map((step, i) => {
              const order: typeof status[] = ["new", "contacted", "booked"]
              const currentIndex = order.indexOf(status)
              const stepIndex = order.indexOf(step)
              const isComplete = stepIndex < currentIndex
              const isCurrent = stepIndex === currentIndex
              return (
                <li key={step} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold",
                      isComplete
                        ? "border-[#4CB782] bg-[#4CB782] text-[#08090A]"
                        : isCurrent
                          ? "border-[#E2E54B] bg-[#E2E54B] text-[#08090A]"
                          : "border-[#23252A] bg-[#0B0C0E] text-[#62666D]",
                    )}
                  >
                    {isComplete ? <CheckCircle2 className="size-3.5" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold capitalize text-[#F7F8F8]">{step}</p>
                    <p className="text-[10px] text-[#62666D]">
                      {isComplete
                        ? "Completed"
                        : isCurrent
                          ? "In progress"
                          : "Pending"}
                    </p>
                  </div>
                  {isCurrent ? (
                    <Clock className="size-3.5 text-[#E2E54B]" />
                  ) : null}
                </li>
              )
            })}
          </ol>
        </div>

        <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-[#5E6AD2]" />
            <h3 className="text-sm font-semibold text-[#F7F8F8]">Calendar</h3>
          </div>
          {calendarEvent ? (
            <div className="mt-3 space-y-2">
              <div className="rounded-lg border border-[#23252A] bg-[#0B0C0E] p-2.5">
                <p className="text-xs font-semibold text-[#F7F8F8]">
                  {calendarEvent.service}
                </p>
                <p className="mt-1 text-[10px] text-[#8A8F98]">
                  {formatDateTime(calendarEvent.startAt)} →{" "}
                  {formatDateTime(calendarEvent.endAt)}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md border border-[#4CB782]/30 bg-[#4CB782]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#4CB782]">
                    {calendarEvent.status}
                  </span>
                </div>
                {calendarEvent.notes ? (
                  <p className="mt-2 text-[10px] text-[#8A8F98]">
                    {calendarEvent.notes}
                  </p>
                ) : null}
                <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                  <Button asChild size="xs" variant="outline">
                    <Link href={`/dashboard/calendar?booking=${calendarEvent.id}`}>View booking</Link>
                  </Button>
                  {isActiveBooking(calendarEvent.status) ? <Button asChild size="xs" variant="outline">
                    <Link href={`/dashboard/calendar?reschedule=${calendarEvent.id}`}>Reschedule</Link>
                  </Button> : null}
                  {isActiveBooking(calendarEvent.status) ? <Button size="xs" variant="ghost" className="text-[#EB5757] hover:text-[#EB5757]" disabled={cancellingBooking} onClick={() => void handleCancelBooking()}>
                    {cancellingBooking ? <Loader2 className="size-3 animate-spin" /> : null} Cancel
                  </Button> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-[10px] text-[#8A8F98]">
                No exact appointment time is linked yet. Free-text preferences stay unscheduled until your team confirms a slot.
              </p>
              <Button asChild size="xs" variant="outline" className="mt-2 w-full">
                <Link href={`/dashboard/calendar?lead=${safeLead.id}`}>Schedule booking</Link>
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
          <h3 className="text-sm font-semibold text-[#F7F8F8]">Assignment</h3>
          <Select defaultValue={safeLead?.assignedTo ?? undefined}>
            <SelectTrigger className="mt-3 w-full">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              {safeTeamMembers.map((m, i) => (
                <SelectItem key={m?.id ?? `member-${i}`} value={m?.id ?? ""}>
                  {m?.name ?? "Unknown"} — {m?.role ?? "Staff"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {safeAssignee ? (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-[#23252A] bg-[#0B0C0E] p-2.5">
              <span
                className="flex size-8 items-center justify-center rounded-full text-xs font-semibold text-[#08090A]"
                style={{ background: safeAssignee.avatarColor ?? "#8A8F98" }}
              >
                {(safeAssignee.name ?? "??")
                  .split(" ")
                  .map((n) => n?.[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#F7F8F8]">{safeAssignee.name ?? "Unknown"}</p>
                <p className="text-[10px] text-[#62666D]">
                  {safeAssignee.role ?? "Staff"} · {safeAssignee.lastActiveAt ?? "—"}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#F7F8F8]">Notifications</h3>
            {leadNotifications.length > 0 ? (
              <span className="rounded-md border border-[#4CB782]/30 bg-[#4CB782]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#4CB782]">
                {leadNotifications.filter((log) => log.status === "delivered").length} delivered
              </span>
            ) : null}
          </div>
          {leadNotifications.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {leadNotifications.map((notification) => (
                <li
                  key={notification.id}
                  className="flex items-center justify-between rounded-lg border border-[#23252A] bg-[#0B0C0E] px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-semibold text-[#F7F8F8]">{notification.channel}</p>
                    <p className="text-[10px] text-[#62666D]">{notification.recipient}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-[10px] capitalize",
                        notification.status === "failed" ? "text-[#EB5757]" : "text-[#8A8F98]",
                      )}
                    >
                      {notification.status}
                    </p>
                    <span className="text-[10px] text-[#62666D]">
                      {formatRelativeTime(notification.sentAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[10px] text-[#8A8F98]">
              No notification deliveries recorded for this lead.
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#4CB782]" />
            <h3 className="text-sm font-semibold text-[#F7F8F8]">Compliance</h3>
          </div>
          <ul className="mt-3 space-y-2 text-xs">
            <li className="flex items-center gap-2 text-[#8A8F98]">
              <CheckCircle2
                className={cn(
                  "size-3.5",
                  safeLead?.consentGiven ? "text-[#4CB782]" : "text-[#EB5757]",
                )}
              />
              Consent captured
            </li>
            <li className="flex items-center gap-2 text-[#8A8F98]">
              <CheckCircle2 className="size-3.5 text-[#4CB782]" />
              AI used approved KB only
            </li>
            <li className="flex items-center gap-2 text-[#8A8F98]">
              <CheckCircle2 className="size-3.5 text-[#4CB782]" />
              Pricing deferred to consultation
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            disabled={reopening}
            onClick={() => void handleReopenChat()}
          >
            {reopening ? <Loader2 className="size-4 animate-spin" /> : <MessageSquareText className="size-4" />}
            Reopen chat
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <MoreHorizontal className="size-4" /> More actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onSelect={() => void copyValue("Email", safeLead.email)}>
                <Copy className="size-4" /> Copy email
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copyValue("Phone", safeLead.phone)}>
                <Copy className="size-4" /> Copy phone
              </DropdownMenuItem>
              {safeLead.sourceUrl && safeLead.sourceUrl !== "/" ? (
                <DropdownMenuItem
                  onSelect={() => window.open(safeLead.sourceUrl, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="size-4" /> Open source page
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start text-[#EB5757] hover:bg-[#EB5757]/10 hover:text-[#EB5757]"
            disabled={deleting}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" /> Delete lead
          </Button>
        </div>
      </aside>

      <Dialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {leadName}?</DialogTitle>
            <DialogDescription>
              This removes the lead and linked conversation from the dashboard. This action cannot be undone from the dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={deleting}
              className="bg-[#EB5757] text-white hover:bg-[#EB5757]/90"
              onClick={() => void handleDelete()}
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MergeDuplicatesDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        primary={safeLead?.id ? safeLead : null}
        candidates={candidates ?? []}
        onMerged={() => {
          toast.success("Leads merged")
          setCandidates([])
        }}
      />
    </div>
  )
}
