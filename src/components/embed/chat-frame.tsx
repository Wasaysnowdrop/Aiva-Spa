"use client"

import * as React from "react"
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { TimeSlotPicker } from "@/components/embed/time-slot-picker-lazy"
import type { WidgetConfig } from "@/lib/supabase/types"
import {
  isRtlLanguage,
  isSupportedLanguage,
  makeTranslator,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
  type TranslationDictionary,
  type Translator,
} from "@/lib/i18n"
import { cn } from "@/lib/utils"

type UiMessage = {
  id: string
  role: "visitor" | "ai" | "staff"
  content: string
  timestamp: string
}

type Config = WidgetConfig

const STORAGE_KEY = (spaId: string) => `aiva:session:${spaId}`
const STORAGE_CONSENT = (spaId: string) => `aiva:consent:${spaId}`
const STORAGE_SESSION_ID = (spaId: string) => `aiva:sid:${spaId}`
const STORAGE_LANGUAGE = (spaId: string) => `aiva:lang:${spaId}`

function resolveInitialLanguage(input?: string | null): LanguageCode {
  if (isSupportedLanguage(input)) return input
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("aiva:lang:default")
      if (isSupportedLanguage(stored)) return stored
      const browser = window.navigator?.language || ""
      const base = browser.split("-")[0]?.toLowerCase()
      if (isSupportedLanguage(base)) return base
    } catch {
      // ignore
    }
  }
  return "en"
}

function readStoredLanguage(spaId: string): LanguageCode | null {
  if (typeof window === "undefined") return null
  try {
    const stored = window.localStorage.getItem(STORAGE_LANGUAGE(spaId))
    if (isSupportedLanguage(stored)) return stored
    return null
  } catch {
    return null
  }
}

const fallbackTranslator: Translator = (key) => {
  // The widget config endpoint will fill this in via the `config`
  // postMessage from the parent loader. Until that arrives, fall back
  // to the canonical English strings baked into the JS bundle.
  const fb: TranslationDictionary = {
    "header.online": "Online · 24/7",
    "header.offline": "We'll reply soon",
    consent:
      "By chatting, you agree to our privacy policy. We'll only contact you about your inquiry.",
    powered_by: "Powered by",
    book_cta: "Book a consult",
    "book_form_title": "Book a quick consult",
    "book_form_subtitle":
      "Share a few details and the team will confirm within 1 business hour.",
    "field.name": "Full name",
    "field.email": "Email",
    "field.phone": "Phone",
    "field.service": "Service (e.g. Botox)",
    "field.preferred_time": "Preferred time",
    "field.preferred_time_placeholder": "Or type a time (e.g. 'Tue afternoon')",
    "field.notes": "Goals or notes",
    "field.notes_placeholder": "Anything you'd like the provider to know?",
    "submit.send": "Send to {brand}",
    "submit.sending": "Sending…",
    "submit.open_calendar": "Pick a time",
    "error.consent_required": "Please confirm consent before submitting.",
    "error.required_fields":
      "Please fill in your name, phone, email, service, preferred time, and notes.",
    "error.pick_time": "Pick a time slot or type a preferred time.",
    "error.save_failed": "Could not save. Please try again.",
    "placeholder.input": "Type a question…",
    typing: "{brand} is typing…",
    "thanks_after_booking":
      "Thanks {first}! Your consultation request has been submitted. The {brand} team will reach out to confirm your {service} appointment.",
    "thanks_after_lead":
      "Thanks {first}! I've passed your details to the {brand} team. They'll reach out within 1 business hour to confirm your {service} consultation.",
    "lead_received_banner":
      "Your details have been sent to the team. A team member will contact you to confirm availability.",
    "language.aria": "Chat language",
  }
  const template = fb[key] ?? key
  return template.replace(/\{(\w+)\}/g, () => "")
}

function makeId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function getOrCreateSessionId(spaId: string): string {
  if (typeof window === "undefined") return `sess_${Date.now()}`
  try {
    let sid = window.localStorage.getItem(STORAGE_SESSION_ID(spaId))
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      window.localStorage.setItem(STORAGE_SESSION_ID(spaId), sid)
    }
    return sid
  } catch {
    return `sess_${Date.now()}`
  }
}

