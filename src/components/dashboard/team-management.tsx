"use client"

import * as React from "react"
import {
  CheckCircle2,
  Copy,
  Mail,
  Plus,
  Send,
  Shield,
  ShieldCheck,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TeamMember, TeamRole } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"
import { useRealtimeSubscription } from "@/lib/hooks/use-realtime"
import { teamRoleInfo, rolePermissions } from "@/lib/db/team"
import { getAuditLogs } from "@/lib/db/settings"
import type { AuditLog } from "@/lib/supabase/types"
import { inviteTeamMemberAction, updateTeamMemberRoleAction, removeTeamMemberAction } from "@/app/actions/team"
import { toast } from "sonner"

export function TeamManagement() {
  const { data: teamMembers } = useRealtimeSubscription<TeamMember>({
    table: "team_members",
    initialData: [],
    getId: (item) => item.id,
  })

  const [auditLogs, setAuditLogs] = React.useState<AuditLog[]>([])
  const [openInvite, setOpenInvite] = React.useState(false)

  React.useEffect(() => {
    getAuditLogs().then(setAuditLogs).catch(() => {})
  }, [])

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-2xl border border-[#23252A] bg-[#121316]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#23252A] p-5">
          <div>
            <h2 className="text-base font-semibold text-[#F7F8F8]">Team members</h2>
            <p className="mt-0.5 text-xs text-[#8A8F98]">
              {teamMembers.length} members · {teamMembers.filter((m) => m.status === "active").length} active
            </p>
          </div>
          <Button
            size="sm"
            className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
            onClick={() => setOpenInvite(true)}
          >
            <Plus className="size-4" /> Invite member
          </Button>
        </div>
        <ul className="divide-y divide-[#23252A]">
          {teamMembers.map((member) => (
            <li
              key={member.id}
              className="grid grid-cols-1 gap-3 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[#08090A]"
                  style={{ background: member.avatarColor }}
                >
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#F7F8F8]">{member.name}</p>
                    <span
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        member.role === "Owner"
                          ? "border-[#E2E54B]/30 bg-[#E2E54B]/10 text-[#E2E54B]"
                          : "border-[#5E6AD2]/30 bg-[#5E6AD2]/10 text-[#8B95E0]",
                      )}
                    >
                      {member.role}
                    </span>
                    <span
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        member.status === "active"
                          ? "border-[#4CB782]/30 bg-[#4CB782]/10 text-[#4CB782]"
                          : member.status === "invited"
                            ? "border-[#62666D]/30 bg-[#62666D]/10 text-[#8A8F98]"
                            : "border-[#EB5757]/30 bg-[#EB5757]/10 text-[#EB5757]",
                      )}
                    >
                      {member.status === "active" ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="size-2.5" /> Active
                        </span>
                      ) : member.status === "invited" ? (
                        <span className="flex items-center gap-1">
                          <Mail className="size-2.5" /> Invited
                        </span>
                      ) : (
                        "Suspended"
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-[#8A8F98]">
                    {member.email}
                    {member.phone ? ` · ${member.phone}` : ""} · Last active {member.lastActiveAt ?? "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 md:flex-col md:items-end">
                <Select
                  defaultValue={member.role}
                  disabled={member.role === "Owner"}
                  onValueChange={async (v) => {
                    const result = await updateTeamMemberRoleAction(member.id, v as TeamRole)
                    if (result.ok) {
                      toast.success(`Role updated to ${v}`)
                    } else {
                      toast.error(result.error ?? "Failed to update role")
                    }
                  }}
                >
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {teamRoleInfo.map((r) => (
                      <SelectItem key={r.v} value={r.v}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove"
                    disabled={member.role === "Owner"}
                    onClick={async () => {
                      if (!confirm(`Remove ${member.name} from the team?`)) return
                      const result = await removeTeamMemberAction(member.id)
                      if (result.ok) {
                        toast.success("Removed")
                      } else {
                        toast.error(result.error ?? "Failed")
                      }
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <aside className="flex flex-col gap-5">
        <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-[#5E6AD2]" />
            <h2 className="text-sm font-semibold text-[#F7F8F8]">Roles & permissions</h2>
          </div>
          <p className="mt-1 text-xs text-[#8A8F98]">
            Each role controls what members can see and do in the dashboard.
          </p>
          <div className="mt-4 space-y-3">
            {teamRoleInfo.map((role) => (
              <div
                key={role.v}
                className="rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#F7F8F8]">{role.label}</p>
                  <span className="rounded-md border border-[#23252A] bg-[#121316] px-1.5 py-0.5 text-[10px] font-mono text-[#8A8F98]">
                    {teamMembers.filter((m) => m.role === role.v).length}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[#8A8F98]">{role.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {rolePermissions[role.v].map((p) => (
                    <span
                      key={p}
                      className="rounded-md border border-[#23252A] bg-[#121316] px-1.5 py-0.5 text-[9px] font-semibold text-[#8A8F98]"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#4CB782]" />
            <h2 className="text-sm font-semibold text-[#F7F8F8]">Audit log</h2>
          </div>
          <p className="mt-1 text-xs text-[#8A8F98]">
            Every action is recorded for compliance.
          </p>
          <ul className="mt-4 space-y-2.5 text-xs">
            {auditLogs.length > 0 ? (
              auditLogs.map((entry) => (
                <li
                  key={entry.id}
                  className="min-w-0 rounded-lg border border-[#23252A] bg-[#0B0C0E] p-2.5"
                >
                  <p className="break-words text-[#F7F8F8]">
                    <span className="font-semibold">{entry.userName}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 break-words text-[#8A8F98]">
                    {entry.action}
                  </p>
                  <p className="mt-1 text-[10px] text-[#62666D]">
                    {formatAuditTimestamp(entry.createdAt)}
                  </p>
                </li>
              ))
            ) : (
              <li className="rounded-lg border border-dashed border-[#23252A] bg-[#0B0C0E] p-3 text-center text-[#8A8F98]">
                No audit entries yet
              </li>
            )}
          </ul>
        </div>
      </aside>

      {openInvite ? <InviteDialog onClose={() => setOpenInvite(false)} /> : null}
    </div>
  )
}

function formatAuditTimestamp(value: string): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = React.useState("")
  const [name, setName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [role, setRole] = React.useState<TeamRole>("Staff")
  const [sending, setSending] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [link, setLink] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  const send = async () => {
    if (!email) {
      setError("Email is required")
      return
    }
    setSending(true)
    setError(null)
    const result = await inviteTeamMemberAction({
      email,
      name: name || undefined,
      role,
      phone: phone || undefined,
    })
    setSending(false)
    if (result.ok) {
      setSent(true)
      setLink(result.data.inviteUrl)
      toast.success("Invite created")
    } else {
      setError(result.error ?? "Failed to send invite")
      toast.error(result.error ?? "Failed to send invite")
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#23252A] bg-[#121316] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#F7F8F8]">Invite team member</h2>
            <p className="mt-0.5 text-xs text-[#8A8F98]">
              They&apos;ll get an email with a sign-up link.
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        {sent ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-[#4CB782]/30 bg-[#4CB782]/10 p-3 text-xs text-[#4CB782]">
              <CheckCircle2 className="size-4" />
              <p className="font-semibold">Invite created for {email}</p>
            </div>
            <div className="rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#62666D]">
                Share this link
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded-md border border-[#23252A] bg-[#121316] px-2 py-1.5 text-[11px] text-[#F7F8F8]">
                  {link}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard?.writeText(link)
                    toast.success("Copied")
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
            <Button
              size="sm"
              className="w-full bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@spa.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">
                  Name (optional)
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jamie Lee"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">
                  Phone (optional)
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(415) 555-0100"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">
                Role
              </label>
              <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teamRoleInfo
                    .filter((r) => r.v !== "Owner")
                    .map((r) => (
                      <SelectItem key={r.v} value={r.v}>
                        {r.label} — {r.description}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {error ? <p className="text-[11px] text-[#EB5757]">{error}</p> : null}
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
                onClick={send}
                disabled={sending}
              >
                {sending ? (
                  <>Sending…</>
                ) : (
                  <><Send className="size-4" /> Send invite</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
