"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  CircleDashed,
  Clock,
  FileText,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react"
import { Logo } from "@/components/logo"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { finalizeSetupAssistant } from "@/app/actions/setup-assistant"
import {
  SETUP_ASSISTANT_SECTIONS,
  emptyKnowledgeBase,
  type KnowledgeBase,
  type SetupAssistantSection,
} from "@/lib/ai/setup-assistant-schema"
import { SECTION_INTRO, SECTION_ORDER } from "@/lib/ai/setup-assistant-prompt"

type ChatRole = "user" | "assistant"

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  at: string
}

type SetupAssistantExperienceProps = {
  user: {
    email: string
    fullName: string
    spaName: string
  }
  initialDraft: KnowledgeBase
  initialSection: SetupAssistantSection
  initialHistory: ChatMessage[]
}

const SECTION_LABEL: Record<SetupAssistantSection, string> = {
  business: "Business basics",
  hours: "Hours & timezone",
  services: "Services",
  booking_policy: "Booking policy",
  faqs: "FAQs",
  disclaimers: "Compliance & disclaimers",
  brand_voice: "Brand voice",
  notifications: "Notifications",
  review: "Review & publish",
}

const SECTION_TIP: Record<SetupAssistantSection, string> = {
  business: "Name, website, locations, after-hours policy.",
  hours: "Days open, hours, timezone.",
  services: "What you offer. No firm prices — ranges or 'confirmed at consultation'.",
  booking_policy: "How consultations get scheduled, deposits, cancellations.",
  faqs: "Your top 10 visitor questions and approved answers.",
  disclaimers: "Pricing, medical, and consent text.",
  brand_voice: "Tone, greeting, phrases to avoid.",
  notifications: "Email and SMS recipients for new leads.",
  review: "Confirm the final knowledge base and publish.",
}

const SUGGESTIONS: Record<SetupAssistantSection, string[]> = {
  business: [
    "We're called Glow Aesthetics, located at 123 Main St, San Francisco.",
    "We're a single-location med spa. Our website is glowaesthetics.com.",
  ],
  hours: [
    "Tue–Fri 9 AM–7 PM, Sat 9 AM–5 PM, closed Sun & Mon. Timezone: America/Los_Angeles.",
    "We're open Monday to Saturday, 10am to 6pm.",
  ],
  services: [
    "Botox, dermal fillers, laser hair removal, chemical peels, and facials. Most treatments are 30–60 minutes.",
    "We offer microneedling and HydraFacial. Typical range for Botox is $12–$15 per unit, indicative.",
  ],
  booking_policy: [
    "We follow up manually within 1 business hour. No deposit required.",
    "We use Calendly. Deposit $50, refundable with 24h notice.",
  ],
  faqs: [
    "Do you offer Botox? Yes — Botox is per unit, confirmed at consultation by a licensed provider.",
    "How do I book? Share your name, phone, and preferred time in this chat. We confirm within 1 business hour.",
  ],
  disclaimers: [
    "Use the standard disclaimers.",
    "Standard disclaimers are fine.",
  ],
  brand_voice: [
    "Warm, premium, concise. Greeting: 'Hi! Are you looking to book a consultation or ask about a treatment?'",
    "Friendly and luxurious. Never use 'cheap' or 'guaranteed'.",
  ],
  notifications: [
    "Send new leads to frontdesk@yourmedspa.com and SMS to (555) 123-4567.",
    "Just email me at owner@yourmedspa.com.",
  ],
  review: ["Looks good, publish it."],
}

const FALLBACK_REPLY =
  "Sorry, I had a hiccup. Please try again or rephrase your last message."

function makeId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