function formatTime(timestamp: string) {
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  })
}

// Heuristic: show the "Book a consult" CTA only when the AI's reply
// explicitly invites the visitor to take the next step. We never auto-show
// the lead form; the visitor always clicks the button themselves.
const BOOKING_CTA_HINTS = [
  /\bbook(ing)?\b/i,
  /\bschedule\b/i,
  /\bconsult(ation)?\b/i,
  /\bappointment\b/i,
  /\bset (one|up|an appointment)\b/i,
  /\bgrab (your |a few )?details\b/i,
  /\bname,?\s*phone,?/i,
  /\bwant (to|me to) (book|set|schedule|connect)/i,
  /\bshare (your |a few )?(details|name|phone)\b/i,
  /\b(connect|reach) (you|with the team|with a provider)\b/i,
  /\bcome in\b/i,
]

const PURE_NO_CTA = new Set([
  "hi",
  "hello",
  "hey",
  "yo",
  "hola",
  "howdy",
  "thanks",
  "thank you",
  "thx",
  "ty",
])

function shouldShowBookingCta(aiText: string): boolean {
  const text = (aiText ?? "").trim()
  if (!text) return false
  // Suppress CTA on short pure-greeting / thanks replies
  const lower = text.toLowerCase().replace(/[!.?,;:\s]+$/g, "")
  if (PURE_NO_CTA.has(lower)) return false
  if (text.length < 40) return false
  return BOOKING_CTA_HINTS.some((re) => re.test(text))
}

function postToParent(payload: Record<string, unknown>) {
  if (typeof window === "undefined") return
  try {
    window.parent.postMessage({ source: "aivaspa-iframe", ...payload }, "*")
  } catch {}
}

function readStoredConsent(spaId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(STORAGE_CONSENT(spaId)) === "1"
  } catch {
    return false
  }
}

function readStoredMessages(spaId: string): {
  messages: UiMessage[]
  chatId: string | null
} {
  if (typeof window === "undefined") return { messages: [], chatId: null }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY(spaId))
    if (!stored) return { messages: [], chatId: null }
    const parsed = JSON.parse(stored) as {
      messages?: UiMessage[]
      chatId?: string
    }
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      chatId: typeof parsed.chatId === "string" ? parsed.chatId : null,
    }
  } catch {
    return { messages: [], chatId: null }
  }
}

