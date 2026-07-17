"use client"

import * as React from "react"
import { Bot, Check, Code2, ImagePlus, Sparkles, Wand2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { WidgetConfig, WidgetPosition } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"
import { getWidgetConfig, updateWidgetConfig } from "@/lib/db/widget"
import { updateWidgetBranding } from "@/app/actions/widget"
import { toast } from "sonner"

const accentPresets = ["#E2E54B", "#5E6AD2", "#22D3EE", "#FF77E9", "#34D399", "#F7F8F8"]

type WidgetTemplate = {
  id: string
  name: string
  tagline: string
  primaryColor: string
  position: WidgetPosition
  welcomeMessage: string
  proactiveMessage: string
  showBranding: boolean
}

const WIDGET_TEMPLATES: WidgetTemplate[] = [
  {
    id: "modern-yellow",
    name: "Modern Yellow",
    tagline: "Bright, friendly, on-trend.",
    primaryColor: "#E2E54B",
    position: "bottom-right",
    welcomeMessage:
      "Hi! Are you looking to book a consultation or ask about a treatment?",
    proactiveMessage:
      "Still browsing? I can answer questions or set up a consultation in seconds.",
    showBranding: true,
  },
  {
    id: "luxe-violet",
    name: "Luxe Violet",
    tagline: "High-end medspa feel.",
    primaryColor: "#5E6AD2",
    position: "bottom-right",
    welcomeMessage:
      "Welcome. How may I help you discover the right treatment for your skin today?",
    proactiveMessage:
      "Questions about downtime, pricing, or booking? I can answer in seconds.",
    showBranding: true,
  },
  {
    id: "calm-cyan",
    name: "Calm Cyan",
    tagline: "Cool, clinical, trustworthy.",
    primaryColor: "#22D3EE",
    position: "bottom-left",
    welcomeMessage:
      "Hello! Need a treatment recommendation or a quick quote? I'm here 24/7.",
    proactiveMessage:
      "Not sure where to start? Tell me your concern and I'll suggest next steps.",
    showBranding: true,
  },
  {
    id: "rose-glow",
    name: "Rose Glow",
    tagline: "Soft, feminine, inviting.",
    primaryColor: "#FF77E9",
    position: "bottom-right",
    welcomeMessage:
      "Hi love! Looking to glow up? Ask me about facials, fillers, laser — anything.",
    proactiveMessage:
      "Curious which treatment fits your goals? I'll help you compare in one minute.",
    showBranding: true,
  },
  {
    id: "sage-minimal",
    name: "Sage Minimal",
    tagline: "Clean, natural, understated.",
    primaryColor: "#34D399",
    position: "bottom-left",
    welcomeMessage:
      "Hi. Looking for a consult, pricing, or to book? I can help right here.",
    proactiveMessage:
      "I can answer FAQs or set up a no-pressure consultation whenever you're ready.",
    showBranding: true,
  },
  {
    id: "noir-pro",
    name: "Noir Pro",
    tagline: "Dark, bold, premium.",
    primaryColor: "#F7F8F8",
    position: "bottom-right",
    welcomeMessage:
      "Welcome. How can I help you plan your next treatment today?",
    proactiveMessage:
      "I can recommend a provider, a service, or book a slot — whichever you need.",
    showBranding: false,
  },
]

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error"

type Day = { day: string; open: boolean; from: string; to: string }

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const DEFAULT_SCHEDULE: Day[] = DAY_LABELS.map((d) => ({
  day: d,
  open: d !== "Mon",
  from: "09:00",
  to: d === "Sat" ? "17:00" : d === "Sun" ? "16:00" : "19:00",
}))

export function WidgetSettings({
  initialConfig,
  initialWebsite,
  allowCustomBranding,
  allowWhiteLabel,
}: {
  initialConfig: WidgetConfig | null
  initialWebsite: string
  allowCustomBranding: boolean
  allowWhiteLabel: boolean
}) {
  const [config, setConfig] = React.useState<WidgetConfig | null>(initialConfig)
  const [loading, setLoading] = React.useState(initialConfig === null)
  const [website, setWebsite] = React.useState<string>(initialWebsite)

  React.useEffect(() => {
    if (initialConfig) return
    getWidgetConfig()
      .then((c) => {
        setConfig(c)
        setLoading(false)
      })
      .catch(() => {
        toast.error("Failed to load widget config")
        setLoading(false)
      })
  }, [initialConfig])

  if (loading) return <div className="text-sm text-[#8A8F98]">Loading widget settings…</div>
  if (!config) return <div className="text-sm text-[#EB5757]">Widget config not found</div>

  return <WidgetSettingsForm key={config.id} initial={config} website={website} setWebsite={setWebsite} allowCustomBranding={allowCustomBranding} allowWhiteLabel={allowWhiteLabel} />
}

function WidgetSettingsForm({
  initial,
  website,
  setWebsite,
  allowCustomBranding,
  allowWhiteLabel,
}: {
  initial: WidgetConfig
  website: string
  setWebsite: (v: string) => void
  allowCustomBranding: boolean
  allowWhiteLabel: boolean
}) {
  const [brandName, setBrandName] = React.useState(initial.brandName)
  const [logoInitial, setLogoInitial] = React.useState(initial.logoInitial || initial.brandName?.[0] || "G")
  const [bubbleLogoUrl, setBubbleLogoUrl] = React.useState<string | null>(initial.bubbleLogoUrl)
  const [position, setPosition] = React.useState<WidgetPosition>(initial.position)
  const [accent, setAccent] = React.useState(initial.primaryColor)
  const [welcome, setWelcome] = React.useState(initial.welcomeMessage)
  const [proactiveEnabled, setProactiveEnabled] = React.useState(initial.proactiveEnabled)
  const [proactiveDelay, setProactiveDelay] = React.useState(initial.proactiveDelaySeconds)
  const [proactiveMessage, setProactiveMessage] = React.useState(initial.proactiveMessage)
  const [collectEmail, setCollectEmail] = React.useState(initial.collectEmail)
  const [collectPhone, setCollectPhone] = React.useState(initial.collectPhone)
  const [showBranding, setShowBranding] = React.useState(initial.showBranding)
  const [consentText, setConsentText] = React.useState(initial.consentText)
  const [workingHoursEnabled, setWorkingHoursEnabled] = React.useState(initial.workingHours.enabled)
  const [schedule, setSchedule] = React.useState<Day[]>(
    initial.workingHours.schedule.length === 7
      ? (initial.workingHours.schedule as Day[])
      : DEFAULT_SCHEDULE,
  )

  const siteUrl =
    (typeof window !== "undefined" && window.location.origin) ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://aivaspa.com"

  // The actual install snippet uses widget_installs.widget_key (NOT
  // widget_config.id). It is rendered above by WidgetInstallsPanel — the
  // card here just points the user at it. Keeping a hard-coded snippet
  // here would produce a snippet that fails checkEmbedAccess.
  void siteUrl

  // --- Auto-save (debounced) ---
  // We collect every field into a single snapshot and compare it to the
  // last-saved baseline (state, not ref, so it triggers a re-render).
  const formState = {
    brandName,
    logoInitial,
    bubbleLogoUrl,
    position,
    primaryColor: accent,
    welcomeMessage: welcome,
    proactiveEnabled,
    proactiveDelaySeconds: proactiveDelay,
    proactiveMessage,
    collectEmail,
    collectPhone,
    showBranding,
    consentText,
    workingHours: {
      enabled: workingHoursEnabled,
      tz: initial.workingHours.tz || "America/Los_Angeles",
      schedule,
    },
  }

  const [baseline, setBaseline] = React.useState(formState)
  const [pending, setPending] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null)
  const [decayTick, setDecayTick] = React.useState(0)

  const isDirty = JSON.stringify(formState) !== JSON.stringify(baseline)
  const saveStatus: SaveStatus = pending
    ? "saving"
    : errorMsg
      ? "error"
      : isDirty
        ? "dirty"
        : lastSavedAt
          ? "saved"
          : "idle"

  // A stable, primitive key that changes whenever any field of the form changes.
  // Used as the effect dep so the linter is happy and we don't churn on identity.
  const formKey = React.useMemo(
    () =>
      JSON.stringify({
        brandName,
        logoInitial,
        bubbleLogoUrl,
        position,
        primaryColor: accent,
        welcomeMessage: welcome,
        proactiveEnabled,
        proactiveDelaySeconds: proactiveDelay,
        proactiveMessage,
        collectEmail,
        collectPhone,
        showBranding,
        consentText,
        workingHoursEnabled,
        schedule,
      }),
    [
      brandName,
      logoInitial,
      bubbleLogoUrl,
      position,
      accent,
      welcome,
      proactiveEnabled,
      proactiveDelay,
      proactiveMessage,
      collectEmail,
      collectPhone,
      showBranding,
      consentText,
      workingHoursEnabled,
      schedule,
    ],
  )

  React.useEffect(() => {
    if (!isDirty) return
    const handle = window.setTimeout(async () => {
      setPending(true)
      setErrorMsg(null)
      try {
        const result = await updateWidgetBranding(formState)
        if (!result.ok) throw new Error(result.error ?? "Save failed")
        await updateWidgetConfig(formState)
        setBaseline(formState)
        setLastSavedAt(new Date())
      } catch (e) {
        console.error("auto-save failed", e)
        setErrorMsg(e instanceof Error ? e.message : "Auto-save failed")
      } finally {
        setPending(false)
      }
    }, 600)
    return () => window.clearTimeout(handle)
    // formState is the captured snapshot; formKey is its stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, formKey])

  // Auto-save website to spa_settings when it changes (separate, non-blocking)
  const [websiteBaseline, setWebsiteBaseline] = React.useState(website)
  React.useEffect(() => {
    if (website === websiteBaseline) return
    const handle = window.setTimeout(async () => {
      try {
        const { updateSpaSettings } = await import("@/app/actions/settings")
        const result = await updateSpaSettings({ website })
        if (!result.ok) throw new Error(result.error ?? "Save failed")
        setWebsiteBaseline(website)
      } catch (e) {
        console.error("website auto-save failed", e)
        toast.error(e instanceof Error ? e.message : "Could not save website")
      }
    }, 600)
    return () => window.clearTimeout(handle)
  }, [website, websiteBaseline])

  // Auto-decay the "Saved" badge so it doesn't linger forever.
  React.useEffect(() => {
    if (saveStatus !== "saved") return
    const t = window.setTimeout(() => {
      setDecayTick((n) => n + 1)
    }, 4000)
    return () => window.clearTimeout(t)
  }, [saveStatus, lastSavedAt])

  const save = async () => {
    setPending(true)
    setErrorMsg(null)
    try {
      const result = await updateWidgetBranding(formState)
      if (!result.ok) throw new Error(result.error ?? "Save failed")
      await updateWidgetConfig(formState)
      const { updateSpaSettings } = await import("@/app/actions/settings")
      const ws = await updateSpaSettings({ website })
      if (!ws.ok) throw new Error(ws.error ?? "Save failed")
      setBaseline(formState)
      setWebsiteBaseline(website)
      setLastSavedAt(new Date())
      toast.success("Widget settings saved")
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Save failed")
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setPending(false)
    }
  }

  const toggleDay = (day: string) => {
    setSchedule((prev) =>
      prev.map((d) => (d.day === day ? { ...d, open: !d.open } : d)),
    )
  }
  const setDayTime = (day: string, field: "from" | "to", value: string) => {
    setSchedule((prev) =>
      prev.map((d) => {
        if (d.day !== day) return d
        return field === "from" ? { ...d, from: value } : { ...d, to: value }
      }),
    )
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file")
      return
    }
    if (file.size > 500_000) {
      toast.error("Image is too large. Please use an image under 500 KB.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === "string") {
        setBubbleLogoUrl(result)
        toast.success("Bubble logo updated")
      }
    }
    reader.onerror = () => toast.error("Could not read that file")
    reader.readAsDataURL(file)
  }

  const applyTemplate = (t: WidgetTemplate) => {
    if (!allowCustomBranding) {
      toast.error("Custom widget styling requires the Growth plan.")
      return
    }
    setAccent(t.primaryColor)
    setWelcome(t.welcomeMessage)
    setProactiveMessage(t.proactiveMessage)
    if (t.position) setPosition(t.position)
    toast.success(`Applied "${t.name}" template`)
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-5">
        <section className="rounded-2xl border border-[#23252A] bg-[#121316]">
          <div className="flex items-center justify-between border-b border-[#23252A] p-5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg border border-[#23252A] bg-[#0B0C0E] text-[#E2E54B]">
                <Wand2 className="size-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-[#F7F8F8]">Pre-made templates</h2>
                <p className="mt-0.5 text-xs text-[#8A8F98]">
                  One-click starter looks. You can fine-tune every field below after applying.
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 p-5 md:grid-cols-3">
            {WIDGET_TEMPLATES.map((t) => {
              const isActive =
                accent.toLowerCase() === t.primaryColor.toLowerCase() &&
                welcome === t.welcomeMessage
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={!allowCustomBranding}
                  onClick={() => applyTemplate(t)}
                  className={cn(
                    "group flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition",
                    isActive
                      ? "border-[#E2E54B]/50 bg-[#E2E54B]/5"
                      : "border-[#23252A] bg-[#0B0C0E] hover:border-[#3A3C42] hover:bg-[#121316]",
                  )}
                >
                  <div className="flex w-full items-center gap-2">
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-[#08090A]"
                      style={{ backgroundColor: t.primaryColor }}
                      aria-hidden
                    >
                      A
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#F7F8F8]">
                      {t.name}
                    </span>
                    {isActive ? (
                      <Check className="size-3.5 shrink-0 text-[#4CB782]" />
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-[10px] leading-4 text-[#8A8F98]">
                    {t.tagline}
                  </p>
                  <div className="flex w-full items-center justify-between text-[9px] uppercase tracking-wider text-[#62666D]">
                    <span>{t.position === "bottom-left" ? "Left" : "Right"}</span>
                    <span
                      className={cn(
                        "transition group-hover:text-[#E2E54B]",
                        isActive && "text-[#E2E54B]",
                      )}
                    >
                      Apply →
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-[#23252A] bg-[#121316]">
          <div className="flex items-center justify-between border-b border-[#23252A] p-5">
            <div>
              <h2 className="text-base font-semibold text-[#F7F8F8]">Brand & appearance</h2>
              <p className="mt-0.5 text-xs text-[#8A8F98]">
                Match the widget to your spa&apos;s website — preview updates as you type.
              </p>
            </div>
            <SaveBadge status={saveStatus} lastSavedAt={lastSavedAt} tick={decayTick} />
          </div>
          <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="brand">Spa name</Label>
              <Input
                id="brand"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Glow Med Spa"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="logo">Logo initial</Label>
              <Input
                id="logo"
                value={logoInitial}
                onChange={(e) => setLogoInitial(e.target.value.slice(0, 2).toUpperCase())}
                placeholder="G"
                maxLength={2}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Bubble logo (optional)</Label>
              <div className="flex items-center gap-3">
                <div
                  className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#23252A] bg-[#0B0C0E]"
                  style={bubbleLogoUrl ? undefined : { backgroundColor: accent }}
                >
                  {bubbleLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bubbleLogoUrl}
                      alt="Bubble logo preview"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="text-base font-bold text-[#08090A]">
                      {(logoInitial || brandName?.[0] || "G").toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#23252A] bg-[#0B0C0E] px-3 py-1.5 text-xs font-semibold text-[#F7F8F8] transition hover:bg-[#1A1B1E]">
                    <ImagePlus className="size-3.5" />
                    {bubbleLogoUrl ? "Replace image" : "Upload image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </label>
                  {bubbleLogoUrl ? (
                    <button
                      type="button"
                      onClick={() => setBubbleLogoUrl(null)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#8A8F98] transition hover:text-[#EB5757]"
                    >
                      <X className="size-2.5" /> Remove image
                    </button>
                  ) : (
                    <p className="text-[10px] text-[#62666D]">
                      Or paste a logo initial above. Square images work best (≤ 500 KB).
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="website">Website URL</Label>
              <Input
                id="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://glowmedspa.com"
                type="url"
                maxLength={200}
              />
              <p className="text-[10px] text-[#62666D]">
                Shown in the browser bar of the preview and saved to your spa settings.
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Accent color</Label>
              <div className="flex flex-wrap items-center gap-2">
                {accentPresets.map((color) => (
                  <button
                    key={color}
                    type="button"
                    disabled={!allowCustomBranding}
                    onClick={() => setAccent(color)}
                    aria-label={`Accent ${color}`}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg border-2 transition",
                      accent.toLowerCase() === color.toLowerCase()
                        ? "border-[#F7F8F8]"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {accent.toLowerCase() === color.toLowerCase() ? (
                      <Check className="size-4 text-[#08090A]" />
                    ) : null}
                  </button>
                ))}
                <div className="ml-1 flex items-center gap-1.5 rounded-lg border border-[#23252A] bg-[#0B0C0E] px-2 py-1 text-xs">
                  <span
                    className="size-3 rounded-sm"
                    style={{ backgroundColor: accent }}
                    aria-hidden
                  />
                  <span className="font-mono text-[#F7F8F8]">{accent}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Position</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { v: "bottom-right" as const, label: "Bottom right" },
                    { v: "bottom-left" as const, label: "Bottom left" },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setPosition(opt.v)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-xs font-semibold transition",
                      position === opt.v
                        ? "border-[#E2E54B]/40 bg-[#E2E54B]/10 text-[#E2E54B]"
                        : "border-[#23252A] bg-[#0B0C0E] text-[#8A8F98] hover:text-[#F7F8F8]",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#23252A] bg-[#121316]">
          <div className="border-b border-[#23252A] p-5">
            <h2 className="text-base font-semibold text-[#F7F8F8]">Greeting & proactive message</h2>
            <p className="mt-0.5 text-xs text-[#8A8F98]">
              How AivaSpa introduces itself and re-engages idle visitors.
            </p>
          </div>
          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="welcome">Welcome message</Label>
              <Textarea
                id="welcome"
                value={welcome}
                disabled={!allowCustomBranding}
                onChange={(e) => setWelcome(e.target.value)}
                className="min-h-20"
                maxLength={500}
                placeholder="Hi! Are you looking to book a consultation or ask about a treatment?"
              />
              <p className="text-[10px] text-[#62666D]">
                {welcome.length}/500 characters
              </p>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3">
              <div>
                <p className="text-sm font-semibold text-[#F7F8F8]">Proactive greeting</p>
                <p className="text-xs text-[#8A8F98]">
                  Send a follow-up after the visitor has been idle.
                </p>
              </div>
              <Switch on={proactiveEnabled} onChange={setProactiveEnabled} />
            </div>
            {proactiveEnabled ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                <div className="space-y-1.5">
                  <Label>Trigger after (sec)</Label>
                  <Input
                    type="number"
                    min={3}
                    max={120}
                    value={proactiveDelay}
                    onChange={(e) =>
                      setProactiveDelay(Math.max(3, Math.min(120, Number(e.target.value) || 8)))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Proactive message</Label>
                  <Input
                    value={proactiveMessage}
                    onChange={(e) => setProactiveMessage(e.target.value)}
                    maxLength={200}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-[#23252A] bg-[#121316]">
          <div className="border-b border-[#23252A] p-5">
            <h2 className="text-base font-semibold text-[#F7F8F8]">Lead capture</h2>
            <p className="mt-0.5 text-xs text-[#8A8F98]">
              What AivaSpa collects from interested visitors.
            </p>
          </div>
          <ul className="divide-y divide-[#23252A]">
            <ToggleRow
              label="Collect email"
              description="Required to send a confirmation and follow-up."
              on={collectEmail}
              onChange={setCollectEmail}
            />
            <ToggleRow
              label="Collect phone"
              description="Required so your team can follow up with the lead."
              on={collectPhone}
              onChange={setCollectPhone}
            />
            <ToggleRow
              label="Show 'Powered by AivaSpa'"
              description={allowWhiteLabel ? "Hide AivaSpa branding on your widget." : "Upgrade to Pro to remove AivaSpa branding."}
              on={allowWhiteLabel ? showBranding : true}
              onChange={(value) => { if (allowWhiteLabel) setShowBranding(value) }}
            />
            <li className="space-y-1.5 p-5">
              <Label htmlFor="consent">Consent text</Label>
              <Textarea
                id="consent"
                value={consentText}
                onChange={(e) => setConsentText(e.target.value)}
                className="min-h-20"
                maxLength={2000}
              />
              <p className="text-[10px] text-[#62666D]">
                Must include a link to your privacy policy. Required for compliance.
              </p>
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-[#23252A] bg-[#121316]">
          <div className="border-b border-[#23252A] p-5">
            <h2 className="text-base font-semibold text-[#F7F8F8]">Working hours</h2>
            <p className="mt-0.5 text-xs text-[#8A8F98]">
              Outside business hours, AivaSpa still answers 24/7 but can show an off-hours note.
            </p>
          </div>
          <div className="p-5">
            <div className="mb-3 flex items-center justify-between rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3">
              <div>
                <p className="text-sm font-semibold text-[#F7F8F8]">Enable working hours</p>
                <p className="text-xs text-[#8A8F98]">
                  {workingHoursEnabled
                    ? `After-hours leads will be flagged. Timezone: ${initial.workingHours.tz || "America/Los_Angeles"}.`
                    : "Currently disabled — AI answers 24/7."}
                </p>
              </div>
              <Switch on={workingHoursEnabled} onChange={setWorkingHoursEnabled} />
            </div>
            <div className={cn("grid grid-cols-1 gap-1.5 sm:grid-cols-2", !workingHoursEnabled && "opacity-60 pointer-events-none")}>
              {schedule.map((d) => (
                <div
                  key={d.day}
                  className="flex items-center gap-3 rounded-lg border border-[#23252A] bg-[#0B0C0E] px-3 py-2"
                >
                  <span className="w-9 text-xs font-semibold text-[#F7F8F8]">{d.day}</span>
                  <Switch on={d.open} onChange={() => toggleDay(d.day)} />
                  <Input
                    type="time"
                    value={d.from}
                    onChange={(e) => setDayTime(d.day, "from", e.target.value)}
                    className="h-7 w-24 px-1.5 text-xs"
                    aria-label={`${d.day} opening time`}
                  />
                  <span className="text-xs text-[#62666D]">to</span>
                  <Input
                    type="time"
                    value={d.to}
                    onChange={(e) => setDayTime(d.day, "to", e.target.value)}
                    className="h-7 w-24 px-1.5 text-xs"
                    aria-label={`${d.day} closing time`}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <SaveBadge status={saveStatus} lastSavedAt={lastSavedAt} tick={decayTick} />
          <Button
            size="sm"
            className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
            onClick={save}
            disabled={pending}
          >
            {pending ? "Saving…" : "Save all changes"}
          </Button>
        </div>
      </div>

      <aside className="flex flex-col gap-5">
        <div className="sticky top-20 flex flex-col gap-5">
          <WidgetPreview
            brandName={brandName}
            logoInitial={logoInitial}
            bubbleLogoUrl={bubbleLogoUrl}
            website={website}
            position={position}
            accent={accent}
            welcome={welcome}
            proactive={proactiveEnabled}
            proactiveDelay={proactiveDelay}
            proactiveMessage={proactiveMessage}
            collectEmail={collectEmail}
            collectPhone={collectPhone}
            consentText={consentText}
            showBranding={showBranding}
            workingHoursEnabled={workingHoursEnabled}
            afterHours={workingHoursEnabled && !isOpenAtNow(schedule)}
          />
          <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
            <div className="flex items-center gap-2">
              <Code2 className="size-4 text-[#5E6AD2]" />
              <h2 className="text-sm font-semibold text-[#F7F8F8]">Install snippet</h2>
            </div>
            <p className="mt-1 text-xs text-[#8A8F98]">
              Your install snippets live in the{" "}
              <span className="text-[#F7F8F8]">Your widget installs</span>{" "}
              panel at the top of this page. Each domain gets its own{" "}
              <code className="rounded bg-[#1A1B1E] px-1 py-0.5 font-mono text-[10px] text-[#F7F8F8]">
                data-spa-id
              </code>
              {" "}— copy the one for the site you are wiring up, paste it
              before{" "}
              <span className="rounded bg-[#1A1B1E] px-1 py-0.5 font-mono text-[10px] text-[#F7F8F8]">
                &lt;/body&gt;
              </span>
              , and you&apos;re live.
            </p>
            <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
              <a href="/dashboard/guide" className="inline-flex items-center justify-center gap-2">
                <Sparkles className="size-4" /> Open the full install guide
              </a>
            </Button>
          </div>
        </div>
      </aside>
    </div>
  )
}

function isOpenAtNow(schedule: Day[]): boolean {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const now = new Date()
  const day = dayNames[now.getDay()]
  const entry = schedule.find((s) => s.day === day)
  if (!entry || !entry.open) return false
  const [oH, oM] = entry.from.split(":").map((n) => parseInt(n, 10))
  const [cH, cM] = entry.to.split(":").map((n) => parseInt(n, 10))
  if (Number.isNaN(oH) || Number.isNaN(cH)) return false
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return nowMin >= oH * 60 + (oM || 0) && nowMin <= cH * 60 + (cM || 0)
}

function SaveBadge({
  status,
  lastSavedAt,
  tick,
}: {
  status: SaveStatus
  lastSavedAt: Date | null
  tick: number
}) {
  if (status === "idle" || (status === "saved" && !lastSavedAt)) return null
  if (status === "saving") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md border border-[#5E6AD2]/30 bg-[#5E6AD2]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8B95E0]"
        role="status"
        aria-live="polite"
      >
        <span className="size-1.5 animate-pulse rounded-full bg-[#5E6AD2]" /> Saving…
      </span>
    )
  }
  if (status === "saved" && lastSavedAt) {
    // tick is a dependency so the auto-decay re-renders the badge.
    void tick
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md border border-[#4CB782]/30 bg-[#4CB782]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#4CB782]"
        role="status"
        aria-live="polite"
      >
        <Check className="size-2.5" /> Saved
      </span>
    )
  }
  if (status === "error") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md border border-[#EB5757]/30 bg-[#EB5757]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#EB5757]"
        role="status"
        aria-live="polite"
      >
        Save failed
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E54B]/30 bg-[#E2E54B]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#E2E54B]"
      role="status"
      aria-live="polite"
    >
      <span className="size-1.5 rounded-full bg-[#E2E54B]" /> Unsaved changes
    </span>
  )
}

function WidgetPreview({
  brandName,
  logoInitial,
  bubbleLogoUrl,
  website,
  position,
  accent,
  welcome,
  proactive,
  proactiveDelay,
  proactiveMessage,
  collectEmail,
  collectPhone,
  consentText,
  showBranding,
  workingHoursEnabled,
  afterHours,
}: {
  brandName: string
  logoInitial: string
  bubbleLogoUrl: string | null
  website: string
  position: WidgetPosition
  accent: string
  welcome: string
  proactive: boolean
  proactiveDelay: number
  proactiveMessage: string
  collectEmail: boolean
  collectPhone: boolean
  consentText: string
  showBranding: boolean
  workingHoursEnabled: boolean
  afterHours: boolean
}) {
  const hostName = React.useMemo(() => {
    if (!website) return "your-spa.com"
    try {
      return new URL(website).host.replace(/^www\./, "")
    } catch {
      return website.replace(/^https?:\/\//, "").replace(/^www\./, "")
    }
  }, [website])

  const initial = (logoInitial || brandName?.[0] || "G").toUpperCase()
  const name = brandName.trim() || "Your med spa"

  return (
    <div className="overflow-hidden rounded-2xl border border-[#23252A] bg-[#0B0C0E]">
      <div className="flex items-center justify-between border-b border-[#23252A] bg-[#121316] px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#EB5757]" />
          <span className="size-2 rounded-full bg-[#E2E54B]" />
          <span className="size-2 rounded-full bg-[#4CB782]" />
        </div>
        <p className="text-[10px] font-mono text-[#62666D]">{hostName}</p>
        <div className="w-12" />
      </div>
      <div className="relative h-[440px] bg-gradient-to-b from-[#0B0C0E] to-[#121316] p-4">
        <div className="space-y-1.5 opacity-50">
          <div className="h-3 w-1/3 rounded-full bg-[#1A1B1E]" />
          <div className="h-2.5 w-2/3 rounded-full bg-[#1A1B1E]" />
          <div className="h-2.5 w-1/2 rounded-full bg-[#1A1B1E]" />
          <div className="h-2.5 w-3/5 rounded-full bg-[#1A1B1E]" />
        </div>
        {/* Launcher bubble — mirrors the actual loader bubble so the user
            sees exactly where it will sit on their site. */}
        <div
          className={cn(
            "absolute bottom-4",
            position === "bottom-right" ? "right-4" : "left-4",
          )}
        >
          <div
            className="flex size-12 items-center justify-center overflow-hidden rounded-full text-base font-bold text-[#08090A] shadow-lg"
            style={bubbleLogoUrl ? undefined : { backgroundColor: accent }}
          >
            {bubbleLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bubbleLogoUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              initial
            )}
          </div>
        </div>
        <div
          className={cn(
            "absolute bottom-20 max-w-[280px] w-[280px]",
            position === "bottom-right" ? "right-4" : "left-4",
          )}
        >
          <div
            className="rounded-2xl border bg-[#1A1B1E] p-3.5 shadow-2xl transition-colors"
            style={{ borderColor: `${accent}40` }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className="flex size-7 items-center justify-center rounded-lg text-[11px] font-bold text-[#08090A]"
                style={{ backgroundColor: accent }}
              >
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-[#F7F8F8]">{name}</p>
                <p className="flex items-center gap-1 text-[9px] text-[#4CB782]">
                  <span className="size-1 rounded-full bg-[#4CB782]" />
                  {workingHoursEnabled && afterHours ? "After hours" : "Online · 24/7"}
                </p>
              </div>
              <Sparkles className="size-3 text-[#8A8F98]" />
            </div>
            {welcome.trim() ? (
              <div className="rounded-xl rounded-tl-sm bg-[#0B0C0E] p-2.5 text-[11px] leading-5 text-[#F7F8F8]">
                {welcome}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#23252A] bg-[#0B0C0E] p-2.5 text-[11px] leading-5 text-[#62666D]">
                Add a welcome message to greet visitors.
              </div>
            )}
            {proactive ? (
              <div
                className="mt-2 rounded-xl border p-2 text-[10px] leading-4 text-[#F7F8F8]"
                style={{
                  borderColor: `${accent}40`,
                  backgroundColor: `${accent}10`,
                }}
              >
                <p
                  className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider"
                  style={{ color: accent }}
                >
                  <Bot className="size-2.5" /> Proactive · {proactiveDelay}s
                </p>
                <p className="mt-0.5">{proactiveMessage}</p>
              </div>
            ) : null}
            <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-[#23252A] bg-[#0B0C0E] px-2 py-1.5 text-[10px] text-[#62666D]">
              <span className="flex-1">Type a question…</span>
              <span
                className="flex size-5 items-center justify-center rounded-md text-[#08090A]"
                style={{ backgroundColor: accent }}
              >
                →
              </span>
            </div>
            {(collectEmail || collectPhone) && consentText.trim() ? (
              <p className="mt-2 line-clamp-2 text-center text-[8.5px] leading-3 text-[#62666D]">
                {consentText}
              </p>
            ) : null}
            {collectEmail || collectPhone ? (
              <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[8.5px] uppercase tracking-wider text-[#62666D]">
                {collectEmail ? <span>Email</span> : null}
                {collectEmail && collectPhone ? <span>·</span> : null}
                {collectPhone ? <span>Phone</span> : null}
                <span>on capture</span>
              </div>
            ) : null}
            {showBranding ? (
              <p className="mt-1.5 text-center text-[9px] text-[#62666D]">
                Powered by AivaSpa
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function Switch({
  on,
  onChange,
}: {
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full border transition",
        on ? "border-[#4CB782]/50 bg-[#4CB782]" : "border-[#23252A] bg-[#1A1B1E]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-3.5 rounded-full bg-[#F7F8F8] transition-all",
          on ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  )
}

function ToggleRow({
  label,
  description,
  on,
  onChange,
}: {
  label: string
  description: string
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <li className="flex items-start gap-3 p-5">
      <div className="flex-1">
        <p className="text-sm font-semibold text-[#F7F8F8]">{label}</p>
        <p className="text-xs text-[#8A8F98]">{description}</p>
      </div>
      <Switch on={on} onChange={onChange} />
    </li>
  )
}
