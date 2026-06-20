"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  CheckCircle2,
  CreditCard,
  KeyRound,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Send,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiSection, type ApiSectionProps } from "@/components/dashboard/api-section"
import { BillingView, type BillingViewProps } from "@/components/dashboard/billing-view"
import type { NotificationLog, IntegrationConfig } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"
import { getIntegrations, getSpaSettings } from "@/lib/db/settings"
import type { SpaSettings } from "@/lib/supabase/types"
import { useRealtimeSubscription } from "@/lib/hooks/use-realtime"
import { mapNotificationLog } from "@/lib/supabase/types"
import { toast } from "sonner"
import { updateSpaSettings, deleteWorkspaceAction } from "@/app/actions/settings"
import { CustomCalendarSettings } from "@/components/dashboard/integrations/calendar"
import { updateNotificationChannel } from "@/app/actions/widget"
import { getNotificationChannels } from "@/lib/db/notifications"
import type { NotificationChannelConfig } from "@/lib/supabase/types"

type Section = "account" | "notifications" | "integrations" | "privacy" | "billing" | "api"

export function SettingsView({ billing, api }: { billing: BillingViewProps; api: ApiSectionProps }) {
  const [section, setSection] = React.useState<Section>(() => {
    if (typeof window === "undefined") return "account"
    const params = new URLSearchParams(window.location.search)
    const s = params.get("section")
    if (
      s === "account" ||
      s === "notifications" ||
      s === "integrations" ||
      s === "privacy" ||
      s === "billing" ||
      s === "api"
    ) {
      return s
    }
    return "account"
  })

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav className="rounded-2xl border border-[#23252A] bg-[#121316] p-2">
        {(
          [
            { v: "account" as const, label: "Account", icon: User },
            { v: "notifications" as const, label: "Notifications", icon: Bell },
            { v: "integrations" as const, label: "Integrations", icon: MessageSquare },
            { v: "privacy" as const, label: "Privacy & data", icon: Shield },
            { v: "billing" as const, label: "Billing", icon: CreditCard },
            { v: "api" as const, label: "API & webhooks", icon: KeyRound },
          ]
        ).map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.v}
              type="button"
              onClick={() => setSection(item.v)}
              className={cn(
                "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition",
                section === item.v
                  ? "bg-[#1A1B1E] text-[#F7F8F8]"
                  : "text-[#8A8F98] hover:bg-[#1A1B1E] hover:text-[#F7F8F8]",
              )}
            >
              <Icon
                className={cn(
                  "size-4 transition-colors",
                  section === item.v ? "text-[#E2E54B]" : "text-[#8A8F98] group-hover:text-[#F7F8F8]",
                )}
              />
              {item.label}
            </button>
          )
        })}
      </nav>

      <section className="flex flex-col gap-5">
        {section === "account" && <AccountSection />}
        {section === "notifications" && <NotificationsSection />}
        {section === "integrations" && <IntegrationsSection />}
        {section === "privacy" && <PrivacySection />}
        {section === "billing" && <BillingSection billing={billing} />}
        {section === "api" && <ApiSection {...api} />}
      </section>
    </div>
  )
}