export function ChatFrame({
  spaId,
  initialConfig,
  parentUrl,
  initialLanguage,
}: {
  spaId: string
  initialConfig: Config
  parentUrl?: string
  initialLanguage?: string
}) {
  const [config, setConfig] = React.useState<Config>(initialConfig)
  const [hydrated, setHydrated] = React.useState(false)
  const [input, setInput] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [leadFormOpen, setLeadFormOpen] = React.useState(false)
  const [lead, setLead] = React.useState({
    name: "",
    email: "",
    phone: "",
    service: "",
    preferredTime: "",
    notes: "",
  })
  const [leadSubmitted, setLeadSubmitted] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [, startLanguageTransition] = React.useTransition()
  const [language, setLanguageState] = React.useState<LanguageCode>(
    () => resolveInitialLanguage(initialLanguage),
  )
  // Wrap setLanguage in a transition so the UI doesn't block on
  // remounting the translator + persisted localStorage write when a
  // visitor switches language — keeps the dropdown snappy.
  const setLanguage = React.useCallback((next: LanguageCode | ((prev: LanguageCode) => LanguageCode)) => {
    startLanguageTransition(() => {
      setLanguageState(next)
    })
  }, [])
  const [translations, setTranslations] = React.useState<TranslationDictionary | null>(
    () => null,
  )
  const t: Translator = React.useMemo(
    () => (translations ? makeTranslator(language) : fallbackTranslator),
    [translations, language],
  )
  const isRtl = isRtlLanguage(language)
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null)
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const hydratedRef = React.useRef(false)

  const [messages, setMessages] = React.useState<UiMessage[]>(() => [
    {
      id: "welcome",
      role: "ai",
      content:
        initialConfig.welcomeMessage ||
        "Hi! Are you looking to book a consultation or ask about a treatment?",
      timestamp: new Date(0).toISOString(),
    },
  ])
  const [chatId, setChatId] = React.useState<string | null>(null)
  const [consent, setConsent] = React.useState<boolean>(false)
  const [sessionId] = React.useState<string>(() =>
    getOrCreateSessionId(spaId),
  )

  // Read persisted chat state from localStorage on mount. This must run in an
  // effect (not in render) so that SSR and the first client render produce
  // identical HTML and avoid a hydration mismatch; the second render then
  // applies the persisted state. The ref guard prevents the effect from
  // running a second time under React StrictMode. The
  // react-hooks/set-state-in-effect rule is overly aggressive for this
  // well-known "load persisted state on mount" pattern.
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    const restored = readStoredMessages(spaId)
    if (restored.messages.length > 0) setMessages(restored.messages)
    if (restored.chatId) setChatId(restored.chatId)
    if (readStoredConsent(spaId)) setConsent(true)
    const storedLang = readStoredLanguage(spaId)
    if (storedLang) setLanguage(storedLang)
    setHydrated(true)
    // We intentionally only re-run on spaId changes; the setters are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaId])
  /* eslint-enable react-hooks/set-state-in-effect */

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(STORAGE_LANGUAGE(spaId), language)
    } catch {
      // ignore quota / private mode errors
    }
  }, [spaId, language])

  // Measure the chat's actual content height and tell the parent so the
  // iframe resizes to match. Without this the iframe stays at its CSS
  // height (560px) which leaves empty space at the bottom when the
  // content is shorter, and overflows when it is taller.
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let raf = 0
    const measure = () => {
      const h = el.scrollHeight
      if (h > 0) {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(() => {
          postToParent({ type: "resize", height: Math.ceil(h) })
        })
      }
    }
    measure()
    const t = window.setTimeout(measure, 120)
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t)
      ro.disconnect()
    }
  }, [])

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (messages.length === 0) return
    window.localStorage.setItem(
      STORAGE_KEY(spaId),
      JSON.stringify({ messages, chatId: sessionId }),
    )
  }, [messages, sessionId, spaId])


  React.useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data as {
        source?: string
        type?: string
        config?: Config & {
          defaultLanguage?: string
          supportedLanguages?: string[]
          translations?: Record<string, TranslationDictionary>
        }
        message?: string
      }
      if (!data || data.source !== "aivaspa-parent") return
      if (data.type === "config" && data.config) {
        const next: Config = { ...config, ...data.config }
        setConfig(next)
        if (data.config.translations) {
          setTranslations((prev) => prev ?? data.config!.translations as unknown as TranslationDictionary)
        }
        // The owner's defaultLanguage is just a hint; we never clobber
        // a visitor who has already picked something via the
        // switcher. The first-render `resolveInitialLanguage` is
        // where the owner's default actually takes effect.
      } else if (data.type === "open") {
        // no-op; parent controls visibility
      } else if (data.type === "close") {
        // Parent is hiding the iframe. No state change needed here — the
        // close button inside the chat already initiated the close. We
        // intentionally do NOT echo back, to avoid a postMessage loop
        // that previously prevented the widget from reopening.
      } else if (data.type === "proactive" && data.message) {
        setMessages((prev) => {
          if (prev.length === 0) {
            return [
              {
                id: makeId(),
                role: "ai",
                content: data.message as string,
                timestamp: new Date().toISOString(),
              },
            ]
          }
          return prev
        })
      }
    }
    window.addEventListener("message", onMessage)
    postToParent({ type: "ready" })
    return () => window.removeEventListener("message", onMessage)
  }, [config])

  const lastAiMessage = React.useMemo(
    () => [...messages].reverse().find((m) => m.role === "ai"),
    [messages],
  )
  const showCtaForLastAi = shouldShowBookingCta(lastAiMessage?.content ?? "")
  const showLeadForm = leadFormOpen && !leadSubmitted

  async function sendMessage(text?: string) {
    const trimmed = (text ?? input).trim()
    if (!trimmed) return
    setInput("")
    setError(null)
    console.log("[chat-widget] sending message", { length: trimmed.length })

    const userMsg: UiMessage = {
      id: makeId(),
      role: "visitor",
      content: trimmed,
      timestamp: new Date().toISOString(),
    }
    const aiMsgId = makeId()
    const aiMsg: UiMessage = {
      id: aiMsgId,
      role: "ai",
      content: "",
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg, aiMsg])
    setSending(true)

    const history = messages.map((m) => ({
      role: m.role === "visitor" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }))

    // Track the final text the visitor should see. We populate this from
    // streaming chunks, the buffered JSON reply, or (last resort) the
    // safe fallback. The fallback only fires when no real response came
    // back from the server.
    let finalText = ""
    let hadNetworkError = false

    try {
      // Try streaming first (much faster TTFT). Fall back to buffered JSON if
      // the browser/network refuses streaming for any reason.
      const streamed = await streamChatReply(aiMsgId, trimmed, history, (text) => {
        finalText = text
      })
      if (!streamed) {
        const buffered = await bufferedChatReply(aiMsgId, trimmed, history)
        finalText = buffered
      }
    } catch (e) {
      console.error("[chat-widget] chat request failed", e)
      hadNetworkError = true
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      // Only fall back if the server actually returned nothing. If the
      // AI gave us a real answer — even a short or imperfect one — we
      // trust it and render it. The fallback is reserved for genuine
      // outages, not for every message.
      if (!finalText.trim()) {
        finalText = hadNetworkError
          ? "I'm having trouble connecting right now. Please try again in a moment."
          : "I'm having trouble generating a response right now. Please try again in a moment."
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: finalText } : m,
          ),
        )
        console.warn("[chat-widget] response was blank, applied fallback", {
          hadNetworkError,
        })
      }
      setSending(false)
      inputRef.current?.focus()
      console.log("[chat-widget] Rendering response", {
        finalTextLength: finalText.length,
      })
    }
  }

  async function streamChatReply(
    aiMsgId: string,
    trimmed: string,
    history: { role: "user" | "assistant"; content: string }[],
    onFinalText: (text: string) => void,
  ): Promise<boolean> {
    if (typeof fetch === "undefined" || !("ReadableStream" in window)) {
      return false
    }
    let res: Response
    try {
      res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
        },
        body: JSON.stringify({
          spaId,
          sessionId,
          message: trimmed,
          history,
          consentGiven: consent,
          sourceUrl:
            parentUrl ||
            (typeof window !== "undefined" ? window.location.href : undefined),
          language,
          lead: {
            name: lead.name || undefined,
            email: lead.email || undefined,
            phone: lead.phone || undefined,
            service: lead.service || undefined,
            preferredTime: lead.preferredTime || undefined,
            notes: lead.notes || undefined,
          },
        }),
      })
    } catch (err) {
      console.warn("[chat-widget] stream fetch failed, falling back to buffered", err)
      return false
    }
    if (!res.ok || !res.body) {
      // Fall back to buffered JSON for any error response so the visitor
      // still gets a useful reply.
      console.warn("[chat-widget] stream returned non-OK, falling back to buffered", res.status)
      return false
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ""
    let currentEvent = "message"
    let fullText = ""
    let errored = false

    const appendChunk = (text: string) => {
      if (!text) return
      fullText += text
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, content: fullText } : m)),
      )
    }

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buf.indexOf("\n")) >= 0) {
          const rawLine = buf.slice(0, nl)
          buf = buf.slice(nl + 1)
          // SSE separates events by a blank line; a line starting with ":"
          // is a comment (heartbeat). Strip the trailing CR if present.
          const line = rawLine.replace(/\r$/, "")
          if (line === "") {
            currentEvent = "message"
            continue
          }
          if (line.startsWith(":")) continue
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim()
            continue
          }
          if (!line.startsWith("data:")) continue
          const dataStr = line.slice(5).trim()
          if (!dataStr) continue
          let payload: {
            text?: string
            message?: string
            reply?: string
          } = {}
          try {
            payload = JSON.parse(dataStr) as typeof payload
          } catch {
            continue
          }
          if (currentEvent === "chunk" && typeof payload.text === "string") {
            appendChunk(payload.text)
          } else if (currentEvent === "error") {
            errored = true
            appendChunk(
              payload.message ||
                "I'm having a quick moment — could you rephrase that?",
            )
          } else if (currentEvent === "done" && typeof payload.reply === "string") {
            // Server confirmed the final reply in case streaming missed
            // any chunks (think-stripping, partial SSE). Sync our state
            // with the authoritative server reply so the bubble is never
            // blank if the SSE chunk stream had gaps.
            if (!fullText.trim() && payload.reply.trim()) {
              fullText = payload.reply
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId ? { ...m, content: fullText } : m,
                ),
              )
            }
          }
        }
      }
    } catch (err) {
      console.warn("[chat-widget] stream read error", err)
      // Network blip mid-stream: keep what we already got, surface an error
      // banner if we got nothing useful.
      if (!fullText.trim()) {
        const fallback =
          "I'm having a quick moment — could you try again, or ask me about a treatment, hours, or booking?"
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: fallback } : m,
          ),
        )
        fullText = fallback
        setError("Connection dropped. Please try again.")
      }
      onFinalText(fullText)
      return true
    }

    // Final blank guard: if the server returned no usable chunks AND no
    // "done" reply, force a fallback so the bubble is never blank.
    if (!fullText.trim()) {
      console.warn("[chat-widget] stream ended with no text, applying fallback")
      const fallback =
        "I'm having a quick moment — could you try again, or ask me about a treatment, hours, or booking?"
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, content: fallback } : m,
        ),
      )
      fullText = fallback
    }

    if (errored && !fullText.trim()) {
      setError("Something went wrong. Please try again.")
    }
    onFinalText(fullText)
    return true
  }

  async function bufferedChatReply(
    aiMsgId: string,
    trimmed: string,
    history: { role: "user" | "assistant"; content: string }[],
  ): Promise<string> {
    const FALLBACK =
      "I'm having a quick moment — could you try again, or ask me about a treatment, hours, or booking?"
    let res: Response
    try {
      res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spaId,
          sessionId,
          message: trimmed,
          history,
          consentGiven: consent,
          sourceUrl:
            parentUrl ||
            (typeof window !== "undefined" ? window.location.href : undefined),
          language,
          lead: {
            name: lead.name || undefined,
            email: lead.email || undefined,
            phone: lead.phone || undefined,
            service: lead.service || undefined,
            preferredTime: lead.preferredTime || undefined,
            notes: lead.notes || undefined,
          },
        }),
      })
    } catch (err) {
      console.warn("[chat-widget] buffered fetch failed", err)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, content: FALLBACK } : m,
        ),
      )
      return FALLBACK
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        reason?: string
        reply?: string
      }
      const reply = (data?.reply ?? "").trim() || FALLBACK
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, content: reply } : m,
        ),
      )
      return reply
    }
    const data = (await res.json()) as {
      reply: string
      leadSaved?: boolean
      leadId?: string
      error?: string
    }
    const reply = (data.reply ?? "").trim() || FALLBACK
    if (data.leadId && !chatId) setChatId(data.leadId)
    if (data.leadSaved) setLeadSubmitted(true)
    setMessages((prev) =>
      prev.map((m) =>
        m.id === aiMsgId ? { ...m, content: reply } : m,
      ),
    )
    return reply
  }

  async function submitLead(e: React.FormEvent) {
    e.preventDefault()
    if (!consent) {
      setError(t("error.consent_required"))
      return
    }
    if (
      !lead.name ||
      !lead.phone ||
      !lead.email ||
      !lead.service ||
      !lead.notes
    ) {
      setError(t("error.required_fields"))
      return
    }
    if (!lead.preferredTime) {
      setError(t("error.pick_time"))
      return
    }
    setSending(true)
    setError(null)
    try {
      const history = messages.map((m) => ({
        role: m.role === "visitor" ? ("visitor" as const) : ("ai" as const),
        content: m.content,
      }))
      const sourceUrl = parentUrl || (typeof window !== "undefined" ? window.location.href : undefined)
      // The chat widget only ever submits a consultation request — never
      // claims a real booking. We route both paths (typed time + picked
      // slot) through /api/leads so the message is consistent. The team
      // reviews and confirms availability out-of-band.
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spaId,
          sessionId,
          language,
          ...lead,
          sourceUrl,
          transcript: history,
          consentGiven: consent,
          afterHours: undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = (data as { error?: string }).error || "Could not save"
        throw new Error(msg)
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_CONSENT(spaId), "1")
      }
      setLeadSubmitted(true)
      const firstName = lead.name.split(" ")[0]
      const aiMsg: UiMessage = {
        id: makeId(),
        role: "ai",
        content: t("thanks_after_lead", { first: firstName, brand: config.brandName, service: lead.service }),
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit")
    } finally {
      setSending(false)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex h-dvh w-full flex-col overflow-hidden"
      role="region"
      aria-label={`${config.brandName} chat`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <header
        className="flex items-center gap-2.5 border-b border-[#23252A] bg-[#121316] px-4 py-3"
        style={{ borderTopColor: config.primaryColor }}
      >
        <span
          className="flex size-9 items-center justify-center rounded-xl text-sm font-bold text-[#08090A]"
          style={{ backgroundColor: config.primaryColor }}
          aria-hidden
        >
          {config.logoInitial || config.brandName[0] || "A"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#F7F8F8]">
            {config.brandName}
          </p>
          <p className="flex items-center gap-1 text-[11px] text-[#4CB782]">
            <span className="size-1.5 rounded-full bg-[#4CB782]" /> {t("header.online")}
          </p>
        </div>
        <LanguageSwitcher
          current={language}
          onChange={setLanguage}
          t={t}
        />
        <button
          type="button"
          aria-label="Close chat"
          className="ml-auto flex size-8 items-center justify-center rounded-lg text-[#8A8F98] transition hover:bg-[#1A1B1E] hover:text-[#F7F8F8]"
          onClick={() => {
            postToParent({ type: "close" })
          }}
        >
          <X className="size-4" />
        </button>
      </header>

      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#0B0C0E] p-4"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} brandName={config.brandName} showTime={hydrated} />
        ))}

        {!sending && showCtaForLastAi && !showLeadForm && !leadSubmitted ? (
          <div className="flex justify-start pl-9">
            <button
              type="button"
              onClick={() => setLeadFormOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/15 px-3 py-1.5 text-xs font-semibold text-[#E2E54B] transition hover:bg-[#E2E54B]/25"
            >
              <MessageCircle className="size-3" />
              {t("book_cta")}
            </button>
          </div>
        ) : null}

        {sending ? (
          <div className="flex items-center gap-2 text-xs text-[#8A8F98]">
            <span className="flex size-6 items-center justify-center rounded-full bg-[#5E6AD2]/15 text-[#5E6AD2]">
              <Loader2 className="size-3 animate-spin" />
            </span>
            {t("typing", { brand: config.brandName })}
          </div>
        ) : null}

        {showLeadForm ? (
          <LeadForm
            spaId={spaId}
            config={config}
            lead={lead}
            setLead={setLead}
            consent={consent}
            setConsent={(v) => {
              setConsent(v)
              if (typeof window !== "undefined") {
                window.localStorage.setItem(STORAGE_CONSENT(spaId), v ? "1" : "0")
              }
            }}
            onSubmit={submitLead}
            onDismiss={() => setLeadFormOpen(false)}
            error={error}
            sending={sending}
            t={t}
          />
        ) : null}

        {leadSubmitted ? (
          <div className="flex items-start gap-2 rounded-lg border border-[#4CB782]/30 bg-[#4CB782]/10 p-2.5 text-[11px] text-[#C9CCD2]">
            <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-[#4CB782]" />
            <p>{t("lead_received_banner")}</p>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-[#23252A] bg-[#121316] p-3"
        onSubmit={(e) => {
          e.preventDefault()
          void sendMessage()
        }}
      >
        <Label htmlFor="aiva-input" className="sr-only">
          Type a message
        </Label>
        <Textarea
          id="aiva-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={t("placeholder.input")}
          aria-label={t("placeholder.input")}
          className="max-h-32 min-h-10 flex-1 resize-none border-[#23252A] bg-[#0B0C0E] text-sm"
          rows={1}
          maxLength={2000}
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || input.trim().length === 0}
          className="size-10 shrink-0"
          style={{ backgroundColor: config.primaryColor, color: "#08090A" }}
          aria-label="Send message"
        >
          <Send className="size-4" />
        </Button>
      </form>

      {config.showBranding ? (
        <p className="border-t border-[#23252A] bg-[#08090A] py-1.5 text-center text-[10px] text-[#62666D]">
          {t("powered_by")}{" "}
          <a
            href="https://aivaspa.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[#8A8F98]"
          >
            AivaSpa
          </a>
        </p>
      ) : null}
    </div>
  )
}

const LanguageSwitcher = React.memo(function LanguageSwitcher({
  current,
  onChange,
  t,
}: {
  current: LanguageCode
  onChange: (lang: LanguageCode) => void
  t: Translator
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={t("language.aria")}
        onClick={() => setOpen((v) => !v)}
        className="flex size-8 items-center justify-center rounded-lg text-[10px] font-semibold uppercase text-[#8A8F98] transition hover:bg-[#1A1B1E] hover:text-[#F7F8F8]"
      >
        {current}
      </button>
      {open ? (
        <div className="absolute end-0 top-9 z-10 max-h-72 w-32 overflow-y-auto rounded-lg border border-[#23252A] bg-[#121316] py-1 shadow-xl">
          {SUPPORTED_LANGUAGES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                onChange(code)
                setOpen(false)
              }}
              className={cn(
                "flex w-full items-center justify-between px-3 py-1.5 text-xs",
                code === current
                  ? "bg-[#1A1B1E] text-[#F7F8F8]"
                  : "text-[#8A8F98] hover:bg-[#1A1B1E] hover:text-[#F7F8F8]",
              )}
            >
              <span className="uppercase">{code}</span>
              {code === current ? <CheckCircle2 className="size-3" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
})

const MessageBubble = React.memo(function MessageBubble({
  message,
  brandName,
  showTime,
}: {
  message: UiMessage
  brandName: string
  showTime: boolean
}) {
  const isAi = message.role === "ai"
  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isAi ? "justify-start" : "justify-end",
      )}
    >
      {isAi ? (
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#5E6AD2]/15 text-[#5E6AD2]"
          aria-hidden
        >
          <Sparkles className="size-3.5" />
        </span>
      ) : null}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-5 shadow-sm",
          isAi
            ? "rounded-bl-sm border border-[#23252A] bg-[#121316] text-[#F7F8F8]"
            : "rounded-br-sm bg-[#E2E54B] text-[#08090A]",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={cn(
            "mt-1 text-right text-[10px]",
            isAi ? "text-[#62666D]" : "text-[#08090A]/60",
          )}
          suppressHydrationWarning
        >
          {isAi ? brandName : "You"}
          {showTime && message.timestamp
            ? ` · ${formatTime(message.timestamp)}`
            : null}
        </p>
      </div>
    </div>
  )
})

const LeadForm = React.memo(function LeadForm({
  spaId,
  config,
  lead,
  setLead,
  consent,
  setConsent,
  onSubmit,
  onDismiss,
  error,
  sending,
  t,
}: {
  spaId: string
  config: Config
  lead: { name: string; email: string; phone: string; service: string; preferredTime: string; notes: string }
  setLead: (l: { name: string; email: string; phone: string; service: string; preferredTime: string; notes: string }) => void
  consent: boolean
  setConsent: (v: boolean) => void
  onSubmit: (e: React.FormEvent) => void
  onDismiss: () => void
  error: string | null
  sending: boolean
  t: Translator
}) {
  const isIso = /^\d{4}-\d{2}-\d{2}T/.test(lead.preferredTime)
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-2.5 rounded-2xl border border-[#23252A] bg-[#121316] p-3.5"
    >
      <div className="flex items-center justify-between gap-2 text-xs text-[#F7F8F8]">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-3.5 text-[#E2E54B]" />
          <p className="font-semibold">{t("book_form_title")}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss booking form"
          className="flex size-6 items-center justify-center rounded-md text-[#8A8F98] transition hover:bg-[#1A1B1E] hover:text-[#F7F8F8]"
        >
          <X className="size-3" />
        </button>
      </div>
      <p className="-mt-1 text-[10px] text-[#8A8F98]">{t("book_form_subtitle")}</p>
      <div className="grid grid-cols-2 gap-2">
        <Input
          aria-label={t("field.name")}
          placeholder={t("field.name")}
          value={lead.name}
          onChange={(e) => setLead({ ...lead, name: e.target.value })}
          className="h-9 text-xs"
          required
        />
        {config.collectPhone ? (
          <Input
            aria-label={t("field.phone")}
            placeholder={t("field.phone")}
            value={lead.phone}
            onChange={(e) => setLead({ ...lead, phone: e.target.value })}
            className="h-9 text-xs"
            type="tel"
            required
          />
        ) : (
          <Input
            aria-label={t("field.phone")}
            placeholder={t("field.phone")}
            value={lead.phone}
            onChange={(e) => setLead({ ...lead, phone: e.target.value })}
            className="h-9 text-xs"
            type="tel"
            required
          />
        )}
        <Input
          aria-label={t("field.email")}
          placeholder={t("field.email")}
          value={lead.email}
          onChange={(e) => setLead({ ...lead, email: e.target.value })}
          className="h-9 text-xs"
          type="email"
          required
        />
        <Input
          aria-label={t("field.service")}
          placeholder={t("field.service")}
          value={lead.service}
          onChange={(e) => setLead({ ...lead, service: e.target.value })}
          className="h-9 text-xs"
          required
        />
        <div className="col-span-2 space-y-1.5">
          <Input
            aria-label={t("field.preferred_time")}
            placeholder={t("field.preferred_time_placeholder")}
            value={isIso ? "" : lead.preferredTime}
            onChange={(e) => setLead({ ...lead, preferredTime: e.target.value })}
            className="h-9 text-xs"
            required={!lead.preferredTime}
          />
          <TimeSlotPicker
            spaId={spaId}
            value={isIso ? lead.preferredTime : ""}
            onChange={(iso, label) => setLead({ ...lead, preferredTime: iso || label })}
          />
        </div>
        <Textarea
          aria-label={t("field.notes")}
          placeholder={t("field.notes_placeholder")}
          value={lead.notes}
          onChange={(e) => setLead({ ...lead, notes: e.target.value })}
          className="col-span-2 min-h-14 text-xs"
          required
        />
      </div>
      <label className="flex items-start gap-2 text-[10px] leading-4 text-[#8A8F98]">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 size-3.5 accent-[#E2E54B]"
        />
        <span>{t("consent")}</span>
      </label>
      {error ? <p className="text-[10px] text-[#EB5757]">{error}</p> : null}
      <Button
        type="submit"
        size="sm"
        disabled={sending || !consent || !lead.preferredTime}
        className="w-full"
        style={{ backgroundColor: config.primaryColor, color: "#08090A" }}
      >
        {sending ? (
          <><Loader2 className="size-4 animate-spin" /> {t("submit.sending")}</>
        ) : (
          <>{t("submit.send", { brand: config.brandName })} <ArrowRight className="size-3.5" /></>
        )}
      </Button>
    </form>
  )
})