function isSectionDone(kb: KnowledgeBase, section: SetupAssistantSection): boolean {
  switch (section) {
    case "business":
      return Boolean(kb.business?.name)
    case "hours":
      return Boolean(kb.hours?.schedule && kb.hours.schedule.length > 0)
    case "services":
      return Array.isArray(kb.services) && kb.services.length > 0
    case "booking_policy":
      return Boolean(kb.booking_policy?.consultationMode)
    case "faqs":
      return Array.isArray(kb.faqs) && kb.faqs.length > 0
    case "disclaimers":
      return Boolean(kb.disclaimers?.standardAccepted !== undefined)
    case "brand_voice":
      return Boolean(kb.brand_voice?.tone)
    case "notifications":
      return Boolean(
        (kb.notifications?.emailRecipients && kb.notifications.emailRecipients.length > 0) ||
          (kb.notifications?.smsRecipients && kb.notifications.smsRecipients.length > 0),
      )
    case "review":
      return Boolean(kb.status?.complete)
    default:
      return false
  }
}

function pickStr(value: unknown): string {
  if (typeof value === "string") return value
  if (value && typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    const v = (value as { value?: unknown }).value
    return typeof v === "string" ? v : ""
  }
  return ""
}

function businessSummary(kb: KnowledgeBase): string {
  const name = pickStr(kb.business?.name) || "—"
  const website = pickStr(kb.business?.website) || "—"
  const addr = kb.business?.addresses?.[0]
  const address = addr ? `${addr.line1}${addr.city ? `, ${addr.city}` : ""}` : "—"
  return `${name} · ${website} · ${address}`
}

function hoursSummary(kb: KnowledgeBase): string {
  const tz = kb.hours?.timezone || "America/Los_Angeles"
  const open = (kb.hours?.schedule ?? []).filter((s) => s.open)
  if (open.length === 0) return `Timezone ${tz} · no hours set`
  const days = open.map((s) => `${s.day} ${s.from}–${s.to}`).join(", ")
  return `${tz} · ${days}`
}

function servicesSummary(kb: KnowledgeBase): string {
  const list = kb.services ?? []
  if (list.length === 0) return "No services yet"
  return list.map((s) => s.name).join(", ")
}

function bookingSummary(kb: KnowledgeBase): string {
  const mode = kb.booking_policy?.consultationMode ?? "manual_follow_up"
  const deposit = kb.booking_policy?.deposit?.required
    ? ` · deposit ${kb.booking_policy.deposit.currency} ${kb.booking_policy.deposit.amount ?? "?"}`
    : ""
  const link = kb.booking_policy?.calendarLink ? ` · ${kb.booking_policy.calendarLink}` : ""
  return `${mode}${deposit}${link}`
}

function faqsSummary(kb: KnowledgeBase): string {
  return `${kb.faqs?.length ?? 0} FAQs captured`
}

function disclaimersSummary(kb: KnowledgeBase): string {
  return kb.disclaimers?.standardAccepted ? "Standard disclaimers accepted" : "Custom disclaimers"
}

function brandSummary(kb: KnowledgeBase): string {
  return `${kb.brand_voice?.tone ?? "warm"} · "${kb.brand_voice?.greeting?.slice(0, 40) ?? "—"}"`
}

function notificationsSummary(kb: KnowledgeBase): string {
  const emails = kb.notifications?.emailRecipients?.length ?? 0
  const sms = kb.notifications?.smsRecipients?.length ?? 0
  return `${emails} email · ${sms} SMS`
}

const SECTION_SUMMARY: Record<SetupAssistantSection, (kb: KnowledgeBase) => string> = {
  business: businessSummary,
  hours: hoursSummary,
  services: servicesSummary,
  booking_policy: bookingSummary,
  faqs: faqsSummary,
  disclaimers: disclaimersSummary,
  brand_voice: brandSummary,
  notifications: notificationsSummary,
  review: (kb) => (kb.status?.complete ? "Ready to publish" : "In review"),
}

