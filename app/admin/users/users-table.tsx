"use client"

import * as React from "react"
import { MoreHorizontal, Shield, ShieldOff, Trash2, Ban, ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { StatusPill } from "@/components/admin/status-pill"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  banUserAction,
  unbanUserAction,
  deleteUserAction,
  setAdminFlagAction,
} from "@/app/actions/admin-users"

export type UserRow = {
  id: string
  email: string | null
  createdAt: string
  lastSignInAt: string | null
  appMetadata: Record<string, unknown>
  userMetadata: Record<string, unknown>
  isAdmin: boolean
  banned: boolean
  bannedAt: string | null
  banReason: string | null
}

type ActionKind = "ban" | "unban" | "delete" | "promote" | "demote" | null

export function UsersTable({
  rows,
  currentAdminId,
  pageSize = 50,
  empty = "No users yet.",
}: {
  rows: UserRow[]
  currentAdminId: string
  pageSize?: number
  empty?: React.ReactNode
}) {
  const [pending, setPending] = React.useState<UserRow | null>(null)
  const [action, setAction] = React.useState<ActionKind>(null)
  const [reason, setReason] = React.useState("")
  const [confirmText, setConfirmText] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const router = useRouter()

  const close = React.useCallback(() => {
    if (submitting) return
    setPending(null)
    setAction(null)
    setReason("")
    setConfirmText("")
  }, [submitting])

  const open = (row: UserRow, kind: Exclude<ActionKind, null>) => {
    setPending(row)
    setAction(kind)
    setReason("")
    setConfirmText("")
  }

  const submit = async () => {
    if (!pending || !action) return
    setSubmitting(true)
    try {
      let res
      if (action === "ban") res = await banUserAction(pending.id, reason)
      else if (action === "unban") res = await unbanUserAction(pending.id)
      else if (action === "delete") res = await deleteUserAction(pending.id)
      else if (action === "promote") res = await setAdminFlagAction(pending.id, true)
      else if (action === "demote") res = await setAdminFlagAction(pending.id, false)
      else res = { ok: false as const, error: "Unknown action" }

      if (res.ok) {
        const labels: Record<Exclude<ActionKind, null>, string> = {
          ban: "User banned",
          unban: "User unbanned",
          delete: "User deleted",
          promote: "Admin granted",
          demote: "Admin revoked",
        }
        toast.success(labels[action])
        setPending(null)
        setAction(null)
        setReason("")
        setConfirmText("")
        router.refresh()
      } else {
        toast.error(res.error)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed")
    } finally {
      setSubmitting(false)
    }
  }

  const columns: DataTableColumn<UserRow>[] = [
    {
      key: "email",
      header: "Email",
      render: (r) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs">{r.email ?? "—"}</span>
          {r.isAdmin ? <StatusPill status="info" label="admin" /> : null}
          {r.banned ? <StatusPill status="error" label="banned" /> : null}
          {r.id === currentAdminId ? (
            <StatusPill status="muted" label="you" />
          ) : null}
        </div>
      ),
    },
    {
      key: "id",
      header: "User id",
      render: (r) => (
        <span className="font-mono text-[10px] text-[#8A8F98]">{r.id.slice(0, 8)}…</span>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (r) => (
        <span className="text-[#8A8F98]">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "last",
      header: "Last sign-in",
      render: (r) => (
        <span className="text-[#8A8F98]">
          {r.lastSignInAt
            ? new Date(r.lastSignInAt).toLocaleString()
            : "Never"}
        </span>
      ),
    },
    {
      key: "onboarding",
      header: "Onboarding state",
      render: (r) => {
        const meta = r.userMetadata as { onboarding_setup_section?: string; spa_name?: string }
        if (meta.onboarding_setup_section) {
          return (
            <span className="text-[#8A8F98]">
              {meta.spa_name ? `${meta.spa_name} · ` : ""}
              {meta.onboarding_setup_section}
            </span>
          )
        }
        if (meta.spa_name) {
          return <span className="text-[#8A8F98]">{meta.spa_name}</span>
        }
        return <span className="text-[10px] text-[#62666D]">—</span>
      },
    },
    {
      key: "actions",
      header: "",
      className: "w-10 text-right",
      render: (r) => {
        const isSelf = r.id === currentAdminId
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="size-7 text-[#8A8F98] hover:text-[#F7F8F8]"
                  aria-label={`Actions for ${r.email ?? r.id}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{r.email ?? r.id}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {r.banned ? (
                  <DropdownMenuItem
                    disabled={isSelf}
                    onSelect={() => open(r, "unban")}
                  >
                    <ShieldCheck className="size-4 text-[#4CB782]" /> Unban user
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    disabled={isSelf}
                    onSelect={() => open(r, "ban")}
                    variant="destructive"
                  >
                    <Ban className="size-4" /> Ban user
                  </DropdownMenuItem>
                )}
                {r.isAdmin ? (
                  <DropdownMenuItem
                    disabled={isSelf}
                    onSelect={() => open(r, "demote")}
                  >
                    <ShieldOff className="size-4" /> Revoke admin
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    disabled={isSelf}
                    onSelect={() => open(r, "promote")}
                  >
                    <Shield className="size-4" /> Grant admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isSelf}
                  onSelect={() => open(r, "delete")}
                  variant="destructive"
                >
                  <Trash2 className="size-4" /> Delete account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        pageSize={pageSize}
        search={(r, t) =>
          (r.email ?? "").toLowerCase().includes(t.toLowerCase()) ||
          r.id.toLowerCase().includes(t.toLowerCase())
        }
        empty={empty}
      />
      <ConfirmDialog
        row={pending}
        action={action}
        reason={reason}
        setReason={setReason}
        confirmText={confirmText}
        setConfirmText={setConfirmText}
        submitting={submitting}
        onCancel={close}
        onConfirm={submit}
      />
    </>
  )
}

function ConfirmDialog({
  row,
  action,
  reason,
  setReason,
  confirmText,
  setConfirmText,
  submitting,
  onCancel,
  onConfirm,
}: {
  row: UserRow | null
  action: ActionKind
  reason: string
  setReason: (v: string) => void
  confirmText: string
  setConfirmText: (v: string) => void
  submitting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const open = Boolean(row && action)
  if (!row || !action) return null

  const isDestructive = action === "ban" || action === "delete" || action === "demote"
  const needsReason = action === "ban"
  const needsConfirmPhrase = action === "delete"
  const confirmPhrase = row.email ?? row.id

  const canSubmit = (() => {
    if (submitting) return false
    if (needsConfirmPhrase && confirmText.trim() !== confirmPhrase) return false
    return true
  })()

  const titles: Record<Exclude<ActionKind, null>, string> = {
    ban: `Ban ${row.email ?? row.id}?`,
    unban: `Unban ${row.email ?? row.id}?`,
    delete: `Delete ${row.email ?? row.id}?`,
    promote: `Grant admin to ${row.email ?? row.id}?`,
    demote: `Revoke admin from ${row.email ?? row.id}?`,
  }
  const descriptions: Record<Exclude<ActionKind, null>, string> = {
    ban: "They will be signed out immediately and blocked from signing in. They keep their data but lose access to the dashboard and widget.",
    unban: "They will be able to sign in again on their next request.",
    delete:
      "This permanently deletes the auth user and all sessions. Their leads, KB, and subscriptions are kept but become orphaned. This cannot be undone.",
    promote: "This email must be in the admin allowlist. After promoting, sign them out so the new JWT takes effect.",
    demote: "They will lose access to the admin panel on their next request. Refused if they are the last admin in the allowlist.",
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className={cn("sm:max-w-md")}>
        <DialogHeader>
          <DialogTitle>{titles[action]}</DialogTitle>
          <DialogDescription>{descriptions[action]}</DialogDescription>
        </DialogHeader>

        {needsReason ? (
          <div className="space-y-1.5">
            <Label htmlFor="ban-reason">Reason (optional, ≤ 500 chars)</Label>
            <Textarea
              id="ban-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="e.g. abuse, spam, terms violation…"
              className="min-h-20"
            />
            <p className="text-[10px] text-[#62666D]">
              Recorded in the admin audit log and shown on the user&apos;s row.
            </p>
          </div>
        ) : null}

        {needsConfirmPhrase ? (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-phrase">
              Type <span className="font-mono">{confirmPhrase}</span> to confirm
            </Label>
            <Input
              id="confirm-phrase"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isDestructive ? "destructive" : "default"}
            disabled={!canSubmit}
            onClick={onConfirm}
            className={cn(
              !isDestructive &&
                "bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90",
            )}
          >
            {submitting ? "Working…" : confirmLabel(action)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function confirmLabel(action: Exclude<ActionKind, null>): string {
  switch (action) {
    case "ban":
      return "Ban user"
    case "unban":
      return "Unban user"
    case "delete":
      return "Delete account"
    case "promote":
      return "Grant admin"
    case "demote":
      return "Revoke admin"
  }
}
