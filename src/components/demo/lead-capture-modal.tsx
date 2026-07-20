"use client"

import { useEffect, useId, useState } from "react"
import { AlertCircle, Check, Loader2, TestTube2, UserRound, X } from "lucide-react"

import type { DemoLead, PublicDemoScenario } from "./types"

type Mode = "test" | "sales"

export function LeadCaptureModal({
  open,
  scenario,
  onClose,
  onTestLeadCreated,
  onSalesLeadCreated,
}: {
  open: boolean
  scenario: PublicDemoScenario
  onClose: () => void
  onTestLeadCreated: (lead: DemoLead) => void
  onSalesLeadCreated: () => void
}) {
  const titleId = useId()
  const errorId = useId()
  const [mode, setMode] = useState<Mode>("test")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  async function submitTest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    const form = new FormData(event.currentTarget)
    const response = await fetch("/api/demo/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "test",
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone"),
        service: form.get("service"),
        preferredDate: form.get("preferredDate"),
        preferredTime: form.get("preferredTime"),
        notes: form.get("notes"),
        consentGiven: form.get("consent") === "on",
      }),
    })
    const body = await response.json().catch(() => ({}))
    setPending(false)
    if (!response.ok || !body.ok) {
      setError(body.error || "We couldn't save this demo request. Your information has not been submitted.")
      return
    }
    onTestLeadCreated(body.lead as DemoLead)
  }

  async function submitSales(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    setSuccess("")
    const form = new FormData(event.currentTarget)
    const response = await fetch("/api/demo/sales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: form.get("fullName"),
        businessName: form.get("businessName"),
        workEmail: form.get("workEmail"),
        phone: form.get("salesPhone"),
        website: form.get("website"),
        locations: form.get("locations"),
        monthlyEnquiries: form.get("monthlyEnquiries"),
        currentProcess: form.get("currentProcess"),
        countryTimezone: form.get("countryTimezone"),
        preferredContactTime: form.get("preferredContactTime"),
        consentGiven: form.get("salesConsent") === "on",
      }),
    })
    const body = await response.json().catch(() => ({}))
    setPending(false)
    if (!response.ok || !body.ok) {
      setError(body.error || "We couldn't submit your request. Please try again.")
      return
    }
    setSuccess(body.message)
    onSalesLeadCreated()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#050607]/90 p-0 sm:items-center sm:p-5" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={error ? errorId : undefined}
        className="max-h-[96dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-[#2A2D33] bg-[#101216] p-5 shadow-2xl sm:rounded-3xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E2E54B]">Consultation request</p>
            <h2 id={titleId} className="mt-2 text-2xl font-semibold text-[#F7F8F8]">Choose what happens to your details</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9CA1A9]">
              This is an AivaSpa product demo. Submit test details, or choose to have the AivaSpa team contact you about the product.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close consultation form" className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#2B2E34] text-[#A5AAB2] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#E2E54B]">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-[#272A30] bg-[#0A0C0F] p-1.5" role="tablist" aria-label="Lead type">
          <button type="button" role="tab" aria-selected={mode === "test"} onClick={() => { setMode("test"); setError(""); setSuccess("") }} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#E2E54B] ${mode === "test" ? "bg-[#E2E54B] text-[#08090A]" : "text-[#9CA1A9] hover:bg-[#17191D]"}`}>
            <TestTube2 className="size-4" /> Test lead
          </button>
          <button type="button" role="tab" aria-selected={mode === "sales"} onClick={() => { setMode("sales"); setError(""); setSuccess(""); void fetch("/api/demo/event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventName: "DEMO_SALES_FORM_OPENED" }) }) }} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#E2E54B] ${mode === "sales" ? "bg-[#E2E54B] text-[#08090A]" : "text-[#9CA1A9] hover:bg-[#17191D]"}`}>
            <UserRound className="size-4" /> Contact me
          </button>
        </div>

        {error ? <div id={errorId} role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-[#633032] bg-[#281517] px-4 py-3 text-sm text-[#F28A8D]"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div> : null}
        {success ? <div role="status" className="mt-5 flex items-start gap-2 rounded-xl border border-[#28523A] bg-[#10251A] px-4 py-3 text-sm text-[#72D39B]"><Check className="mt-0.5 size-4 shrink-0" />{success}</div> : null}

        {mode === "test" ? (
          <form onSubmit={submitTest} className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#3B3E24] bg-[#1D1F11] px-4 py-3">
              <div><p className="text-sm font-semibold text-[#E8EA61]">Demo data</p><p className="text-xs text-[#9EA26A]">Stored separately, never notified, and deleted automatically.</p></div>
              <button type="button" onClick={(event) => {
                const form = event.currentTarget.form
                if (!form) return
                ;(form.elements.namedItem("name") as HTMLInputElement).value = "Alex Morgan"
                ;(form.elements.namedItem("email") as HTMLInputElement).value = "alex@example.com"
                ;(form.elements.namedItem("phone") as HTMLInputElement).value = "(415) 555-0100"
                ;(form.elements.namedItem("service") as HTMLSelectElement).value = scenario.services[0]?.name || ""
                ;(form.elements.namedItem("preferredDate") as HTMLInputElement).value = "Next Tuesday"
                ;(form.elements.namedItem("preferredTime") as HTMLInputElement).value = "Afternoon"
                ;(form.elements.namedItem("notes") as HTMLTextAreaElement).value = "Interested in a first-time consultation."
              }} className="rounded-lg border border-[#565A2C] px-3 py-2 text-xs font-semibold text-[#E8EA61] hover:bg-[#2A2D16] focus:outline-none focus:ring-2 focus:ring-[#E2E54B]">Fill sample details</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" name="name" autoComplete="name" required />
              <Field label="Email" name="email" type="email" autoComplete="email" required />
              <Field label="Phone (optional)" name="phone" type="tel" autoComplete="tel" />
              <label className="space-y-2 text-sm font-medium text-[#D8DBDF]">Service of interest<select name="service" required defaultValue={scenario.services[0]?.name} className={inputClass}>{scenario.services.map((service) => <option key={service.name}>{service.name}</option>)}</select></label>
              <Field label="Preferred date" name="preferredDate" placeholder="Next Tuesday" required />
              <Field label="Preferred time" name="preferredTime" placeholder="Afternoon" required />
            </div>
            <label className="block space-y-2 text-sm font-medium text-[#D8DBDF]">Notes (optional)<textarea name="notes" maxLength={500} rows={3} className={inputClass} /></label>
            <label className="flex items-start gap-3 rounded-xl border border-[#2A2D33] bg-[#0B0D10] p-4 text-sm leading-6 text-[#B8BDC4]"><input name="consent" type="checkbox" required className="mt-1 size-4 accent-[#E2E54B]" /><span>I agree that this demo may store these test details temporarily. Test details will not be used to contact me.</span></label>
            <SubmitButton pending={pending}>Create demo lead</SubmitButton>
          </form>
        ) : (
          <form onSubmit={submitSales} className="mt-6 space-y-5">
            <p className="rounded-xl border border-[#263849] bg-[#0D1922] px-4 py-3 text-xs leading-5 text-[#91B9D8]">These details create a real AivaSpa sales enquiry. They are retained under AivaSpa&apos;s privacy policy and are never added to a med-spa customer workspace.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" name="fullName" autoComplete="name" required />
              <Field label="Business name" name="businessName" autoComplete="organization" required />
              <Field label="Work email" name="workEmail" type="email" autoComplete="work email" required />
              <Field label="Phone (optional)" name="salesPhone" type="tel" autoComplete="tel" />
              <Field label="Website" name="website" placeholder="https://yourspa.com" />
              <Field label="Number of locations" name="locations" type="number" min="1" max="1000" defaultValue="1" required />
              <Field label="Monthly website enquiries" name="monthlyEnquiries" placeholder="Around 50" required />
              <Field label="Country / timezone" name="countryTimezone" placeholder="USA / America/Chicago" required />
              <Field label="Preferred contact time" name="preferredContactTime" placeholder="Weekdays after 2 PM" required />
            </div>
            <label className="block space-y-2 text-sm font-medium text-[#D8DBDF]">Current lead-handling process<textarea name="currentProcess" required maxLength={800} rows={3} placeholder="Front desk replies to forms and website enquiries..." className={inputClass} /></label>
            <label className="flex items-start gap-3 rounded-xl border border-[#2A2D33] bg-[#0B0D10] p-4 text-sm leading-6 text-[#B8BDC4]"><input name="salesConsent" type="checkbox" required className="mt-1 size-4 accent-[#E2E54B]" /><span>I consent to AivaSpa storing these details and contacting me about its product. I understand no meeting is booked by this form.</span></label>
            <SubmitButton pending={pending}>Ask AivaSpa to contact me</SubmitButton>
          </form>
        )}
      </section>
    </div>
  )
}

const inputClass = "mt-2 min-h-11 w-full rounded-xl border border-[#30343B] bg-[#0A0C0F] px-3 py-2.5 text-sm text-[#F7F8F8] placeholder:text-[#5F6670] focus:border-[#E2E54B] focus:outline-none focus:ring-1 focus:ring-[#E2E54B]"

function Field({ label, name, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <label className="space-y-2 text-sm font-medium text-[#D8DBDF]">{label}<input name={name} className={inputClass} {...props} /></label>
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return <button disabled={pending} type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-5 py-3 text-sm font-bold text-[#08090A] hover:bg-[#EEF05B] disabled:cursor-wait disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#101216]">{pending ? <Loader2 className="size-4 animate-spin" /> : null}{children}</button>
}