export function SetupAssistantExperience({
  user,
  initialDraft,
  initialSection,
  initialHistory,
}: SetupAssistantExperienceProps) {
  const firstName = React.useMemo(
    () => user.fullName.split(" ")[0] || "there",
    [user.fullName],
  )

  const [draft, setDraft] = React.useState<KnowledgeBase>(initialDraft)
  const [section, setSection] = React.useState<SetupAssistantSection>(initialSection)
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialHistory)
  const [input, setInput] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [concerns, setConcerns] = React.useState<string[]>([])
  const [finalizing, setFinalizing] = React.useState(false)
  const [finalizeError, setFinalizeError] = React.useState<string | null>(null)

  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null)

  const completedSections = React.useMemo(
    () => SECTION_ORDER.filter((s) => isSectionDone(draft, s)),
    [draft],
  )

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, sending])

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [sending, section])

  async function send(text?: string) {
    const trimmed = (text ?? input).trim()
    if (!trimmed || sending) return
    setInput("")
    setError(null)
    const userMsg: ChatMessage = {
      id: makeId(),
      role: "user",
      content: trimmed,
      at: formatTime(new Date()),
    }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)
    try {
      const res = await fetch("/api/onboarding/setup-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          userMessage: trimmed,
          currentSection: section,
          draft,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
      }
      const data = (await res.json()) as {
        reply: string
        section: SetupAssistantSection
        nextSection: SetupAssistantSection | null
        action: "ask" | "summarize" | "advance" | "finish"
        concerns: string[]
        draft: KnowledgeBase
      }
      const aiMsg: ChatMessage = {
        id: makeId(),
        role: "assistant",
        content: data.reply || FALLBACK_REPLY,
        at: formatTime(new Date()),
      }
      setMessages((prev) => [...prev, aiMsg])
      setDraft(data.draft)
      if (data.concerns && data.concerns.length > 0) {
        setConcerns((prev) => Array.from(new Set([...prev, ...data.concerns])))
      }
      if (data.nextSection) {
        setSection(data.nextSection)
      } else if (data.section !== section) {
        setSection(data.section)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup assistant error")
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          content: FALLBACK_REPLY,
          at: formatTime(new Date()),
        },
      ])
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  async function resetAndRestart() {
    setMessages([])
    setDraft(emptyKnowledgeBase())
    setSection("business")
    setConcerns([])
    setError(null)
    try {
      await fetch("/api/onboarding/setup-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          history: [],
          userMessage: "Start over.",
          currentSection: "business",
          draft: emptyKnowledgeBase(),
          resume: true,
        }),
      })
    } catch {
      // best-effort reset
    }
  }

  async function publish() {
    setFinalizing(true)
    setFinalizeError(null)
    try {
      const result = await finalizeSetupAssistant(draft)
      if (!result.ok) {
        setFinalizeError(result.error ?? "Failed to publish")
        return
      }
      window.location.href = "/dashboard"
    } catch (e) {
      setFinalizeError(e instanceof Error ? e.message : "Failed to publish")
    } finally {
      setFinalizing(false)
    }
  }

  const currentSectionDone = isSectionDone(draft, section)
  const onReview = section === "review"
  const sectionIntro = SECTION_INTRO[section]
  const sectionTip = SECTION_TIP[section]
  const suggestions = SUGGESTIONS[section] ?? []

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08090A] text-[#F7F8F8]">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-24 h-96 w-96 rounded-full bg-[#E2E54B]/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 bottom-24 h-[28rem] w-[28rem] rounded-full bg-[#5E6AD2]/20 blur-3xl"
      />

      <header className="relative z-10 border-b border-[#23252A]/70 bg-[#08090A]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="AivaSpa home">
            <Logo />
            <span className="ml-2 hidden rounded-full border border-[#23252A] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8A8F98] sm:inline-block">
              Setup Assistant
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void resetAndRestart()}
              className="hidden text-xs text-[#8A8F98] transition hover:text-[#F7F8F8] sm:inline-flex sm:items-center sm:gap-1"
            >
              <Trash2 className="size-3" /> Start over
            </button>
            <Link
              href="/dashboard"
              className="text-sm text-[#8A8F98] transition hover:text-[#F7F8F8]"
            >
              Skip to dashboard
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-8 lg:py-10">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-[#23252A] bg-[#121316]/85 p-4">
            <div className="flex items-center gap-2">
              <Bot className="size-4 text-[#5E6AD2]" />
              <p className="text-sm font-semibold">Sections</p>
              <span className="ml-auto text-[10px] font-mono text-[#8A8F98]">
                {completedSections.length}/{SECTION_ORDER.length}
              </span>
            </div>
            <ol className="mt-3 space-y-1">
              {SECTION_ORDER.map((s, idx) => {
                const done = isSectionDone(draft, s)
                const active = s === section
                return (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => setSection(s)}
                      className={cn(
                        "group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition",
                        active
                          ? "bg-[#1A1B1E] text-[#F7F8F8]"
                          : "text-[#8A8F98] hover:bg-[#1A1B1E] hover:text-[#F7F8F8]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-md border",
                          done
                            ? "border-[#4CB782]/40 bg-[#4CB782]/15 text-[#4CB782]"
                            : active
                              ? "border-[#E2E54B]/40 bg-[#E2E54B]/15 text-[#E2E54B]"
                              : "border-[#23252A] bg-[#0B0C0E] text-[#62666D]",
                        )}
                      >
                        {done ? (
                          <Check className="size-3" />
                        ) : (
                          <span className="text-[10px] font-mono">{idx + 1}</span>
                        )}
                      </span>
                      <span className="flex-1 truncate">{SECTION_LABEL[s]}</span>
                      {active ? (
                        <span className="rounded-full bg-[#E2E54B] px-1.5 py-0.5 text-[9px] font-semibold text-[#08090A]">
                          NOW
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>

          <div className="mt-4 rounded-2xl border border-[#34D399]/30 bg-[#34D399]/10 p-4 text-xs leading-5 text-[#BFEFDB]">
            <div className="flex items-center gap-2 font-semibold text-[#34D399]">
              <CheckCircle2 className="size-4" />
              Hi {firstName} — let&apos;s build your knowledge base.
            </div>
            <p className="mt-1 text-[#8A8F98]">
              {SECTION_INTRO.business} About 5 minutes.
            </p>
          </div>

          {concerns.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-[#EB5757]/40 bg-[#EB5757]/10 p-4 text-xs">
              <div className="flex items-center gap-2 font-semibold text-[#EB5757]">
                <AlertTriangle className="size-4" />
                Compliance concerns
              </div>
              <ul className="mt-2 space-y-1.5 text-[#F7C0C0]">
                {concerns.map((c, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-[#EB5757]">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-[#8A8F98]">
                We saved your replies anyway — please edit these in the Knowledge Base before going live.
              </p>
            </div>
          ) : null}
        </aside>

        <div className="flex min-h-[640px] flex-col rounded-[2rem] border border-[#23252A] bg-[#0B0C0E]/90 shadow-2xl shadow-black/30">
          <div className="flex items-start justify-between gap-4 border-b border-[#23252A] p-5">
            <div>
              <p className="text-sm font-semibold text-[#E2E54B]">
                {SECTION_LABEL[section]}
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight">{sectionIntro}</h2>
              <p className="mt-1 text-sm leading-6 text-[#8A8F98]">{sectionTip}</p>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#23252A] bg-[#121316] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8A8F98]">
                <CircleDashed className="size-3" />
                Section {SECTION_ORDER.indexOf(section) + 1} of {SECTION_ORDER.length}
              </span>
              {currentSectionDone ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#4CB782]/15 px-2 py-0.5 text-[10px] font-semibold text-[#4CB782]">
                  <Check className="size-3" /> Captured
                </span>
              ) : null}
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto p-5"
            style={{ minHeight: 360 }}
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-[#8A8F98]">
                <Sparkles className="size-5 text-[#E2E54B]" />
                <p>Hi {firstName}! I&apos;m AivaSpa&apos;s Setup Assistant.</p>
                <p className="max-w-md text-xs leading-5">
                  I&apos;ll ask you 9 short sections — business basics, hours, services, booking, FAQs, disclaimers, brand voice, and notifications — then we publish your knowledge base together. No firm prices, ever.
                </p>
                <Button
                  size="sm"
                  className="mt-2 bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
                  onClick={() => void send("Let&apos;s start.")}
                >
                  Start the interview
                </Button>
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-6",
                        m.role === "user"
                          ? "rounded-br-sm bg-[#E2E54B] text-[#08090A]"
                          : "rounded-bl-sm border border-[#23252A] bg-[#121316] text-[#F7F8F8]",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          m.role === "user" ? "text-[#08090A]/60" : "text-[#62666D]",
                        )}
                      >
                        {m.role === "user" ? "You" : "Setup Assistant"} · {m.at}
                      </p>
                    </div>
                  </div>
                ))}
                {sending ? (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm border border-[#23252A] bg-[#121316] px-3 py-2 text-xs text-[#8A8F98]">
                      <Loader2 className="size-3 animate-spin" />
                      AivaSpa is thinking…
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>

          {onReview ? (
            <div className="border-t border-[#23252A] bg-[#0B0C0E] p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#F7F8F8]">
                <FileText className="size-4 text-[#E2E54B]" />
                Final review
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SECTION_ORDER.filter((s) => s !== "review").map((s) => (
                  <div
                    key={s}
                    className="rounded-xl border border-[#23252A] bg-[#121316] p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">
                        {SECTION_LABEL[s]}
                      </p>
                      {isSectionDone(draft, s) ? (
                        <Check className="size-3.5 text-[#4CB782]" />
                      ) : (
                        <Clock className="size-3.5 text-[#62666D]" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[#F7F8F8]">
                      {SECTION_SUMMARY[s](draft)}
                    </p>
                  </div>
                ))}
              </div>
              {finalizeError ? (
                <div className="mt-3 rounded-xl border border-[#EB5757]/40 bg-[#EB5757]/10 px-3 py-2 text-xs text-[#EB5757]">
                  {finalizeError}
                </div>
              ) : null}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[#8A8F98]">
                  {draft.status?.pendingFields?.length
                    ? `${draft.status.pendingFields.length} field(s) still pending — you can publish anyway and edit later.`
                    : "All required fields captured. Ready to publish."}
                </p>
                <Button
                  onClick={() => void publish()}
                  disabled={finalizing}
                  className="h-11 rounded-xl bg-[#E2E54B] px-6 text-sm font-semibold text-[#08090A] hover:bg-[#E2E54B]/90"
                >
                  {finalizing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Publishing…
                    </>
                  ) : (
                    <>
                      Publish knowledge base
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="border-t border-[#23252A] bg-[#0B0C0E] p-4">
            {error ? (
              <div className="mb-2 rounded-xl border border-[#EB5757]/40 bg-[#EB5757]/10 px-3 py-2 text-xs text-[#EB5757]">
                {error}
              </div>
            ) : null}

            {suggestions.length > 0 && messages.length <= 1 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {suggestions.slice(0, 2).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="max-w-full rounded-full border border-[#23252A] bg-[#121316] px-3 py-1 text-left text-[11px] text-[#8A8F98] transition hover:border-[#E2E54B]/50 hover:text-[#F7F8F8]"
                  >
                    {s.length > 80 ? s.slice(0, 80) + "…" : s}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={
                  onReview
                    ? "Any last edits before publishing?"
                    : `Tell me about your ${SECTION_LABEL[section].toLowerCase()}…`
                }
                rows={2}
                disabled={onReview}
                className={cn(
                  "min-h-12 max-h-32 flex-1 resize-none rounded-xl border border-[#23252A] bg-[#121316] px-3 py-2.5 text-sm text-[#F7F8F8] placeholder:text-[#62666D] focus:border-[#E2E54B] focus:outline-none focus:ring-2 focus:ring-[#E2E54B]/20 disabled:opacity-50",
                )}
                maxLength={2000}
              />
              <Button
                type="button"
                onClick={() => void send()}
                disabled={sending || input.trim().length === 0 || onReview}
                className="size-11 shrink-0 rounded-xl bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
                aria-label="Send"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-[10px] text-[#62666D]">
              Tip: answer naturally — I&apos;ll capture the details. Type <span className="font-semibold">skip</span> to leave something for later.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

export { SETUP_ASSISTANT_SECTIONS, type KnowledgeBase }