function AccountSection() {
  const router = useRouter()
  const [settings, setSettings] = React.useState<SpaSettings | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [confirmText, setConfirmText] = React.useState("")
  const [showConfirm, setShowConfirm] = React.useState(false)

  const spaRef = React.useRef<HTMLInputElement>(null)
  const websiteRef = React.useRef<HTMLInputElement>(null)
  const ownerRef = React.useRef<HTMLInputElement>(null)
  const emailRef = React.useRef<HTMLInputElement>(null)
  const addressRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    getSpaSettings()
      .then(setSettings)
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const result = await updateSpaSettings({
      spaName: spaRef.current?.value ?? undefined,
      website: websiteRef.current?.value ?? undefined,
      ownerName: ownerRef.current?.value ?? undefined,
      ownerEmail: emailRef.current?.value ?? undefined,
      address: addressRef.current?.value ?? undefined,
    })
    setSaving(false)
    if (result.ok) {
      toast.success("Settings saved")
      router.refresh()
    } else {
      toast.error(result.error ?? "Failed to save settings")
    }
  }

  const handleDelete = async () => {
    if (confirmText !== "DELETE") {
      toast.error("Type DELETE in capitals to confirm")
      return
    }
    setDeleting(true)
    try {
      const result = await deleteWorkspaceAction()
      if (result.ok) {
        toast.success("Workspace deleted")
        router.push("/")
        router.refresh()
      } else {
        setDeleting(false)
        toast.error(result.error ?? "Failed to delete workspace")
      }
    } catch {
      setDeleting(false)
    }
  }

  if (loading) return <div className="text-sm text-[#8A8F98]">Loading...</div>

  return (
    <>
      <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
        <h2 className="text-base font-semibold text-[#F7F8F8]">Account</h2>
        <p className="mt-0.5 text-xs text-[#8A8F98]">
          Update your spa details and personal profile.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="spa">Spa name</Label>
            <Input id="spa" ref={spaRef} defaultValue={settings?.spaName ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website">Website</Label>
            <Input id="website" ref={websiteRef} defaultValue={settings?.website ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="owner">Owner name</Label>
            <Input id="owner" ref={ownerRef} defaultValue={settings?.ownerName ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Owner email</Label>
            <Input id="email" ref={emailRef} type="email" defaultValue={settings?.ownerEmail ?? ""} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" ref={addressRef} defaultValue={settings?.address ?? ""} />
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={saving}
            onClick={handleSave}
            className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
          >
            {saving ? (
              <><Loader2 className="size-4 animate-spin" /> Saving…</>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
        <h2 className="text-base font-semibold text-[#F7F8F8]">Danger zone</h2>
        <p className="mt-0.5 text-xs text-[#8A8F98]">
          These actions are permanent. Please be sure.
        </p>
        {!showConfirm ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EB5757]/30 bg-[#EB5757]/5 p-4">
            <div>
              <p className="text-sm font-semibold text-[#F7F8F8]">Delete workspace</p>
              <p className="text-xs text-[#8A8F98]">
                Permanently delete your spa workspace, leads, and conversations.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-[#EB5757] hover:bg-[#EB5757]/10 hover:text-[#EB5757]"
              onClick={() => setShowConfirm(true)}
            >
              <Trash2 className="size-4" /> Delete workspace
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3 rounded-xl border border-[#EB5757]/30 bg-[#EB5757]/5 p-4">
            <p className="text-sm font-semibold text-[#F7F8F8]">Are you absolutely sure?</p>
            <p className="text-xs text-[#8A8F98]">
              This will wipe all leads, conversations, API keys, webhooks, and
              widget installs. Type <code className="rounded bg-[#0B0C0E] px-1 py-0.5 font-mono text-[#F7F8F8]">DELETE</code> to confirm.
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="font-mono"
              disabled={deleting}
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowConfirm(false)
                  setConfirmText("")
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={deleting || confirmText !== "DELETE"}
                onClick={handleDelete}
                className="bg-[#EB5757] text-[#F7F8F8] hover:bg-[#EB5757]/90"
              >
                {deleting ? (
                  <><Loader2 className="size-4 animate-spin" /> Deleting…</>
                ) : (
                  <><Trash2 className="size-4" /> Delete forever</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function NotificationsSection() {
  const [channels, setChannels] = React.useState<NotificationChannelConfig[]>([])
  const [loading, setLoading] = React.useState(true)
  const [recipientDrafts, setRecipientDrafts] = React.useState<Record<string, string>>({})
  const [sending, setSending] = React.useState<Record<string, boolean>>({})

  const refresh = React.useCallback(async () => {
    try {
      const rows = await getNotificationChannels()
      setChannels(rows)
      const drafts: Record<string, string> = {}
      for (const c of rows) drafts[c.id] = ""
      setRecipientDrafts(drafts)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const setEnabled = async (id: string, enabled: boolean) => {
    setSending((s) => ({ ...s, [id]: true }))
    const result = await updateNotificationChannel({ id, enabled })
    setSending((s) => ({ ...s, [id]: false }))
    if (result.ok) {
      setChannels((prev) =>
        prev.map((c) => (c.id === id ? { ...c, enabled } : c)),
      )
      toast.success(enabled ? "Channel enabled" : "Channel disabled")
    } else {
      toast.error(result.error ?? "Failed to update channel")
    }
  }

  const addRecipient = async (id: string) => {
    const value = (recipientDrafts[id] ?? "").trim()
    if (!value) return
    const channel = channels.find((c) => c.id === id)
    if (!channel) return
    if (channel.recipients.includes(value)) {
      toast.error("Already in the list")
      return
    }
    const next = [...channel.recipients, value]
    setSending((s) => ({ ...s, [id]: true }))
    const result = await updateNotificationChannel({ id, recipients: next })
    setSending((s) => ({ ...s, [id]: false }))
    if (result.ok) {
      setChannels((prev) =>
        prev.map((c) => (c.id === id ? { ...c, recipients: next } : c)),
      )
      setRecipientDrafts((d) => ({ ...d, [id]: "" }))
      toast.success("Recipient added")
    } else {
      toast.error(result.error ?? "Failed")
    }
  }

  const removeRecipient = async (id: string, value: string) => {
    const channel = channels.find((c) => c.id === id)
    if (!channel) return
    const next = channel.recipients.filter((r) => r !== value)
    setSending((s) => ({ ...s, [id]: true }))
    const result = await updateNotificationChannel({ id, recipients: next })
    setSending((s) => ({ ...s, [id]: false }))
    if (result.ok) {
      setChannels((prev) =>
        prev.map((c) => (c.id === id ? { ...c, recipients: next } : c)),
      )
      toast.success("Removed")
    } else {
      toast.error(result.error ?? "Failed")
    }
  }

  const channelIcon = (channel: string) => {
    if (channel === "email") return Mail
    if (channel === "sms") return Smartphone
    return MessageSquare
  }

  const channelLabel = (channel: string) => {
    if (channel === "email") return "Email"
    if (channel === "sms") return "SMS"
    if (channel === "daily_summary") return "Daily summary"
    return channel
  }

  const channelDescription = (channel: string) => {
    if (channel === "email")
      return "Instant email when a new lead is captured"
    if (channel === "sms")
      return "Instant SMS to mobile numbers (Twilio)"
    if (channel === "daily_summary")
      return "Every morning at 8 AM, get a recap of yesterday's leads"
    return ""
  }

  const { data: notifications } = useRealtimeSubscription<NotificationLog>({
    table: "notification_logs",
    initialData: [],
    mapRow: (row) => mapNotificationLog(row),
    getId: (item) => item.id,
  })

  return (
    <>
      <div className="rounded-2xl border border-[#23252A] bg-[#121316]">
        <div className="border-b border-[#23252A] p-5">
          <h2 className="text-base font-semibold text-[#F7F8F8]">Notification channels</h2>
          <p className="mt-0.5 text-xs text-[#8A8F98]">
            Where to ping your team the moment a lead comes in.
          </p>
        </div>
        <div className="divide-y divide-[#23252A]">
          {loading ? (
            <div className="p-5 text-center text-xs text-[#8A8F98]">Loading channels…</div>
          ) : channels.length === 0 ? (
            <div className="p-5 text-center text-xs text-[#8A8F98]">
              No channels configured yet. New leads will still land in your inbox.
            </div>
          ) : (
            channels.map((ch) => (
              <ChannelRowEditor
                key={ch.id}
                id={ch.id}
                icon={channelIcon(ch.channel)}
                label={channelLabel(ch.channel)}
                description={channelDescription(ch.channel)}
                on={ch.enabled}
                recipients={ch.recipients}
                draft={recipientDrafts[ch.id] ?? ""}
                onDraftChange={(v) =>
                  setRecipientDrafts((d) => ({ ...d, [ch.id]: v }))
                }
                busy={Boolean(sending[ch.id])}
                onToggle={(v) => void setEnabled(ch.id, v)}
                onAdd={() => void addRecipient(ch.id)}
                onRemove={(r) => void removeRecipient(ch.id, r)}
              />
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[#23252A] bg-[#121316]">
        <div className="flex items-center justify-between border-b border-[#23252A] p-5">
          <div>
            <h2 className="text-base font-semibold text-[#F7F8F8]">Recent notifications</h2>
            <p className="mt-0.5 text-xs text-[#8A8F98]">Delivery log for the last 24 hours</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Test sends are wired into the onboarding assistant. Add a real lead to verify channels."
          >
            <Send className="size-4" /> Send test
          </Button>
        </div>
        <ul className="divide-y divide-[#23252A]">
          {notifications.length > 0 ? (
            notifications.map((n) => (
              <li key={n.id} className="grid grid-cols-[36px_minmax(0,1.5fr)_minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-3 text-sm">
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg border",
                    n.channel === "Email"
                      ? "border-[#5E6AD2]/30 bg-[#5E6AD2]/10 text-[#5E6AD2]"
                      : "border-[#E2E54B]/30 bg-[#E2E54B]/10 text-[#E2E54B]",
                  )}
                >
                  {n.channel === "Email" ? <Mail className="size-4" /> : <Smartphone className="size-4" />}
                </span>
                <div>
                  <p className="font-semibold text-[#F7F8F8]">{n.leadName}</p>
                  <p className="text-xs text-[#8A8F98]">→ {n.recipient}</p>
                </div>
                <span className="text-xs text-[#8A8F98]">{n.channel}</span>
                <span className="text-xs text-[#62666D]">{n.sentAt}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                    n.status === "delivered"
                      ? "border-[#4CB782]/30 bg-[#4CB782]/10 text-[#4CB782]"
                      : n.status === "pending"
                        ? "border-[#E2E54B]/30 bg-[#E2E54B]/10 text-[#E2E54B]"
                        : "border-[#EB5757]/30 bg-[#EB5757]/10 text-[#EB5757]",
                  )}
                >
                  {n.status === "delivered" ? (
                    <CheckCircle2 className="size-2.5" />
                  ) : n.status === "pending" ? (
                    <Phone className="size-2.5" />
                  ) : (
                    <XCircle className="size-2.5" />
                  )}
                  {n.status}
                </span>
              </li>
            ))
          ) : (
            <li className="p-5 text-center text-xs text-[#8A8F98]">
              No recent notifications
            </li>
          )}
        </ul>
      </div>
    </>
  )
}

function ChannelRowEditor({
  id,
  icon: Icon,
  label,
  description,
  on,
  recipients,
  draft,
  onDraftChange,
  busy,
  onToggle,
  onAdd,
  onRemove,
}: {
  id: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  on: boolean
  recipients: string[]
  draft: string
  onDraftChange: (v: string) => void
  busy: boolean
  onToggle: (v: boolean) => void
  onAdd: () => void
  onRemove: (r: string) => void
}) {
  void id
  return (
    <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg border border-[#23252A] bg-[#0B0C0E] text-[#8A8F98]">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#F7F8F8]">{label}</p>
          <p className="text-xs text-[#8A8F98]">{description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {recipients.length === 0 ? (
              <span className="text-[10px] text-[#62666D]">No recipients yet</span>
            ) : null}
            {recipients.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1 rounded-md border border-[#23252A] bg-[#0B0C0E] px-1.5 py-0.5 text-[10px] font-mono text-[#8A8F98]"
              >
                {r}
                <button
                  type="button"
                  onClick={() => onRemove(r)}
                  aria-label={`Remove ${r}`}
                  className="text-[#62666D] hover:text-[#EB5757]"
                >
                  <XCircle className="size-2.5" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <Input
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    onAdd()
                  }
                }}
                placeholder="email or phone"
                className="h-7 w-40 text-[10px]"
                disabled={busy}
              />
              <button
                type="button"
                onClick={onAdd}
                disabled={busy || !draft.trim()}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-[#23252A] px-1.5 py-0.5 text-[10px] font-semibold text-[#8A8F98] hover:text-[#F7F8F8] disabled:opacity-50"
              >
                <Plus className="size-2.5" /> Add
              </button>
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onToggle(!on)}
        disabled={busy}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border transition disabled:opacity-60",
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
    </div>
  )
}

function IntegrationsSection() {
  const [integrations, setIntegrations] = React.useState<IntegrationConfig[]>([])

  React.useEffect(() => {
    getIntegrations()
      .then((rows) => setIntegrations(rows))
      .catch(() => {})
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-[#23252A] bg-[#121316]">
        <div className="border-b border-[#23252A] p-5">
          <h2 className="text-base font-semibold text-[#F7F8F8]">Integrations</h2>
          <p className="mt-0.5 text-xs text-[#8A8F98]">
            Connect external services to your workspace.
          </p>
        </div>
        {integrations.length > 0 ? (
          <ul className="divide-y divide-[#23252A]">
          {integrations.map((i) => (
            <li
              key={i.id}
              className="flex flex-wrap items-center justify-between gap-3 p-5"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl border border-[#23252A] bg-[#0B0C0E] text-lg">
                  {i.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#F7F8F8]">{i.name}</p>
                  <p className="text-xs text-[#8A8F98]">{i.description}</p>
                </div>
              </div>
              {i.status === "connected" ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-[#4CB782]/30 bg-[#4CB782]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#4CB782]">
                  <CheckCircle2 className="size-2.5" /> Connected
                </span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    toast.info(`${i.name} is coming soon`)
                  }}
                >
                  Connect
                </Button>
              )}
            </li>
          ))}
        </ul>
        ) : (
          <div className="p-5 text-center text-xs text-[#8A8F98]">
            No integrations available yet.
          </div>
        )}
      </div>
      <React.Suspense
        fallback={
          <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5 text-xs text-[#8A8F98]">
            Loading calendar settings…
          </div>
        }
      >
        <CustomCalendarSettings />
      </React.Suspense>
    </div>
  )
}

function PrivacySection() {
  return (
    <>
      <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-[#4CB782]" />
          <h2 className="text-base font-semibold text-[#F7F8F8]">Privacy & compliance</h2>
        </div>
        <p className="mt-1 text-xs text-[#8A8F98]">
          AivaSpa is HIPAA-aware. PII is encrypted in transit (TLS) and at rest.
        </p>
        <ul className="mt-5 space-y-3 text-sm">
          {[
            { label: "Encrypted in transit (TLS 1.3)", enabled: true },
            { label: "Encrypted at rest (AES-256)", enabled: true },
            { label: "Role-based access control", enabled: true },
            { label: "Audit log of conversations", enabled: true },
            { label: "Configurable retention window", enabled: true },
            { label: "GDPR data deletion request", enabled: true },
            { label: "HIPAA-grade hosting (BAA)", enabled: false },
          ].map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between rounded-xl border border-[#23252A] bg-[#0B0C0E] px-3 py-2.5"
            >
              <span className="text-[#F7F8F8]">{row.label}</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  row.enabled
                    ? "border-[#4CB782]/30 bg-[#4CB782]/10 text-[#4CB782]"
                    : "border-[#62666D]/30 bg-[#62666D]/10 text-[#8A8F98]",
                )}
              >
                {row.enabled ? "On" : "Add-on"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
        <h2 className="text-base font-semibold text-[#F7F8F8]">Data retention</h2>
        <p className="mt-0.5 text-xs text-[#8A8F98]">
          How long we keep your leads and conversations.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#62666D]">
              Leads
            </p>
            <p className="mt-1 text-2xl font-bold text-[#F7F8F8]">24 months</p>
            <p className="text-[10px] text-[#8A8F98]">Then auto-anonymized</p>
          </div>
          <div className="rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#62666D]">
              Conversations
            </p>
            <p className="mt-1 text-2xl font-bold text-[#F7F8F8]">12 months</p>
            <p className="text-[10px] text-[#8A8F98]">Then auto-archived</p>
          </div>
        </div>
      </div>
    </>
  )
}

function BillingSection({ billing }: { billing: BillingViewProps }) {
  return <BillingView {...billing} />
}
