"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react"
import { Logo } from "@/components/logo"
import { toast } from "sonner"
import { isSuccessfulPublishResult } from "@/lib/ai/publish-result"
import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { finalizeSetupAssistant, type FinalizeSetupResult } from "@/app/actions/setup-assistant"
import {
  SETUP_ASSISTANT_SECTIONS,
  emptyKnowledgeBase,
  getNextIncompleteOnboardingField,
  isOnboardingFieldComplete,
  knowledgeBaseSchema,
  syncOnboardingProgress,
  type KnowledgeBase,
  type SetupAssistantSection,
} from "@/lib/ai/setup-assistant-schema"
import { SECTION_ORDER } from "@/lib/ai/setup-assistant-prompt"
import { faqInputHash } from "@/lib/ai/faq-input"
import {
  isComplianceResultStale,
  type ComplianceRequestScope,
} from "@/lib/ai/onboarding-compliance"

type ChatRole = "user" | "assistant"

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  at: string
}

type SetupAssistantExperienceProps = {
  user: {
    id: string
    email: string
    fullName: string
    spaName: string
  }
  initialDraft: KnowledgeBase
  initialSection: SetupAssistantSection
  initialHistory: ChatMessage[]
  initialSavedAt: string | null
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
  services: "What you offer. No firm prices \u2014 ranges or 'confirmed at consultation'.",
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
    "Tue\u2013Fri 9 AM\u20137 PM, Sat 9 AM\u20135 PM, closed Sun & Mon. Timezone: America/Los_Angeles.",
    "We're open Monday to Saturday, 10am to 6pm.",
  ],
  services: [
    "Botox, dermal fillers, laser hair removal, chemical peels, and facials. Most treatments are 30\u201360 minutes.",
    "We offer microneedling and HydraFacial. Typical range for Botox is $12\u2013$15 per unit, indicative.",
  ],
  booking_policy: [
    "We follow up manually within 1 business hour. No deposit required.",
    "We use Calendly. Deposit $50, refundable with 24h notice.",
  ],
  faqs: [
    "Do you offer Botox? Yes \u2014 Botox is per unit, confirmed at consultation by a licensed provider.",
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

function sanitize(str: string): string {
  return str
    .replace(/\\u2022/g, "\u2022")
    .replace(/\\u00b7/g, "\u00b7")
    .replace(/\\u2014/g, "\u2014")
    .replace(/\\u2013/g, "\u2013")
    .replace(/\\u2026/g, "\u2026")
    .replace(/\\u2019/g, "\u2019")
    .replace(/\\u0007/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
}

function isSectionDone(kb: KnowledgeBase, section: SetupAssistantSection): boolean {
  return isOnboardingFieldComplete(kb, section)
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
  const name = pickStr(kb.business?.name) || "\u2014"
  const website = pickStr(kb.business?.website) || "\u2014"
  const addr = kb.business?.addresses?.[0]
  const address = addr ? `${addr.line1}${addr.city ? `, ${addr.city}` : ""}` : "\u2014"
  return `${name} \u00b7 ${website} \u00b7 ${address}`
}

function hoursSummary(kb: KnowledgeBase): string {
  const tz = kb.hours?.timezone || "America/Los_Angeles"
  const open = (kb.hours?.schedule ?? []).filter((s) => s.open)
  if (open.length === 0) return `Timezone ${tz} \u00b7 no hours set`
  const days = open.map((s) => `${s.day} ${s.from}\u2013${s.to}`).join(", ")
  return `${tz} \u00b7 ${days}`
}

function servicesSummary(kb: KnowledgeBase): string {
  const list = kb.services ?? []
  if (list.length === 0) return "No services yet"
  return list.map((s) => s.name).join(", ")
}

function bookingSummary(kb: KnowledgeBase): string {
  const mode = kb.booking_policy?.consultationMode ?? "manual_follow_up"
  const deposit = kb.booking_policy?.deposit?.required
    ? ` \u00b7 deposit ${kb.booking_policy.deposit.currency} ${kb.booking_policy.deposit.amount ?? "?"}`
    : ""
  const link = kb.booking_policy?.calendarLink ? ` \u00b7 ${kb.booking_policy.calendarLink}` : ""
  return `${mode}${deposit}${link}`
}

function faqsSummary(kb: KnowledgeBase): string {
  return `${kb.faqs?.length ?? 0} FAQs captured`
}

function disclaimersSummary(kb: KnowledgeBase): string {
  return kb.disclaimers?.standardAccepted ? "Standard disclaimers accepted" : "Custom disclaimers"
}

function brandSummary(kb: KnowledgeBase): string {
  return `${kb.brand_voice?.tone ?? "warm"} \u00b7 "${kb.brand_voice?.greeting?.slice(0, 40) ?? "\u2014"}"`
}

function notificationsSummary(kb: KnowledgeBase): string {
  const emails = kb.notifications?.emailRecipients?.length ?? 0
  const sms = kb.notifications?.smsRecipients?.length ?? 0
  return `${emails} email \u00b7 ${sms} SMS`
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

type SavingState = "idle" | "saving" | "saved"
type PublishStatus = "idle" | "publishing" | "published" | "failed"
type ScopedConcerns = {
  section: SetupAssistantSection
  sourceSection: SetupAssistantSection
  submissionId: string
  messageId: string
  inputHash: string
  values: string[]
}
type OnboardingCache = {
  version: 1
  draft: KnowledgeBase
  section: SetupAssistantSection
  updatedAt: string
}

function parseOnboardingCache(value: string | null): OnboardingCache | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<OnboardingCache>
    const draft = knowledgeBaseSchema.safeParse(parsed.draft)
    const validSection = SETUP_ASSISTANT_SECTIONS.includes(
      parsed.section as SetupAssistantSection,
    )
    if (parsed.version !== 1 || !draft.success || !validSection || !parsed.updatedAt) return null
    return {
      version: 1,
      draft: syncOnboardingProgress(draft.data),
      section: parsed.section as SetupAssistantSection,
      updatedAt: parsed.updatedAt,
    }
  } catch {
    return null
  }
}

export function SetupAssistantExperience({
  user,
  initialDraft,
  initialSection,
  initialHistory,
  initialSavedAt,
}: SetupAssistantExperienceProps) {
  const [draft, setDraft] = React.useState<KnowledgeBase>(initialDraft)
  const [section, setSection] = React.useState<SetupAssistantSection>(initialSection)
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialHistory)
  const router = useRouter()
  const [input, setInput] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [savingState, setSavingState] = React.useState<SavingState>("idle")
  const [error, setError] = React.useState<string | null>(null)
  const [concerns, setConcerns] = React.useState<ScopedConcerns | null>(null)
  const [publishStatus, setPublishStatus] = React.useState<PublishStatus>("idle")
  const finalizing = publishStatus === "publishing"
  const [finalizeError, setFinalizeError] = React.useState<string | null>(null)
  const [finalizeDebug, setFinalizeDebug] = React.useState<FinalizeSetupResult | null>(null)
  const [showResetConfirm, setShowResetConfirm] = React.useState(false)
  const [editingSection, setEditingSection] = React.useState<SetupAssistantSection | null>(null)
  const [cacheHydrated, setCacheHydrated] = React.useState(false)

  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null)
  const finishingLaterRef = React.useRef(false)
  const publishingRef = React.useRef(false)
  const pendingSubmissionRef = React.useRef<string | null>(null)
  const pendingRequestControllerRef = React.useRef<AbortController | null>(null)
  const activeSectionRef = React.useRef<SetupAssistantSection>(initialSection)
  const latestComplianceRef = React.useRef<ComplianceRequestScope | null>(null)
  const mountedRef = React.useRef(true)
  const cacheKey = React.useMemo(() => `aivaspa:onboarding:${user.id}`, [user.id])
  const [showResumeBanner, setShowResumeBanner] = React.useState(() =>
    typeof window !== "undefined" && window.location.search.includes("resume=1"),
  )

  React.useEffect(() => () => {
    mountedRef.current = false
    pendingRequestControllerRef.current?.abort()
  }, [])

  const completedSections = React.useMemo(
    () => SECTION_ORDER.filter((item) => isSectionDone(draft, item)),
    [draft],
  )

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      const cached = parseOnboardingCache(window.localStorage.getItem(cacheKey))
      const serverSavedAt = initialSavedAt ? Date.parse(initialSavedAt) : 0
      const cacheSavedAt = cached ? Date.parse(cached.updatedAt) : 0
      if (cached && cacheSavedAt > serverSavedAt) {
        const restoredDraft = syncOnboardingProgress(cached.draft)
        const restoredSection = isSectionDone(restoredDraft, cached.section)
          ? getNextIncompleteOnboardingField(restoredDraft, cached.section)
          : cached.section
        setDraft(restoredDraft)
        activeSectionRef.current = restoredSection
        setSection(restoredSection)
      }
      setCacheHydrated(true)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [cacheKey, initialSavedAt])

  React.useEffect(() => {
    if (!cacheHydrated) return
    const cached: OnboardingCache = {
      version: 1,
      draft: syncOnboardingProgress(draft),
      section,
      updatedAt: new Date().toISOString(),
    }
    window.localStorage.setItem(cacheKey, JSON.stringify(cached))
  }, [cacheHydrated, cacheKey, draft, section])

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, sending])

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [sending, section])

  React.useEffect(() => {
    if (showResumeBanner) {
      const t = setTimeout(() => setShowResumeBanner(false), 6000)
      return () => clearTimeout(t)
    }
  }, [showResumeBanner])

  React.useEffect(() => {
    if (savingState === "saved") {
      const t = setTimeout(() => setSavingState("idle"), 2000)
      return () => clearTimeout(t)
    }
  }, [savingState])
  function selectSection(nextSection: SetupAssistantSection) {
    pendingRequestControllerRef.current?.abort()
    setEditingSection(isSectionDone(draft, nextSection) ? nextSection : null)
    setConcerns(null)
    latestComplianceRef.current = null
    activeSectionRef.current = nextSection
    setSection(nextSection)
  }

  async function send(text?: string) {
    const trimmed = (text ?? input).trim()
    if (!trimmed || sending || pendingSubmissionRef.current) return
    const submissionId = `onboarding_${user.id}_${makeId()}`
    const submittedSection = section
    const complianceInputHash = faqInputHash(trimmed)
    const requestController = new AbortController()
    pendingRequestControllerRef.current?.abort()
    pendingRequestControllerRef.current = requestController
    pendingSubmissionRef.current = submissionId
    setConcerns(null)
    setInput("")
    setError(null)
    setSavingState("saving")
    const userMsg: ChatMessage = {
      id: makeId(),
      role: "user",
      content: trimmed,
      at: formatTime(new Date()),
    }
    const complianceRequest: ComplianceRequestScope = {
      step: submittedSection,
      submissionId,
      messageId: userMsg.id,
      inputHash: complianceInputHash,
    }
    latestComplianceRef.current = complianceRequest
    const responseIsStale = () => isComplianceResultStale(complianceRequest, {
      currentStep: activeSectionRef.current,
      latestSubmissionId: latestComplianceRef.current?.submissionId ?? null,
      latestInputHash: latestComplianceRef.current?.inputHash ?? null,
      mounted: mountedRef.current,
    })
    const logStaleResponse = () => {
      if (process.env.NODE_ENV === "production") return
      const event = submittedSection === "brand_voice"
        ? "TONE_STALE_RESPONSE_IGNORED"
        : submittedSection === "faqs"
          ? "FAQ_STALE_COMPLIANCE_IGNORED"
          : null
      if (!event) return
      console.info(event, {
        currentOnboardingStep: activeSectionRef.current,
        submittedStep: submittedSection,
        submissionId,
        messageId: userMsg.id,
        complianceInputHash,
      })
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
          currentSection: submittedSection,
          draft,
          explicitEdit: editingSection === submittedSection,
          submissionId,
          messageId: userMsg.id,
        }),
        signal: requestController.signal,
      })
      const responseData = (await res.json().catch(() => ({}))) as {
        error?: string
        errorType?: "VALIDATION_ERROR" | "PARSING_ERROR" | "SAVE_ERROR" | "COMPLIANCE_ERROR" | "NETWORK_ERROR" | "AI_TIMEOUT" | "MALFORMED_AI_RESPONSE"
        message?: string
        reply?: string
        section?: SetupAssistantSection
        nextSection?: SetupAssistantSection | null
        action?: "ask" | "summarize" | "advance" | "finish"
        concerns?: string[]
        draft?: KnowledgeBase
        completedFields?: SetupAssistantSection[]
        selectionReason?: string
        savedAt?: string
      }
      if (!res.ok) {
        if (
          (responseData.errorType === "VALIDATION_ERROR" || responseData.errorType === "PARSING_ERROR")
          && responseData.draft
        ) {
          if (responseIsStale()) {
            logStaleResponse()
            return
          }
          const validationReply = sanitize(
            responseData.message || (submittedSection === "faqs"
              ? "Please provide one visitor question and its approved answer."
              : "Please enter at least one service your business offers."),
          )
          setMessages((prev) => [...prev, {
            id: makeId(), role: "assistant", content: validationReply, at: formatTime(new Date()),
          }])
          setDraft(responseData.draft)
          setSavingState("saved")
          setEditingSection(null)
          return
        }
        throw new Error(responseData.message || responseData.error || `Request failed (${res.status})`)
      }
      const data = responseData as Required<Pick<typeof responseData, "reply" | "section" | "nextSection" | "action" | "concerns" | "draft">> & typeof responseData
      if (responseIsStale()) {
        logStaleResponse()
        return
      }
      const cleanReply = sanitize(data.reply || FALLBACK_REPLY)
      const aiMsg: ChatMessage = {
        id: makeId(),
        role: "assistant",
        content: cleanReply,
        at: formatTime(new Date()),
      }
      setMessages((prev) => [...prev, aiMsg])
      setDraft(data.draft)
      setEditingSection(null)
      setSavingState("saved")
      setConcerns(data.concerns && data.concerns.length > 0
        ? {
            section: data.nextSection ?? data.section,
            sourceSection: submittedSection,
            submissionId,
            messageId: aiMsg.id,
            inputHash: complianceInputHash,
            values: Array.from(new Set(data.concerns)),
          }
        : null)
      if (data.nextSection) {
        activeSectionRef.current = data.nextSection
        setSection(data.nextSection)
      } else if (data.section !== submittedSection) {
        activeSectionRef.current = data.section
        setSection(data.section)
      }
      if (data.action === "finish") {
        await publish(data.draft)
      }
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError"
      if (aborted || responseIsStale()) {
        logStaleResponse()
        return
      }
      setError(e instanceof TypeError
        ? "Network error. Check your connection and try again."
        : e instanceof Error ? e.message : "Setup assistant error")
      setSavingState("idle")
      setInput(trimmed)
    } finally {
      if (pendingRequestControllerRef.current === requestController) {
        pendingRequestControllerRef.current = null
        if (mountedRef.current) setSending(false)
      }
      if (pendingSubmissionRef.current === submissionId) pendingSubmissionRef.current = null
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  async function handleResetAndRestart() {
    setShowResetConfirm(false)
    setMessages([])
    setDraft(emptyKnowledgeBase())
    latestComplianceRef.current = null
    activeSectionRef.current = "business"
    setSection("business")
    setConcerns(null)
    setError(null)
    window.localStorage.removeItem(cacheKey)
    setEditingSection(null)
    try {
      await fetch("/api/onboarding/setup-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          history: [],
          userMessage: "Start over.",
          currentSection: "business",
          draft: emptyKnowledgeBase(),
          operation: "reset",
        }),
      })
    } catch {
    }
  }

  async function handleFinishLater() {
    if (finishingLaterRef.current) return
    finishingLaterRef.current = true
    setSavingState("saving")
    try {
      const response = await fetch("/api/onboarding/setup-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          userMessage: "Finish later.",
          currentSection: section,
          draft,
          operation: "persist",
        }),
      })
      if (!response.ok) throw new Error("Progress could not be saved")
      toast.success("Progress saved. You can continue setup anytime.")
      router.replace("/onboarding?resume=1")
    } catch (saveError) {
      finishingLaterRef.current = false
      setSavingState("idle")
      toast.error(saveError instanceof Error ? saveError.message : "Progress could not be saved")
    }
  }

  async function publish(finalDraft: KnowledgeBase = draft) {
    if (publishingRef.current) return

    publishingRef.current = true
    setPublishStatus("publishing")
    setFinalizeError(null)
    setFinalizeDebug(null)
    try {
      const result = await finalizeSetupAssistant(finalDraft)
      if (!isSuccessfulPublishResult(result)) {
        publishingRef.current = false
        setPublishStatus("failed")
        setFinalizeError(result.error ?? "Failed to publish")
        setFinalizeDebug(result)
        return
      }

      setPublishStatus("published")
      window.localStorage.removeItem(cacheKey)
      toast.success("Knowledge base published successfully.")
      router.replace(result.redirectTo ?? "/dashboard")
      router.refresh()
    } catch (e) {
      publishingRef.current = false
      setPublishStatus("failed")
      setFinalizeError(e instanceof Error ? e.message : "Failed to publish")
    }
  }

  const currentSectionDone = isSectionDone(draft, section)
  const onReview = section === "review"
  const sectionTip = SECTION_TIP[section]
  const suggestions = SUGGESTIONS[section] ?? []
  const currentStep = SECTION_ORDER.indexOf(section) + 1
  const progressPercent = (completedSections.length / SECTION_ORDER.length) * 100
  const focusedAssistantIndex = sending
    ? -1
    : messages.findLastIndex((message) => message.role === "assistant")
  const focusedAssistant =
    focusedAssistantIndex >= 0 ? messages[focusedAssistantIndex] : null
  const historyMessages =
    focusedAssistantIndex >= 0 ? messages.slice(0, focusedAssistantIndex) : messages

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08090A] text-[#F7F8F8]">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]" />
        <motion.div
          className="absolute -left-40 top-[8%] h-[34rem] w-[34rem] rounded-full bg-[#E2E54B]/8 blur-[110px]"
          animate={{ x: [0, 150, 40, 0], y: [0, 70, 180, 0], scale: [1, 1.15, 0.92, 1] }}
          transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-48 bottom-[-10%] h-[38rem] w-[38rem] rounded-full bg-[#5E6AD2]/12 blur-[130px]"
          animate={{ x: [0, -130, -35, 0], y: [0, -100, -30, 0], scale: [1, 0.9, 1.12, 1] }}
          transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-[48%] top-[18%] h-56 w-56 rounded-full border border-[#E2E54B]/10"
          animate={{ rotate: 360, scale: [1, 1.25, 1], opacity: [0.25, 0.55, 0.25] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {showResetConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-[#121316]/95 p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,.65)]">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#EB5757]/10">
              <Trash2 className="size-5 text-[#EB5757]" />
            </span>
            <h3 className="mt-4 text-lg font-semibold">Reset all progress?</h3>
            <p className="mt-2 text-sm leading-6 text-[#8A8F98]">
              Everything captured in this setup will be cleared and you&apos;ll begin again.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => setShowResetConfirm(false)} className="rounded-xl">
                Keep progress
              </Button>
              <Button onClick={() => void handleResetAndRestart()} className="rounded-xl bg-[#EB5757] text-white hover:bg-[#EB5757]/90">
                Reset setup
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <header className="relative z-20 border-b border-white/[0.06] bg-[#08090A]/72 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="AivaSpa home">
            <Logo />
            <span className="hidden h-5 w-px bg-white/10 sm:block" />
            <span className="hidden text-xs font-medium text-[#8A8F98] sm:block">AI setup studio</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className={cn(
              "hidden items-center gap-1.5 text-xs sm:inline-flex",
              savingState === "saved" ? "text-[#4CB782]" : "text-[#8A8F98]",
            )}>
              {savingState === "saving" ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
              {savingState === "saving" ? "Saving" : "Auto-saved"}
            </span>
            <button type="button" onClick={() => setShowResetConfirm(true)} className="text-xs text-[#62666D] transition hover:text-white">
              Start over
            </button>
            <button type="button" onClick={() => void handleFinishLater()} disabled={savingState === "saving"} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-[#F7F8F8] transition hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-40">
              Finish later
            </button>
          </div>
        </div>
      </header>

      {showResumeBanner ? (
        <div className="relative z-20 mx-auto mt-4 max-w-4xl px-5">
          <div className="flex items-center gap-2 rounded-2xl border border-[#4CB782]/20 bg-[#4CB782]/10 px-4 py-3 text-sm text-[#B9E7D1] backdrop-blur-xl">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>Your progress is safe. We&apos;ve opened the exact step you left.</span>
            <button type="button" onClick={() => setShowResumeBanner(false)} className="ml-auto text-xs text-[#8A8F98] hover:text-white">Dismiss</button>
          </div>
        </div>
      ) : null}

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-72px)] max-w-5xl flex-col px-4 pb-8 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E2E54B]">
                <Sparkles className="size-3.5" /> Guided setup
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
                Build your receptionist&apos;s knowledge
              </h1>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm text-[#F7F8F8]">{currentStep}<span className="text-[#62666D]">/{SECTION_ORDER.length}</span></p>
              <p className="mt-1 text-[11px] text-[#62666D]">{Math.round(progressPercent)}% complete</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-9 gap-1.5" aria-label="Onboarding progress">
            {SECTION_ORDER.map((item, index) => {
              const done = isSectionDone(draft, item)
              const active = item === section
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => selectSection(item)}
                  title={`${index + 1}. ${SECTION_LABEL[item]}`}
                  className={cn(
                    "group relative h-1.5 overflow-hidden rounded-full bg-white/[0.07] transition",
                    active && "ring-2 ring-[#E2E54B]/20 ring-offset-2 ring-offset-[#08090A]",
                  )}
                >
                  <span className={cn("absolute inset-0 origin-left transition-transform duration-700", done || active ? "scale-x-100" : "scale-x-0", done ? "bg-[#4CB782]" : "bg-[#E2E54B]")} />
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="font-medium text-[#F7F8F8]">{SECTION_LABEL[section]}</span>
            <span className="hidden text-[#62666D] sm:block">{sectionTip}</span>
          </div>
        </div>

        <section className="mx-auto mt-6 flex w-full max-w-4xl flex-1 flex-col overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#0D0E10]/88 shadow-[0_35px_120px_rgba(0,0,0,.42)] backdrop-blur-xl">
          {historyMessages.length > 0 ? (
            <div ref={scrollRef} className="max-h-52 space-y-3 overflow-y-auto border-b border-white/[0.06] bg-black/10 px-5 py-4 sm:px-7">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#62666D]">Previous conversation</span>
                <span className="h-px flex-1 bg-white/[0.06]" />
              </div>
              {historyMessages.map((message) => (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} key={message.id} className={cn("flex gap-3", message.role === "user" && "justify-end")}>
                  {message.role === "assistant" ? (
                    <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-lg border border-[#E2E54B]/15 bg-[#E2E54B]/8"><Bot className="size-3 text-[#E2E54B]" /></span>
                  ) : null}
                  <div className={cn("max-w-[82%] text-[13px] leading-5", message.role === "assistant" ? "text-[#8A8F98]" : "rounded-xl bg-white/[0.06] px-3 py-2 text-[#D9DADC]")}>
                    <p className="whitespace-pre-wrap">{sanitize(message.content)}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-1 flex-col justify-center px-5 py-8 sm:px-10 sm:py-10">
            <AnimatePresence initial={false}>
              <motion.div
                key={sending ? `thinking-${messages.length}` : `${section}-${focusedAssistant?.id ?? "empty"}`}
                initial={{ opacity: 0, y: 18, filter: "blur(5px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -14, filter: "blur(4px)" }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto w-full max-w-2xl"
              >
                <div className="flex items-center gap-3">
                  <span className="relative flex size-10 items-center justify-center rounded-2xl border border-[#E2E54B]/20 bg-[#E2E54B]/10 shadow-[0_0_28px_rgba(226,229,75,.08)]">
                    {sending ? <Loader2 className="size-4 animate-spin text-[#E2E54B]" /> : <Bot className="size-4 text-[#E2E54B]" />}
                    <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-[#0D0E10] bg-[#4CB782]" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Aiva setup assistant</p>
                    <p className="text-[11px] text-[#62666D]">Learning your approved business details</p>
                  </div>
                  {currentSectionDone && !sending && !error ? (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#4CB782]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#4CB782]"><Check className="size-3" /> Captured</span>
                  ) : null}
                </div>

                <div className="mt-6 min-h-24">
                  {sending ? (
                    <div>
                      <p className="text-xl font-medium tracking-[-0.025em] text-[#F7F8F8] sm:text-2xl">Understanding your answer…</p>
                      <div className="mt-5 flex gap-1.5"><span className="size-2 animate-pulse rounded-full bg-[#E2E54B]" /><span className="size-2 animate-pulse rounded-full bg-[#E2E54B]/60 [animation-delay:150ms]" /><span className="size-2 animate-pulse rounded-full bg-[#E2E54B]/30 [animation-delay:300ms]" /></div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-xl font-medium leading-[1.55] tracking-[-0.025em] text-[#F7F8F8] sm:text-2xl sm:leading-[1.5]">
                      {sanitize(focusedAssistant?.content ?? "Tell me a little about your business to begin.")}
                    </p>
                  )}
                </div>

                {concerns
                && concerns.section === section
                && concerns.messageId === focusedAssistant?.id ? (
                  <div className="mt-5 rounded-2xl border border-[#EB5757]/20 bg-[#EB5757]/5 p-4 text-xs text-[#E8B4B4]">
                    <div className="flex items-center gap-2 font-semibold text-[#EB7777]"><AlertTriangle className="size-3.5" /> Compliance note</div>
                    <p className="mt-1.5 leading-5">{sanitize(concerns.values[concerns.values.length - 1])}</p>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>

          {onReview ? (
            <div className="border-t border-white/[0.06] px-5 py-5 sm:px-7">
              <div className="grid gap-2 sm:grid-cols-2">
                {SECTION_ORDER.filter((item) => item !== "review").map((item) => (
                  <button key={item} type="button" onClick={() => selectSection(item)} className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 text-left transition hover:bg-white/[0.05]">
                    <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg", isSectionDone(draft, item) ? "bg-[#4CB782]/10 text-[#4CB782]" : "bg-white/[0.05] text-[#62666D]")}>{isSectionDone(draft, item) ? <Check className="size-3.5" /> : <Clock className="size-3.5" />}</span>
                    <span className="min-w-0"><span className="block text-xs font-semibold text-[#F7F8F8]">{SECTION_LABEL[item]}</span><span className="mt-1 block truncate text-[11px] text-[#62666D]">{SECTION_SUMMARY[item](draft)}</span></span>
                  </button>
                ))}
              </div>
              {finalizeError ? <div className="mt-3 rounded-xl border border-[#EB5757]/30 bg-[#EB5757]/10 px-3 py-2 text-xs text-[#EB7777]">{finalizeError}</div> : null}
              {process.env.NODE_ENV === "development" && finalizeDebug ? (
                <div className="mt-2 rounded-xl border border-amber-400/25 bg-amber-400/5 px-3 py-2 font-mono text-[11px] leading-5 text-amber-200">
                  <div>Publish failed</div>
                  <div>Stage: {finalizeDebug.stage ?? "unknown"}</div>
                  <div>Code: {finalizeDebug.code ?? "unknown"}</div>
                  <div>Table/RPC: {finalizeDebug.table ?? "unknown"}</div>
                  {finalizeDebug.failedService ? <div>Service: {finalizeDebug.failedService}</div> : null}
                  {finalizeDebug.normalizedCategory ? <div>Category sent: {finalizeDebug.normalizedCategory}</div> : null}
                  {finalizeDebug.details ? <div>Details: {finalizeDebug.details}</div> : null}
                  {finalizeDebug.hint ? <div>Hint: {finalizeDebug.hint}</div> : null}
                </div>
              ) : null}
              <Button onClick={() => void publish()} disabled={finalizing} className="mt-4 h-12 w-full rounded-2xl bg-[#E2E54B] font-semibold text-[#08090A] hover:bg-[#EEF06A]">
                {finalizing ? <><Loader2 className="size-4 animate-spin" /> Publishing…</> : <><FileText className="size-4" /> Publish knowledge base <ArrowRight className="ml-auto size-4" /></>}
              </Button>
            </div>
          ) : (
            <div className="border-t border-white/[0.06] bg-black/10 px-4 py-4 sm:px-7 sm:py-5">
              {error ? <div className="mb-3 rounded-xl border border-[#EB5757]/30 bg-[#EB5757]/10 px-3 py-2 text-xs text-[#EB7777]">{error}</div> : null}
              {suggestions.length > 0 && messages.length <= 2 ? (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  {suggestions.map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => void send(suggestion)} className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-[#8A8F98] transition hover:border-[#E2E54B]/25 hover:text-white">
                      {suggestion.length > 64 ? `${suggestion.slice(0, 64)}…` : suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex items-end gap-3 rounded-[22px] border border-white/[0.09] bg-[#121316] p-2.5 pl-4 shadow-inner shadow-black/20 transition-within:border-[#E2E54B]/40 focus-within:border-[#E2E54B]/40 focus-within:ring-4 focus-within:ring-[#E2E54B]/5">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={sending}
                  placeholder={`Answer about ${SECTION_LABEL[section].toLowerCase()}…`}
                  rows={2}
                  maxLength={2000}
                  className="max-h-32 min-h-12 flex-1 resize-none bg-transparent py-2 text-sm leading-6 text-[#F7F8F8] outline-none placeholder:text-[#62666D]"
                />
                <Button type="button" onClick={() => void send()} disabled={sending || input.trim().length === 0} aria-label="Send answer" className="size-12 shrink-0 rounded-2xl bg-[#E2E54B] text-[#08090A] shadow-[0_8px_28px_rgba(226,229,75,.12)] hover:bg-[#EEF06A] disabled:opacity-25">
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                </Button>
              </div>
              <div className="mt-2.5 flex items-center justify-between px-1 text-[11px] text-[#62666D]">
                <span>Reply naturally — Aiva will ask again if anything is missing.</span>
                <span className="hidden sm:block">Enter to send · Shift + Enter for a new line</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export { SETUP_ASSISTANT_SECTIONS, type KnowledgeBase }