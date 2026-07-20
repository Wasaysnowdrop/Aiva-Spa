"use client"

import { useMemo, useState } from "react"
import {
  BellRing,
  CalendarClock,
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Mail,
  MessageSquareText,
  NotebookPen,
  Send,
  UserRoundCheck,
  X,
} from "lucide-react"

import type { DemoLead, DemoMessage, PublicDemoScenario } from "./types"

export default function DemoDashboard({
  lead,
  messages,
  scenario,
  onBackToVisitor,
  onEvent,
}: {
  lead: DemoLead
  messages: DemoMessage[]
  scenario: PublicDemoScenario
  onBackToVisitor: () => void
  onEvent: (name: string, metadata?: Record<string, string | number | boolean>) => void
}) {
  const [status, setStatus] = useState(lead.status || "new")
  const [assignee, setAssignee] = useState(lead.assignedTo || "Unassigned")
  const [note, setNote] = useState("")
  const [savedNotes, setSavedNotes] = useState<string[]>([])
  const [preferredDate, setPreferredDate] = useState(lead.preferredDate)
  const [preferredTime, setPreferredTime] = useState(lead.preferredTime)
  const [emailOpen, setEmailOpen] = useState(false)
  const [feedback, setFeedback] = useState("")
  const exactTime = /^\d{1,2}:\d{2}(\s?[AP]M)?$/i.test(preferredTime) && /^\d{4}-\d{2}-\d{2}$/.test(preferredDate)
  const transcript = useMemo(() => [
    { id: "welcome", role: "assistant" as const, content: scenario.welcomeMessage, createdAt: lead.createdAt },
    ...messages,
  ], [lead.createdAt, messages, scenario.welcomeMessage])

  function action(message: string, callback?: () => void) {
    callback?.()
    setFeedback(message)
    window.setTimeout(() => setFeedback(""), 3500)
  }

  function markBooked() {
    if (!exactTime) {
      action("Choose an exact date and time before marking this request booked.")
      return
    }
    action("Demo booking marked as confirmed.", () => setStatus("booked"))
  }

  return (
    <section aria-label="Demo business dashboard" className="overflow-hidden rounded-3xl border border-[#2A2D33] bg-[#0B0D10]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#262A30] bg-[#101318] px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#E2E54B] font-bold text-[#08090A]">A</span>
          <div><div className="flex items-center gap-2"><h3 className="font-semibold text-[#F7F8F8]">{scenario.businessName}</h3><span className="rounded-full border border-[#565A2C] bg-[#202311] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#E8EA61]">Demo workspace</span></div><p className="mt-0.5 text-xs text-[#777E88]">Lead inbox / current demo session</p></div>
        </div>
        <button type="button" onClick={onBackToVisitor} className="rounded-xl border border-[#31353C] px-4 py-2.5 text-sm font-semibold text-[#D3D7DC] hover:border-[#E2E54B] hover:text-[#E2E54B] focus:outline-none focus:ring-2 focus:ring-[#E2E54B]">Back to visitor view</button>
      </header>

      {feedback ? <div role="status" className="border-b border-[#3E4225] bg-[#1A1C10] px-5 py-3 text-sm text-[#E4E765]">{feedback}</div> : null}

      <div className="grid xl:grid-cols-[220px_1fr]">
        <aside className="hidden border-r border-[#262A30] bg-[#090B0E] p-3 xl:block">
          {["Overview", "Leads", "Conversations", "Calendar", "Analytics"].map((item, index) => <div key={item} className={`mb-1 flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold ${index === 1 ? "bg-[#1B1E22] text-[#F7F8F8]" : "text-[#727A84]"}`}><span>{item}</span>{index === 1 ? <span className="rounded-full bg-[#E2E54B] px-1.5 py-0.5 text-[9px] text-[#08090A]">1</span> : null}</div>)}
        </aside>

        <div className="min-w-0 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric value="1" label="New lead" icon={<CircleUserRound className="size-4" />} />
            <Metric value="1" label="Active conversation" icon={<MessageSquareText className="size-4" />} />
            <Metric value="1" label="Consultation request" icon={<CalendarClock className="size-4" />} />
            <Metric value="Prepared" label="Email notification" icon={<BellRing className="size-4" />} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-5">
              <article className="rounded-2xl border border-[#292D33] bg-[#101318]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#292D33] px-4 py-3.5"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#737B85]">Lead details</p><h4 className="mt-1 text-lg font-semibold text-[#F7F8F8]">{lead.name}</h4></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${status === "booked" ? "border-[#28523A] bg-[#10251A] text-[#72D39B]" : status === "contacted" ? "border-[#2A4963] bg-[#10202D] text-[#7AB6E0]" : "border-[#585B30] bg-[#202211] text-[#E6E860]"}`}>{status}</span></div>
                <dl className="grid gap-px bg-[#24282E] sm:grid-cols-2">
                  <Detail label="Service" value={lead.service} />
                  <Detail label="Preferred" value={`${preferredDate}, ${preferredTime}`} />
                  <Detail label="Email" value={lead.email} />
                  <Detail label="Phone" value={lead.phone || "Not provided"} />
                  <Detail label="Source" value="Interactive demo" />
                  <Detail label="Consent" value={lead.consentGiven ? "Captured" : "Not captured"} />
                </dl>
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-[#9AA1AA]">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className={controlClass}><option value="new">New</option><option value="contacted">Contacted</option><option value="booked">Booked</option><option value="lost">Lost</option></select></label>
                  <label className="text-xs font-semibold text-[#9AA1AA]">Assigned to<select value={assignee} onChange={(event) => { setAssignee(event.target.value); action(`Assigned to ${event.target.value}.`) }} className={controlClass}><option>Unassigned</option><option>Maya - Demo owner</option><option>Jordan - Demo receptionist</option></select></label>
                </div>
              </article>

              <article id="demo-transcript" className="rounded-2xl border border-[#292D33] bg-[#101318] p-4">
                <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#737B85]">Conversation</p><h4 className="mt-1 font-semibold text-[#F7F8F8]">Full demo transcript</h4></div><span className="inline-flex items-center gap-1.5 rounded-full border border-[#28523A] bg-[#10251A] px-2.5 py-1 text-[10px] font-semibold text-[#72D39B]"><Check className="size-3" /> Approved-AI guardrails</span></div>
                <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
                  {transcript.map((message) => <div key={message.id} className={`rounded-xl border p-3 ${message.role === "assistant" ? "border-[#3D4025] bg-[#1A1C10]" : "ml-8 border-[#30343B] bg-[#16191D]"}`}><div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-wider"><span className={message.role === "assistant" ? "text-[#E2E54B]" : "text-[#8E96A0]"}>{message.role === "assistant" ? "Aiva" : "Visitor"}</span><span className="text-[#555D67]">{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div><p className="text-sm leading-6 text-[#D8DBDF]">{message.content}</p></div>)}
                  <div className="rounded-xl border border-[#28523A] bg-[#10251A] p-3 text-sm text-[#72D39B]">Lead-capture event: consultation request saved as isolated demo data.</div>
                </div>
              </article>
            </div>

            <div className="space-y-5">
              <article className="rounded-2xl border border-[#292D33] bg-[#101318] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#737B85]">Consultation request</p>
                <div className="mt-3 flex items-start gap-3 rounded-xl border border-[#4C4224] bg-[#211C0E] p-3"><Clock3 className="mt-0.5 size-4 text-[#E0BE59]" /><div><p className="text-sm font-semibold text-[#E8D17C]">{exactTime && status === "booked" ? "Confirmed in demo" : "Needs scheduling"}</p><p className="mt-1 text-xs leading-5 text-[#A79663]">{exactTime ? status === "booked" ? `${preferredDate} at ${preferredTime}` : "An exact time is selected but the team has not confirmed it." : `"${preferredDate}, ${preferredTime}" is a preference, not a confirmed appointment.`}</p></div></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1"><label className="text-xs font-semibold text-[#9AA1AA]">Exact date<input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) ? preferredDate : ""} onChange={(event) => setPreferredDate(event.target.value)} className={controlClass} /></label><label className="text-xs font-semibold text-[#9AA1AA]">Exact time<input type="time" value={/^\d{2}:\d{2}$/.test(preferredTime) ? preferredTime : ""} onChange={(event) => setPreferredTime(event.target.value)} className={controlClass} /></label></div>
                <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => action("Lead marked contacted.", () => setStatus("contacted"))} className={secondaryButton}><UserRoundCheck className="size-3.5" /> Mark contacted</button><button type="button" onClick={markBooked} className={primaryButton}><Check className="size-3.5" /> Mark booked</button><button type="button" onClick={() => action("Choose a new exact date and time above.")} className={secondaryButton}>Reschedule</button><button type="button" onClick={() => action("Demo booking cancelled.", () => setStatus("lost"))} className={secondaryButton}>Cancel demo booking</button></div>
              </article>

              <article className="rounded-2xl border border-[#292D33] bg-[#101318] p-4">
                <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#737B85]">Email notification</p><h4 className="mt-1 text-sm font-semibold text-[#F7F8F8]">Prepared for front desk</h4></div><Mail className="size-5 text-[#E2E54B]" /></div>
                <p className="mt-3 text-xs leading-5 text-[#858D97]">Sample only. No customer or test-lead email is sent from this workspace.</p>
                <button type="button" onClick={() => setEmailOpen(true)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#343840] px-3 py-2.5 text-xs font-semibold text-[#D8DBDF] hover:border-[#E2E54B] hover:text-[#E2E54B]"><Send className="size-3.5" /> Preview sample follow-up</button>
              </article>

              <article className="rounded-2xl border border-[#292D33] bg-[#101318] p-4">
                <div className="flex items-center gap-2"><NotebookPen className="size-4 text-[#E2E54B]" /><h4 className="text-sm font-semibold text-[#F7F8F8]">Internal notes</h4></div>
                {savedNotes.map((saved, index) => <p key={index} className="mt-3 rounded-lg bg-[#171A1E] p-3 text-xs leading-5 text-[#AEB4BC]">{saved}</p>)}
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={300} placeholder="Add a note for the demo team..." className={`${controlClass} resize-none`} />
                <button type="button" disabled={!note.trim()} onClick={() => action("Internal note added locally.", () => { setSavedNotes((current) => [...current, note.trim()]); setNote("") })} className="mt-2 text-xs font-semibold text-[#E2E54B] disabled:text-[#555D67]">Add internal note</button>
              </article>

              <article className="rounded-2xl border border-[#292D33] bg-[#101318] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#737B85]">Demo-session analytics</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center"><MiniMetric value="1" label="Conversation" /><MiniMetric value="1" label="Lead" /><MiniMetric value="100%" label="Conversion" /></div>
                <p className="mt-3 text-[10px] text-[#626A74]">Only this demo session. Not production analytics.</p>
              </article>
            </div>
          </div>
        </div>
      </div>

      {emailOpen ? <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#050607]/90 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-label="Sample email preview" className="w-full max-w-lg rounded-2xl border border-[#30343B] bg-[#101318] p-5"><div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-wider text-[#E2E54B]">Sample email - not sent</p><h4 className="mt-2 text-lg font-semibold text-white">Your consultation request at {scenario.businessName}</h4></div><button type="button" onClick={() => setEmailOpen(false)} aria-label="Close email preview" className="p-2 text-[#8B929C] hover:text-white"><X className="size-5" /></button></div><div className="mt-5 rounded-xl border border-[#292D33] bg-[#0B0D10] p-4 text-sm leading-6 text-[#C8CDD3]"><p>Hi {lead.name.split(" ")[0]},</p><p className="mt-3">We received your request about {lead.service}. Your preference is {preferredDate}, {preferredTime}. Our team will contact you to confirm availability; this message does not confirm an appointment.</p><p className="mt-3">- {scenario.businessName}</p></div><button type="button" onClick={() => { setEmailOpen(false); action("Sample email previewed. Nothing was sent."); onEvent("DEMO_COMPLETED", { sample_email_previewed: true }) }} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-4 py-3 text-sm font-bold text-[#08090A]">Done <ChevronRight className="size-4" /></button></div></div> : null}
    </section>
  )
}

const controlClass = "mt-2 min-h-10 w-full rounded-lg border border-[#30343B] bg-[#0A0C0F] px-3 py-2 text-sm text-[#F7F8F8] focus:border-[#E2E54B] focus:outline-none focus:ring-1 focus:ring-[#E2E54B]"
const secondaryButton = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[#343840] px-2 py-2 text-[11px] font-semibold text-[#C8CDD3] hover:border-[#E2E54B] hover:text-[#E2E54B]"
const primaryButton = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#E2E54B] px-2 py-2 text-[11px] font-bold text-[#08090A] hover:bg-[#EEF05B]"

function Metric({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return <article className="rounded-xl border border-[#292D33] bg-[#101318] p-3"><div className="flex items-center justify-between text-[#E2E54B]"><span className="text-xl font-semibold text-[#F7F8F8]">{value}</span>{icon}</div><p className="mt-1 text-[10px] uppercase tracking-wider text-[#69717B]">{label}</p></article>
}

function MiniMetric({ value, label }: { value: string; label: string }) {
  return <div className="rounded-lg bg-[#0B0D10] p-2"><p className="text-lg font-semibold text-[#F7F8F8]">{value}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-[#69717B]">{label}</p></div>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="bg-[#101318] p-4"><dt className="text-[10px] font-semibold uppercase tracking-wider text-[#68717B]">{label}</dt><dd className="mt-1.5 break-words text-sm text-[#D8DBDF]">{value}</dd></div>
}

