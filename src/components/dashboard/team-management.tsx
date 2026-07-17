"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  CreditCard,
  History,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  RotateCw,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"

import {
  copyTeamInvitationLinkAction,
  getTeamAuditPageAction,
  inviteTeamMemberAction,
  removeTeamMemberAction,
  resendTeamInvitationAction,
  revokeTeamInvitationAction,
  updateTeamInvitationRoleAction,
  updateTeamMemberRoleAction,
} from "@/app/actions/team"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AuditLog, TeamInvitation, TeamMember, TeamRole } from "@/lib/supabase/types"
import { formatAuditEvent, type AuditCategory } from "@/lib/team/audit"
import { PERMISSION_LABELS, ROLE_PERMISSIONS, TEAM_ROLE_INFO } from "@/lib/team/permissions"
import { cn } from "@/lib/utils"

type Diagnostic = {
  enabled: boolean
  apiKeyPresent: boolean
  fromEmailPresent: boolean
  appUrlPresent: boolean
  senderDomain: string | null
  senderLooksProductionReady: boolean
}

export function TeamManagement({
  members,
  invitations,
  diagnostic,
}: {
  members: TeamMember[]
  invitations: TeamInvitation[]
  currentRole: "Owner" | "Manager"
  diagnostic: Diagnostic
}) {
  const router = useRouter()
  const [openInvite, setOpenInvite] = React.useState(false)
  const activeMembers = members.filter((member) => member.status === "active")

  const refresh = React.useCallback(() => router.refresh(), [router])

  return (
    <div className="space-y-6">
      {diagnostic.enabled && (!diagnostic.apiKeyPresent || !diagnostic.fromEmailPresent || !diagnostic.appUrlPresent || !diagnostic.senderLooksProductionReady) ? (
        <div className="rounded-xl border border-[#FB923C]/30 bg-[#FB923C]/10 px-4 py-3 text-sm text-[#F5B46B]">
          Invite email diagnostics found an incomplete Resend setup. Check the API key, verified sender, and application URL before inviting staff.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-[#23252A] bg-[#121316]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#23252A] p-5">
            <div>
              <h2 className="text-base font-semibold text-[#F7F8F8]">Team members</h2>
              <p className="mt-0.5 text-xs text-[#8A8F98]">
                {activeMembers.length} active · {invitations.length} pending
              </p>
            </div>
            <Button size="sm" className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90" onClick={() => setOpenInvite(true)}>
              <Plus className="size-4" /> Invite member
            </Button>
          </div>

          <div>
            <div className="border-b border-[#23252A] px-5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">Active members</p>
            </div>
            {activeMembers.length ? (
              <ul className="divide-y divide-[#23252A]">
                {activeMembers.map((member) => (
                  <MemberRow key={member.id} member={member} onChanged={refresh} />
                ))}
              </ul>
            ) : (
              <EmptyTeamState />
            )}
          </div>

          <div className="border-t border-[#23252A]">
            <div className="flex items-center justify-between border-b border-[#23252A] px-5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">Pending invitations</p>
              <span className="rounded-md border border-[#23252A] px-2 py-0.5 text-[10px] text-[#8A8F98]">{invitations.length}</span>
            </div>
            {invitations.length ? (
              <ul className="divide-y divide-[#23252A]">
                {invitations.map((invitation) => (
                  <InvitationRow key={invitation.id} invitation={invitation} onChanged={refresh} />
                ))}
              </ul>
            ) : (
              <div className="px-5 py-8 text-center">
                <Mail className="mx-auto size-5 text-[#62666D]" />
                <p className="mt-2 text-sm font-medium text-[#F7F8F8]">No pending invitations</p>
                <p className="mt-1 text-xs text-[#8A8F98]">New invitations will appear here until they are accepted.</p>
              </div>
            )}
          </div>
        </section>

        <RolesPermissionsPanel members={activeMembers} />
      </div>

      <AuditLogPanel />

      {openInvite ? <InviteDialog onClose={() => setOpenInvite(false)} onCreated={refresh} /> : null}
    </div>
  )
}

function MemberRow({ member, onChanged }: { member: TeamMember; onChanged: () => void }) {
  const [busy, setBusy] = React.useState(false)
  const isOwner = member.role === "Owner"

  return (
    <li className="grid min-w-0 grid-cols-1 gap-3 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[#08090A]" style={{ background: member.avatarColor }}>
          {initials(member.name)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-[#F7F8F8]">{member.name}</p>
            <RoleBadge role={member.role} />
            <span className="flex items-center gap-1 rounded-md border border-[#4CB782]/30 bg-[#4CB782]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#4CB782]">
              <CheckCircle2 className="size-2.5" /> Active
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-[#8A8F98]">{member.email || "No email available"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={member.role}
          disabled={isOwner || busy}
          onValueChange={async (value) => {
            setBusy(true)
            const result = await updateTeamMemberRoleAction(member.id, value as TeamRole)
            setBusy(false)
            if (result.ok) {
              toast.success("Role updated")
              onChanged()
            } else toast.error(result.error)
          }}
        >
          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TEAM_ROLE_INFO.filter((role) => role.value !== "Owner").map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={"Remove " + member.name}
          disabled={isOwner || busy}
          onClick={async () => {
            if (!window.confirm("Remove " + member.name + " from the team?")) return
            setBusy(true)
            const result = await removeTeamMemberAction(member.id)
            setBusy(false)
            if (result.ok) {
              toast.success("Team member removed")
              onChanged()
            } else toast.error(result.error)
          }}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </div>
    </li>
  )
}

function InvitationRow({ invitation, onChanged }: { invitation: TeamInvitation; onChanged: () => void }) {
  const [busy, setBusy] = React.useState<string | null>(null)
  const expiry = formatDate(invitation.expiresAt)

  async function run(key: string, action: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, success: string) {
    if (busy) return
    setBusy(key)
    const result = await action()
    setBusy(null)
    if (result.ok) {
      toast.success(success)
      onChanged()
    } else toast.error(result.error || "Action failed")
    return result
  }

  return (
    <li className="grid min-w-0 grid-cols-1 gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-[#F7F8F8]">{invitation.name || invitation.email}</p>
          <RoleBadge role={invitation.role} />
          <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", invitation.deliveryStatus === "sent" ? "border-[#4CB782]/30 bg-[#4CB782]/10 text-[#4CB782]" : invitation.deliveryStatus === "failed" ? "border-[#EB5757]/30 bg-[#EB5757]/10 text-[#EB5757]" : "border-[#FB923C]/30 bg-[#FB923C]/10 text-[#FB923C]")}>
            {invitation.deliveryStatus}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-[#8A8F98]">{invitation.email}</p>
        <p className="mt-1 text-[11px] text-[#62666D]">Invited {formatDate(invitation.createdAt)} · expires {expiry}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={invitation.role}
          disabled={Boolean(busy)}
          onValueChange={(value) => run("role", () => updateTeamInvitationRoleAction(invitation.id, value as TeamRole), "Invitation role updated")}
        >
          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TEAM_ROLE_INFO.filter((role) => role.value !== "Owner").map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => run("resend", () => resendTeamInvitationAction(invitation.id), "Invitation resent to " + invitation.email)}>
          {busy === "resend" ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />} Resend
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={Boolean(busy)}
          onClick={async () => {
            const result = await run("copy", () => copyTeamInvitationLinkAction(invitation.id), "Fresh invitation link created")
            if (result?.ok && result.data && typeof result.data === "object" && "inviteUrl" in result.data) {
              await navigator.clipboard.writeText(String((result.data as { inviteUrl: string }).inviteUrl))
              toast.success("Invitation link copied")
            }
          }}
        >
          {busy === "copy" ? <Loader2 className="size-3.5 animate-spin" /> : <Clipboard className="size-3.5" />} Copy link
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-[#EB5757] hover:text-[#EB5757]"
          disabled={Boolean(busy)}
          onClick={() => {
            if (window.confirm("Revoke the invitation for " + invitation.email + "?")) run("revoke", () => revokeTeamInvitationAction(invitation.id), "Invitation revoked")
          }}
        >
          {busy === "revoke" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} Revoke
        </Button>
      </div>
    </li>
  )
}

function RolesPermissionsPanel({ members }: { members: TeamMember[] }) {
  return (
    <aside className="min-w-0 rounded-2xl border border-[#23252A] bg-[#121316] p-5">
      <div className="flex items-center gap-2">
        <Shield className="size-4 text-[#5E6AD2]" />
        <h2 className="text-sm font-semibold text-[#F7F8F8]">Roles & permissions</h2>
      </div>
      <p className="mt-1 text-xs leading-5 text-[#8A8F98]">One permission map controls what each role can manage.</p>
      <div className="mt-4 space-y-3">
        {TEAM_ROLE_INFO.map((role) => (
          <div key={role.value} className="rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#F7F8F8]">{role.label}</p>
              <span className="rounded-md border border-[#23252A] bg-[#121316] px-1.5 py-0.5 font-mono text-[10px] text-[#8A8F98]">{members.filter((member) => member.role === role.value).length}</span>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-[#8A8F98]">{role.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {ROLE_PERMISSIONS[role.value].map((permission) => (
                <span key={permission} className="rounded-md border border-[#23252A] bg-[#121316] px-1.5 py-0.5 text-[9px] font-semibold text-[#8A8F98]">{PERMISSION_LABELS[permission]}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

const FILTERS: { value: AuditCategory; label: string }[] = [
  { value: "all", label: "All activity" },
  { value: "team", label: "Team" },
  { value: "billing", label: "Billing" },
  { value: "security", label: "Security" },
  { value: "settings", label: "Settings" },
]

function AuditLogPanel() {
  const [category, setCategory] = React.useState<AuditCategory>("all")
  const [entries, setEntries] = React.useState<AuditLog[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [hasMore, setHasMore] = React.useState(false)

  const load = React.useCallback(async (append: boolean) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError(null)
    const offset = append ? entries.length : 0
    const result = await getTeamAuditPageAction(category, offset)
    if (result.ok) {
      setEntries((current) => append ? [...current, ...result.data.entries] : result.data.entries)
      setHasMore(result.data.hasMore)
    } else {
      setError("We couldn't load the audit log.")
      if (!append) setEntries([])
    }
    setLoading(false)
    setLoadingMore(false)
  }, [category, entries.length])

  React.useEffect(() => {
    let active = true
    void getTeamAuditPageAction(category, 0).then((result) => {
      if (!active) return
      if (result.ok) {
        setEntries(result.data.entries)
        setHasMore(result.data.hasMore)
        setError(null)
      } else {
        setEntries([])
        setError("We couldn't load the audit log.")
      }
      setLoading(false)
    })
    return () => { active = false }
  }, [category])

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[#23252A] bg-[#121316]">
      <div className="flex flex-col gap-4 border-b border-[#23252A] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#4CB782]" />
            <h2 className="text-base font-semibold text-[#F7F8F8]">Audit log</h2>
          </div>
          <p className="mt-1 text-xs text-[#8A8F98]">Readable workspace activity for compliance and accountability.</p>
        </div>
        <Select value={category} onValueChange={(value) => { setLoading(true); setCategory(value as AuditCategory) }}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{FILTERS.map((filter) => <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="divide-y divide-[#23252A]">{Array.from({ length: 4 }).map((_, index) => <AuditSkeleton key={index} />)}</div>
      ) : error ? (
        <div className="flex flex-col items-center px-5 py-12 text-center">
          <AlertCircle className="size-6 text-[#EB5757]" />
          <p className="mt-3 text-sm font-semibold text-[#F7F8F8]">We couldn&apos;t load the audit log.</p>
          <Button className="mt-4" size="sm" variant="outline" onClick={() => void load(false)}><RefreshCw className="size-4" /> Retry</Button>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-12 text-center">
          <History className="size-6 text-[#62666D]" />
          <p className="mt-3 text-sm font-semibold text-[#F7F8F8]">No team activity yet.</p>
          <p className="mt-1 text-xs text-[#8A8F98]">Invitations and role changes will appear here.</p>
        </div>
      ) : (
        <>
          <div className="hidden grid-cols-[170px_150px_minmax(220px,1fr)_160px_100px] gap-4 border-b border-[#23252A] px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#62666D] lg:grid">
            <span>Date & time</span><span>Actor</span><span>Action</span><span>Target</span><span>Status</span>
          </div>
          <ul className="divide-y divide-[#23252A]">
            {entries.map((entry) => <AuditRow key={entry.id} entry={entry} />)}
          </ul>
          {hasMore ? (
            <div className="border-t border-[#23252A] p-4 text-center">
              <Button size="sm" variant="outline" disabled={loadingMore} onClick={() => void load(true)}>
                {loadingMore ? <Loader2 className="size-4 animate-spin" /> : <History className="size-4" />} Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

function AuditRow({ entry }: { entry: AuditLog }) {
  const event = formatAuditEvent(entry)
  const Icon = event.category === "team" ? Users : event.category === "billing" ? CreditCard : event.category === "security" ? Shield : Settings
  return (
    <li className="grid min-w-0 grid-cols-1 gap-3 px-5 py-4 lg:grid-cols-[170px_150px_minmax(220px,1fr)_160px_100px] lg:items-center lg:gap-4">
      <div title={formatExact(event.timestamp)} className="text-xs text-[#8A8F98]">{relativeTime(event.timestamp)}<span className="mt-0.5 block text-[10px] text-[#62666D]">{formatExact(event.timestamp)}</span></div>
      <div className="truncate text-xs font-medium text-[#F7F8F8]">{event.actor}</div>
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#23252A] bg-[#0B0C0E]"><Icon className="size-3.5 text-[#8B95E0]" /></span>
        <div className="min-w-0"><p className="text-sm font-semibold text-[#F7F8F8]">{event.title}</p><p className="mt-0.5 break-words text-xs leading-5 text-[#8A8F98]">{event.description}</p></div>
      </div>
      <div className="truncate text-xs text-[#8A8F98]" title={event.target}>{event.target}</div>
      <div><span className={cn("inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider", event.status === "failed" ? "border-[#EB5757]/30 bg-[#EB5757]/10 text-[#EB5757]" : event.status === "pending" ? "border-[#FB923C]/30 bg-[#FB923C]/10 text-[#FB923C]" : "border-[#4CB782]/30 bg-[#4CB782]/10 text-[#4CB782]")}>{event.status}</span></div>
    </li>
  )
}

function AuditSkeleton() {
  return <div className="grid animate-pulse grid-cols-1 gap-3 px-5 py-5 lg:grid-cols-[170px_150px_minmax(220px,1fr)_160px_100px]"><div className="h-4 rounded bg-[#23252A]" /><div className="h-4 rounded bg-[#23252A]" /><div className="h-10 rounded bg-[#23252A]" /><div className="h-4 rounded bg-[#23252A]" /><div className="h-5 rounded bg-[#23252A]" /></div>
}

function InviteDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = React.useState("")
  const [name, setName] = React.useState("")
  const [role, setRole] = React.useState<Exclude<TeamRole, "Owner">>("Staff")
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !sending) onClose() }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose, sending])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (sending) return
    setSending(true)
    setError(null)
    const result = await inviteTeamMemberAction({ email, name: name || undefined, role })
    setSending(false)
    if (result.ok) {
      toast.success("Invitation sent to " + email.trim().toLowerCase())
      onCreated()
      onClose()
    } else {
      setError(result.error)
      toast.error(result.error)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="invite-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) onClose() }}>
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-[#23252A] bg-[#121316] p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div><h2 id="invite-title" className="text-base font-semibold text-[#F7F8F8]">Invite team member</h2><p className="mt-1 text-xs text-[#8A8F98]">A secure link will be sent by email and expire after 7 days.</p></div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} disabled={sending} aria-label="Close"><X className="size-4" /></Button>
        </div>
        <div className="space-y-4">
          <label className="block space-y-1.5"><span className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">Email</span><Input autoFocus type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@spa.com" /></label>
          <label className="block space-y-1.5"><span className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">Name <span className="font-normal normal-case">(optional)</span></span><Input maxLength={100} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Jamie Lee" /></label>
          <label className="block space-y-1.5"><span className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">Role</span><Select value={role} onValueChange={(value) => setRole(value as Exclude<TeamRole, "Owner">)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{TEAM_ROLE_INFO.filter((item) => item.value !== "Owner").map((item) => <SelectItem key={item.value} value={item.value}>{item.label} — {item.description}</SelectItem>)}</SelectContent></Select></label>
          {error ? <div className="rounded-lg border border-[#EB5757]/30 bg-[#EB5757]/10 px-3 py-2 text-xs text-[#EB5757]">{error}</div> : null}
          <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={sending}>Cancel</Button><Button type="submit" size="sm" disabled={sending} className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90">{sending ? <><Loader2 className="size-4 animate-spin" /> Sending…</> : <><Send className="size-4" /> Send invite</>}</Button></div>
        </div>
      </form>
    </div>
  )
}

function EmptyTeamState() {
  return <div className="px-5 py-10 text-center"><UserRound className="mx-auto size-6 text-[#62666D]" /><p className="mt-3 text-sm font-semibold text-[#F7F8F8]">No active members</p><p className="mt-1 text-xs text-[#8A8F98]">Invite a teammate to collaborate.</p></div>
}

function RoleBadge({ role }: { role: TeamRole }) {
  return <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", role === "Owner" ? "border-[#E2E54B]/30 bg-[#E2E54B]/10 text-[#E2E54B]" : "border-[#5E6AD2]/30 bg-[#5E6AD2]/10 text-[#8B95E0]")}>{role}</span>
}

function initials(name: string) {
  return name.split(/s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "TM"
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function formatExact(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Timestamp unavailable" : date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function relativeTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown time"
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second")
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour")
  return formatter.format(Math.round(hours / 24), "day")
}
