"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRight,
  Bot,
  CalendarCheck,
  Check,
  ChevronRight,
  Clock3,
  Loader2,
  Mail,
  Menu,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  X,
} from "lucide-react"

import { LeadCaptureModal } from "./lead-capture-modal"
import type { DemoLead, DemoMessage, DemoSession, PublicDemoScenario } from "./types"

const DemoDashboard = dynamic(() => import("./demo-dashboard"), {
  loading: () => <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-[#2A2D33] bg-[#0B0D10]"><div className="text-center"><Loader2 className="mx-auto size-6 animate-spin text-[#E2E54B]" /><p className="mt-3 text-sm text-[#8A8F98]">Loading the demo workspace...</p></div></div>,
})

const starters = [
  "What services do you offer?",
  "Which treatment helps with fine lines?",
  "Do you offer free consultations?",
  "I'd like to request a consultation",
]

export function DemoExperience({ scenarios }: { scenarios: PublicDemoScenario[] }) {
  const [selectedId, setSelectedId] = useState(scenarios[0]?.id || "medical-spa")
  const [scenario, setScenario] = useState(scenarios[0]!)
  const [session, setSession] = useState<DemoSession | null>(null)
  const [messages, setMessages] = useState<DemoMessage[]>([])
  const [lead, setLead] = useState<DemoLead | null>(null)
  const [view, setView] = useState<"visitor" | "business">("visitor")
  const [starting, setStarting] = useState(false)
  const [sending, setSending] = useState(false)
  const [chatOpen, setChatOpen] = useState(true)
  const [input, setInput] = useState("")
  const [error, setError] = useState("")
  const [expired, setExpired] = useState(false)
  const [limitReached, setLimitReached] = useState(false)
  const [consultationOpen, setConsultationOpen] = useState(false)
  const [consultationStarted, setConsultationStarted] = useState(false)
  const [consultationPrompt, setConsultationPrompt] = useState(false)
  const [salesLeadCreated, setSalesLeadCreated] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryStatus, setSummaryStatus] = useState("")
  const chatEndRef = useRef<HTMLDivElement>(null)

  const track = useCallback((eventName: string, metadata: Record<string, string | number | boolean> = {}) => {
    void fetch("/api/demo/event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventName, metadata }), keepalive: true }).catch(() => undefined)
  }, [])

  useEffect(() => {
    track("DEMO_PAGE_VIEWED")
    void fetch("/api/demo/session", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return
      const body = await response.json()
      if (!body.ok) return
      setSession(body.session)
      setScenario(body.scenario)
      setSelectedId(body.scenario.id)
      setMessages(body.messages || [])
      if (body.lead) setLead(mapRestoredLead(body.lead))
      setSalesLeadCreated(Boolean(body.session.salesLeadCreated))
    }).catch(() => undefined)
  }, [track])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [messages, sending])

  const journeyStep = lead ? (view === "business" ? 4 : 3) : consultationStarted ? 2 : messages.some((message) => message.role === "visitor") ? 1 : 0
  const completedEvents = useMemo(() => {
    const events: string[] = []
    if (messages.some((message) => message.role === "assistant")) events.push("Answered visitor questions using the selected demo business knowledge base")
    if (messages.some((message) => /can't|licensed provider|not medical advice|consultation/i.test(message.content))) events.push("Stayed within approved medical and booking guardrails")
    if (lead) {
      events.push("Collected a consultation request with explicit demo consent")
      events.push("Captured contact, service, and preferred-time details")
      events.push("Created a non-billable demo lead automatically")
    }
    if (view === "business") {
      events.push("Prepared the lead for team follow-up")
      events.push("Kept the conversation available for review")
    }
    return events
  }, [lead, messages, view])

  async function startDemo() {
    setStarting(true)
    setError("")
    const params = new URLSearchParams(window.location.search)
    const campaign = Object.fromEntries([...params.entries()].filter(([key]) => /^utm_|^(gclid|fbclid)$/i.test(key)).slice(0, 12))
    const response = await fetch("/api/demo/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioId: selectedId, referrer: document.referrer, campaign }),
    })
    const body = await response.json().catch(() => ({}))
    setStarting(false)
    if (!response.ok || !body.ok) {
      setError(body.error || "The demo could not start. Please try again.")
      return
    }
    setSession(body.session)
    setScenario(body.scenario)
    setMessages(body.messages || [])
    setLead(body.lead ? mapRestoredLead(body.lead) : null)
    setExpired(false)
    setLimitReached(false)
    setChatOpen(true)
    track("DEMO_SCENARIO_SELECTED", { scenario_id: body.scenario.id })
    track("DEMO_CHAT_OPENED", { scenario_id: body.scenario.id })
    document.getElementById("website-preview")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  async function restartDemo() {
    await fetch("/api/demo/session", { method: "DELETE" }).catch(() => undefined)
    setSession(null)
    setMessages([])
    setLead(null)
    setView("visitor")
    setExpired(false)
    setLimitReached(false)
    setConsultationPrompt(false)
    setConsultationStarted(false)
    setSalesLeadCreated(false)
    setError("")
    document.getElementById("scenario-selector")?.scrollIntoView({ behavior: "smooth" })
  }

  async function sendMessage(message: string) {
    const clean = message.trim()
    if (!clean || sending) return
    if (!session) {
      await startDemo()
      setInput(clean)
      return
    }
    const visitor: DemoMessage = { id: crypto.randomUUID(), role: "visitor", content: clean, createdAt: new Date().toISOString() }
    setMessages((current) => [...current, visitor])
    setInput("")
    setSending(true)
    setError("")
    const response = await fetch("/api/demo/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: clean, requestId: visitor.id, website: "" }),
    })
    const body = await response.json().catch(() => ({}))
    setSending(false)
    if (!response.ok || !body.ok) {
      if (body.errorType === "DEMO_LIMIT_REACHED") setLimitReached(true)
      else if (body.errorType === "INVALID_OR_EXPIRED_SESSION") setExpired(true)
      setError(body.error || "The demo assistant is taking longer than expected. Try one of the suggested questions.")
      return
    }
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: body.reply, source: body.source, createdAt: new Date().toISOString() }])
    setSession((current) => current ? { ...current, messageCount: Number(body.messageCount || current.messageCount + 1) } : current)
    if (body.consultationIntent) setConsultationPrompt(true)
    if (body.limitReached) setLimitReached(true)
  }

  function openConsultation() {
    setConsultationStarted(true)
    setConsultationOpen(true)
    track("DEMO_CONSULTATION_STARTED", { scenario_id: scenario.id })
  }

  function handleLeadCreated(created: DemoLead) {
    setLead(created)
    setConsultationOpen(false)
    setConsultationPrompt(false)
    setSession((current) => current ? { ...current, leadCreated: true, completionPercentage: 70, currentStep: "lead" } : current)
  }

  function openBusinessView() {
    if (!lead) return
    setView("business")
    track("DEMO_BUSINESS_VIEW_OPENED", { scenario_id: scenario.id })
    window.setTimeout(() => document.getElementById("demo-view")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
  }

  return (
    <div id="interactive-demo" className="space-y-20 py-16 sm:py-20">
      <section id="scenario-selector" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E2E54B]">Choose a demo business</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#F7F8F8] sm:text-4xl">See Aiva adapt to the business it represents.</h2><p className="mt-4 text-base leading-7 text-[#8F959E]">Each scenario uses a curated, approved knowledge base. Nothing is generated on page load.</p></div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {scenarios.map((option) => <button key={option.id} type="button" disabled={Boolean(session)} onClick={() => { setSelectedId(option.id); setScenario(option) }} className={`min-h-36 rounded-2xl border p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-[#E2E54B] disabled:cursor-default ${selectedId === option.id ? "border-[#E2E54B] bg-[#1B1D12]" : "border-[#292D33] bg-[#101216] hover:border-[#464B54]"}`}><div className="flex items-start justify-between gap-3"><span className="flex size-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${option.theme}22`, color: option.theme }}><Sparkles className="size-4" /></span>{selectedId === option.id ? <Check className="size-4 text-[#E2E54B]" /> : null}</div><h3 className="mt-4 text-sm font-semibold text-[#F7F8F8]">{option.label}</h3><p className="mt-1 text-xs leading-5 text-[#7D848E]">{option.businessName}</p></button>)}
        </div>
        <div className="mt-6 flex flex-col items-center gap-3"><button type="button" onClick={session ? () => document.getElementById("website-preview")?.scrollIntoView({ behavior: "smooth" }) : startDemo} disabled={starting} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-7 py-3.5 text-sm font-bold text-[#08090A] hover:bg-[#EEF05B] disabled:opacity-60 sm:w-auto">{starting ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}{session ? "Continue live demo" : "Start live demo"}</button><p className="text-xs text-[#646B75]">No signup required - isolated demo data - about 2 minutes</p>{error && !session ? <p role="alert" className="text-sm text-[#F28A8D]">{error}</p> : null}</div>
      </section>

      <section id="website-preview" className="scroll-mt-24 border-y border-[#25292F] bg-[#090B0E] py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E2E54B]">Visitor view</p><h2 className="mt-2 text-2xl font-semibold text-[#F7F8F8] sm:text-3xl">Experience the client website and live receptionist.</h2></div><ProgressTracker step={journeyStep} /></div>
          <div className="grid items-start gap-5 xl:grid-cols-[1fr_310px]">
            <div className="overflow-hidden rounded-3xl border border-[#30343B] bg-[#F6F2EB] text-[#181713] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#DED8CF] bg-[#FBF9F5] px-4 py-3 sm:px-6"><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: scenario.theme }}>{scenario.businessName.slice(0, 1)}</span><span className="text-sm font-semibold">{scenario.businessName}</span></div><nav className="hidden items-center gap-5 text-xs font-medium text-[#615D55] sm:flex"><span>Treatments</span><span>About</span><span>Contact</span></nav><Menu className="size-5 sm:hidden" /></div>
              <div className="grid min-h-[430px] lg:grid-cols-[1.05fr_0.95fr]">
                <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-12"><p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: scenario.theme }}>Thoughtful aesthetic care</p><h3 className="mt-4 max-w-lg text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Feel informed before your consultation.</h3><p className="mt-5 max-w-lg text-sm leading-7 text-[#615D55]">{scenario.shortDescription} Explore options, ask questions, and request a time for the team to review.</p><button type="button" onClick={openConsultation} disabled={!session} className="mt-7 inline-flex w-fit items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: scenario.theme }}>Request a consultation <ArrowRight className="size-4" /></button><div className="mt-8 flex flex-wrap gap-5 text-xs font-semibold text-[#4E4A43]"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4" /> Provider-led care</span><span className="inline-flex items-center gap-1.5"><CalendarCheck className="size-4" /> Confirmation required</span></div></div>
                <div className="grid content-center gap-3 bg-[#EEE8DE] p-5 sm:p-8">{scenario.services.slice(0, 3).map((service, index) => <article key={service.name} className="rounded-2xl border border-[#D7D0C5] bg-[#FBF9F5] p-4"><div className="flex items-start justify-between gap-3"><span className="text-xs font-bold uppercase tracking-wider text-[#8C857B]">0{index + 1}</span><span className="rounded-full border border-[#D7D0C5] px-2 py-1 text-[9px] font-semibold text-[#746E65]">{service.duration}</span></div><h4 className="mt-5 text-lg font-semibold">{service.name}</h4><p className="mt-2 text-xs leading-5 text-[#6D675F]">{service.description}</p></article>)}</div>
              </div>
              <div className="grid gap-px border-t border-[#D9D3C9] bg-[#D9D3C9] sm:grid-cols-3"><div className="bg-[#FBF9F5] p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8C857B]">Location</p><p className="mt-2 text-sm font-semibold">{scenario.location}</p></div><div className="bg-[#FBF9F5] p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8C857B]">Hours</p><p className="mt-2 text-sm font-semibold">Mon-Fri, by appointment</p></div><div className="bg-[#FBF9F5] p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8C857B]">Consultations</p><p className="mt-2 text-sm font-semibold">Request first, team confirms</p></div></div>

              {session ? <div className="border-t border-[#D9D3C9] bg-[#E8E2D8] p-3 sm:p-5"><ChatPanel scenario={scenario} open={chatOpen} setOpen={setChatOpen} messages={messages} sending={sending} input={input} setInput={setInput} sendMessage={sendMessage} openConsultation={openConsultation} error={error} expired={expired} limitReached={limitReached} restartDemo={restartDemo} endRef={chatEndRef} consultationPrompt={consultationPrompt} /></div> : <div className="border-t border-[#D9D3C9] bg-[#E8E2D8] p-6 text-center"><p className="text-sm font-semibold">Choose a scenario and start the demo to open Aiva.</p></div>}
              <footer className="flex flex-wrap items-center justify-between gap-3 bg-[#1A1916] px-5 py-5 text-xs text-[#B6B0A7]"><span>{scenario.businessName}</span><span>General information only - suitability confirmed by a provider</span></footer>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-24">
              <div className="rounded-2xl border border-[#292D33] bg-[#101318] p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E2E54B]">Current scenario</p><h3 className="mt-3 text-xl font-semibold text-[#F7F8F8]">{scenario.businessName}</h3><p className="mt-2 text-sm leading-6 text-[#8B929C]">{scenario.tone}</p><div className="mt-4 space-y-2 text-xs text-[#A2A8B0]"><p className="flex gap-2"><Clock3 className="mt-0.5 size-3.5 shrink-0 text-[#E2E54B]" /> {scenario.timezone}</p><p className="flex gap-2"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#E2E54B]" /> Curated approved data</p></div></div>
              <div className="rounded-2xl border border-[#292D33] bg-[#101318] p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#737B85]">Demo controls</p><div className="mt-3 grid gap-2">{lead ? <button type="button" onClick={openBusinessView} className="inline-flex items-center justify-between rounded-xl bg-[#E2E54B] px-4 py-3 text-sm font-bold text-[#08090A]">View demo dashboard <ChevronRight className="size-4" /></button> : <button type="button" onClick={openConsultation} disabled={!session} className="inline-flex items-center justify-between rounded-xl border border-[#373B43] px-4 py-3 text-sm font-semibold text-[#E2E54B] disabled:opacity-50">Request consultation <ChevronRight className="size-4" /></button>}<button type="button" onClick={restartDemo} disabled={!session} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#30343B] px-4 py-3 text-xs font-semibold text-[#AEB4BC] disabled:opacity-40"><RefreshCw className="size-3.5" /> Restart demo</button></div></div>
            </aside>
          </div>
        </div>
      </section>

      {lead ? <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="rounded-3xl border border-[#3E4225] bg-[#17190F] p-6 sm:p-8"><div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]"><div><span className="inline-flex items-center gap-2 rounded-full border border-[#565A2C] px-3 py-1 text-xs font-semibold text-[#E2E54B]"><UserRoundCheck className="size-3.5" /> Lead captured</span><h2 className="mt-4 text-2xl font-semibold text-[#F7F8F8]">Your consultation request was captured.</h2><p className="mt-2 text-sm leading-6 text-[#A3A879]">Now switch perspectives and see what the med-spa team receives. The dashboard uses this exact demo lead and conversation.</p></div><button type="button" onClick={openBusinessView} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-6 py-3 text-sm font-bold text-[#08090A]">View demo dashboard <ArrowRight className="size-4" /></button></div></div></section> : null}

      <section id="demo-view" className="scroll-mt-24 mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E2E54B]">Business view</p><h2 className="mt-2 text-2xl font-semibold text-[#F7F8F8] sm:text-3xl">See what the med-spa team receives.</h2></div>{lead ? <div className="inline-flex rounded-xl border border-[#2D3138] bg-[#0B0D10] p-1"><button type="button" onClick={() => setView("visitor")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${view === "visitor" ? "bg-[#E2E54B] text-[#08090A]" : "text-[#8B929C]"}`}>Visitor view</button><button type="button" onClick={openBusinessView} className={`rounded-lg px-3 py-2 text-xs font-semibold ${view === "business" ? "bg-[#E2E54B] text-[#08090A]" : "text-[#8B929C]"}`}>Business view</button></div> : null}</div>
        {lead && view === "business" ? <DemoDashboard lead={lead} messages={messages} scenario={scenario} onBackToVisitor={() => setView("visitor")} onEvent={track} /> : <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-[#32363D] bg-[#0B0D10] px-6 text-center"><span className="flex size-12 items-center justify-center rounded-2xl bg-[#1B1D12] text-[#E2E54B]"><Bot className="size-6" /></span><h3 className="mt-4 text-lg font-semibold text-[#F7F8F8]">Complete a consultation request first</h3><p className="mt-2 max-w-md text-sm leading-6 text-[#7F8791]">The same conversation and lead will appear here. No unrelated mock records are shown.</p>{session ? <button type="button" onClick={openConsultation} className="mt-5 rounded-xl border border-[#E2E54B] px-4 py-2.5 text-sm font-semibold text-[#E2E54B]">Open consultation flow</button> : null}</div>}
      </section>

      {completedEvents.length ? <section className="mx-auto max-w-5xl px-4 sm:px-6"><div className="rounded-3xl border border-[#2B2F35] bg-[#101318] p-6 sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E2E54B]">Your demo summary</p><h2 className="mt-3 text-3xl font-semibold text-[#F7F8F8]">In this demo, AivaSpa:</h2><ul className="mt-6 grid gap-3 sm:grid-cols-2">{completedEvents.map((event) => <li key={event} className="flex items-start gap-3 rounded-xl border border-[#292D33] bg-[#0B0D10] p-4 text-sm leading-6 text-[#C8CDD3]"><span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#E2E54B] text-[#08090A]"><Check className="size-3" /></span>{event}</li>)}</ul><p className="mt-6 text-sm text-[#8B929C]">Teams can respond consistently even when staff are unavailable.</p></div></section> : null}

      <section className="border-y border-[#2A2D33] bg-[#101318] py-16 sm:py-20"><div className="mx-auto max-w-4xl px-4 text-center sm:px-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E2E54B]">Next step</p><h2 className="mt-3 text-3xl font-semibold text-[#F7F8F8] sm:text-5xl">Ready to see AivaSpa on your own website?</h2><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#8F959E]">Bring your services, policies, and brand voice. We&apos;ll show you how the same journey works for your business.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><a href="mailto:sales@aivaspa.com?subject=Personalised%20AivaSpa%20walkthrough" onClick={() => track("DEMO_BOOK_WALKTHROUGH_CLICKED")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-6 py-3 text-sm font-bold text-[#08090A]">Book a personalised walkthrough <ArrowRight className="size-4" /></a><a href="/signup" onClick={() => track("DEMO_SIGNUP_CLICKED")} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#363A42] px-6 py-3 text-sm font-semibold text-[#F7F8F8] hover:border-[#E2E54B]">Start your setup</a><button type="button" disabled={!session || completedEvents.length === 0} onClick={() => setSummaryOpen(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#363A42] px-6 py-3 text-sm font-semibold text-[#F7F8F8] hover:border-[#E2E54B] disabled:opacity-40"><Mail className="size-4" /> Email me this summary</button></div>{salesLeadCreated ? <p className="mt-5 text-sm text-[#72D39B]">Your AivaSpa contact request was submitted with consent.</p> : null}</div></section>

      <LeadCaptureModal open={consultationOpen} scenario={scenario} onClose={() => setConsultationOpen(false)} onTestLeadCreated={handleLeadCreated} onSalesLeadCreated={() => setSalesLeadCreated(true)} />
      {summaryOpen ? <SummaryModal events={completedEvents} status={summaryStatus} setStatus={setSummaryStatus} onClose={() => setSummaryOpen(false)} /> : null}
    </div>
  )
}

function ChatPanel({ scenario, open, setOpen, messages, sending, input, setInput, sendMessage, openConsultation, error, expired, limitReached, restartDemo, endRef, consultationPrompt }: {
  scenario: PublicDemoScenario; open: boolean; setOpen: (value: boolean) => void; messages: DemoMessage[]; sending: boolean; input: string; setInput: (value: string) => void; sendMessage: (message: string) => void; openConsultation: () => void; error: string; expired: boolean; limitReached: boolean; restartDemo: () => void; endRef: React.RefObject<HTMLDivElement | null>; consultationPrompt: boolean
}) {
  return <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-[#2D3138] bg-[#0D0F12] text-[#F7F8F8] shadow-xl"><button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 bg-[#15181C] px-4 py-3 text-left"><span className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full text-sm font-bold text-[#08090A]" style={{ backgroundColor: scenario.theme }}>{scenario.businessName.slice(0, 1)}</span><span><span className="block text-sm font-semibold">Aiva at {scenario.businessName}</span><span className="mt-0.5 flex items-center gap-1 text-[10px] text-[#72D39B]"><span className="size-1.5 rounded-full bg-[#72D39B]" /> Online in demo mode</span></span></span>{open ? <X className="size-4 text-[#8B929C]" /> : <MessageCircle className="size-4 text-[#8B929C]" />}</button>{open ? <div><div aria-live="polite" className="max-h-[420px] space-y-3 overflow-y-auto bg-[#0A0C0F] p-4"><Bubble role="assistant" content={scenario.welcomeMessage} source="scripted" />{messages.map((message) => <Bubble key={message.id} role={message.role} content={message.content} source={message.source} />)}{sending ? <div className="flex items-center gap-2 text-xs text-[#8B929C]"><Loader2 className="size-3.5 animate-spin text-[#E2E54B]" /> Aiva is checking the approved details...</div> : null}{error ? <div role="alert" className="rounded-xl border border-[#633032] bg-[#281517] p-3 text-xs leading-5 text-[#F28A8D]">{error}</div> : null}{consultationPrompt ? <button type="button" onClick={openConsultation} className="flex w-full items-center justify-between rounded-xl border border-[#565A2C] bg-[#1D1F11] p-3 text-left text-xs font-semibold text-[#E8EA61]">Continue to consultation request <ChevronRight className="size-4" /></button> : null}{(expired || limitReached) ? <div className="rounded-xl border border-[#4C4224] bg-[#211C0E] p-3"><p className="text-xs leading-5 text-[#E8D17C]">{expired ? "This demo session has expired." : "You've completed the interactive demo. Book a walkthrough or start your AivaSpa setup to continue."}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={restartDemo} className="rounded-lg border border-[#6A5D31] px-3 py-2 text-[11px] font-semibold text-[#E8D17C]">Restart demo</button><a href="mailto:sales@aivaspa.com?subject=AivaSpa%20walkthrough" className="rounded-lg bg-[#E2E54B] px-3 py-2 text-[11px] font-bold text-[#08090A]">Book a walkthrough</a><a href="/signup" className="rounded-lg border border-[#6A5D31] px-3 py-2 text-[11px] font-semibold text-[#E8D17C]">Start free trial</a></div></div> : null}<div ref={endRef} /></div>{!expired && !limitReached ? <div className="border-t border-[#24282E] bg-[#101318] p-3"><div className="mb-3 flex gap-2 overflow-x-auto pb-1">{starters.map((starter) => <button key={starter} type="button" disabled={sending} onClick={() => sendMessage(starter)} className="shrink-0 rounded-full border border-[#343840] px-3 py-2 text-[10px] font-semibold text-[#B8BDC4] hover:border-[#E2E54B] hover:text-[#E2E54B] disabled:opacity-40">{starter}</button>)}</div><form onSubmit={(event) => { event.preventDefault(); void sendMessage(input) }} className="flex items-end gap-2"><label className="sr-only" htmlFor="demo-chat-input">Message Aiva</label><textarea id="demo-chat-input" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(input) } }} maxLength={600} rows={1} placeholder="Ask about services, hours, or consultations..." className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-[#343840] bg-[#090B0E] px-3 py-3 text-sm text-white placeholder:text-[#5E6670] focus:border-[#E2E54B] focus:outline-none focus:ring-1 focus:ring-[#E2E54B]" /><button type="submit" disabled={sending || !input.trim()} aria-label="Send message" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#E2E54B] text-[#08090A] disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-white"><Send className="size-4" /></button></form><p className="mt-2 text-[9px] text-[#5F6670]">Product demo only. Do not submit sensitive medical information.</p></div> : null}</div> : null}</div>
}

function Bubble({ role, content, source }: { role: "visitor" | "assistant"; content: string; source?: string }) {
  return <div className={`flex ${role === "visitor" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-3.5 py-3 text-sm leading-6 ${role === "visitor" ? "rounded-br-md bg-[#E2E54B] text-[#08090A]" : "rounded-bl-md border border-[#292D33] bg-[#16191D] text-[#D8DBDF]"}`}><p>{content}</p>{role === "assistant" && source ? <p className="mt-1 text-[9px] uppercase tracking-wider text-[#68717B]">{source === "ai" ? "Approved AI response" : source === "fallback" ? "Safe fallback" : "Approved answer"}</p> : null}</div></div>
}

function ProgressTracker({ step }: { step: number }) {
  const items = ["Ask a question", "Request consultation", "Lead captured", "View dashboard"]
  return <ol className="grid grid-cols-4 gap-1" aria-label="Demo progress">{items.map((item, index) => <li key={item} className="min-w-0"><div className={`h-1 rounded-full ${step >= index + 1 ? "bg-[#E2E54B]" : "bg-[#2C3036]"}`} /><p className={`mt-1 hidden text-[9px] font-semibold sm:block ${step >= index + 1 ? "text-[#D8DB69]" : "text-[#626A74]"}`}>{index + 1}. {item}</p><span className="sr-only">{index + 1}. {item}: {step >= index + 1 ? "complete" : "not complete"}</span></li>)}</ol>
}

function SummaryModal({ events, status, setStatus, onClose }: { events: string[]; status: string; setStatus: (value: string) => void; onClose: () => void }) {
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("Sending...")
    const form = new FormData(event.currentTarget)
    const response = await fetch("/api/demo/summary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email"), consentGiven: form.get("consent") === "on", completedEvents: events }) })
    const body = await response.json().catch(() => ({})); setStatus(response.ok && body.ok ? body.message : body.error || "The email could not be sent.")
  }
  return <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#050607]/90 p-4"><form onSubmit={submit} role="dialog" aria-modal="true" aria-label="Email demo summary" className="w-full max-w-md rounded-2xl border border-[#30343B] bg-[#101318] p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-[#E2E54B]">Demo summary</p><h3 className="mt-2 text-xl font-semibold text-white">Send a privacy-safe recap</h3></div><button type="button" onClick={onClose} aria-label="Close summary form" className="p-2 text-[#8B929C] hover:text-white"><X className="size-5" /></button></div><p className="mt-3 text-sm leading-6 text-[#8F969F]">The email includes completed demo events only. It excludes the transcript and test contact details.</p><label className="mt-5 block text-sm font-semibold text-[#D8DBDF]">Email<input name="email" type="email" required autoComplete="email" className="mt-2 min-h-11 w-full rounded-xl border border-[#343840] bg-[#090B0E] px-3 text-white focus:border-[#E2E54B] focus:outline-none" /></label><label className="mt-4 flex items-start gap-3 text-xs leading-5 text-[#AEB4BC]"><input name="consent" type="checkbox" required className="mt-1 accent-[#E2E54B]" />I consent to receiving this one-time demo summary email.</label><button type="submit" className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-4 text-sm font-bold text-[#08090A]"><Mail className="size-4" /> Email summary</button>{status ? <p role="status" className="mt-3 text-center text-xs text-[#C8CDD3]">{status}</p> : null}</form></div>
}

function mapRestoredLead(row: Record<string, unknown>): DemoLead {
  return { id: String(row.id), name: String(row.name), email: String(row.email), phone: row.phone ? String(row.phone) : "", service: String(row.service), preferredDate: String(row.preferred_date), preferredTime: String(row.preferred_time), notes: row.notes ? String(row.notes) : "", consentGiven: Boolean(row.consent_given), status: String(row.status), assignedTo: row.assigned_to ? String(row.assigned_to) : "", createdAt: String(row.created_at), environment: "public_demo", isBillable: false }
}

