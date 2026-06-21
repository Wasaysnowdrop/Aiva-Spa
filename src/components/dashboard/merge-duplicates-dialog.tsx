"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeftRight,
  CheckCircle2,
  Combine,
  Loader2,
  Mail,
  Phone,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LeadStatusBadge } from "@/components/dashboard/lead-status-badge"
import {
  mergeLeadsAction,
  type MergeFieldChoice,
} from "@/app/actions/leads"
import type { Lead, MergedLeadEntry } from "@/lib/supabase/types"
import { cn, formatDateTime, formatRelativeTime } from "@/lib/utils"

type MergeField = MergeFieldChoice["field"]

const MERGE_FIELDS: { key: MergeField; label: string; icon: React.ReactNode }[] = [
  { key: "name", label: "Name", icon: <Sparkles className="size-3" /> },
  { key: "phone", label: "Phone", icon: <Phone className="size-3" /> },
  { key: "email", label: "Email", icon: <Mail className="size-3" /> },
  { key: "service", label: "Service", icon: <Combine className="size-3" /> },
  { key: "preferredTime", label: "Preferred time", icon: <Sparkles className="size-3" /> },
  { key: "notes", label: "Notes", icon: <Sparkles className="size-3" /> },
]

function valueFor(lead: Lead, field: MergeField): string {
  switch (field) {
    case "name":
      return lead.name
    case "phone":
      return lead.phone
    case "email":
      return lead.email
    case "service":
      return lead.service
    case "preferredTime":
      return lead.preferredTime
    case "notes":
      return lead.notes ?? ""
  }
}

function buildInitialChoices(primary: Lead, others: Lead[]): Record<MergeField, string> {
  const all = [primary, ...others]
  const out = {} as Record<MergeField, string>
  for (const f of MERGE_FIELDS) {
    const pick = all.find((l) => valueFor(l, f.key)) ?? primary
    out[f.key] = pick.id
  }
  return out
}

export type Candidate = {
  lead: Lead
  matchType: "phone" | "email" | "manual"
}

export function MergeDuplicatesDialog({
  open,
  onOpenChange,
  primary,
  candidates,
  onMerged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  primary: Lead | null
  candidates: Candidate[]
  onMerged?: (result: { primary: Lead; merged: Lead[] }) => void
}) {
  const safePrimary: Lead | null = primary?.id ? primary : null

  if (!safePrimary) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Combine className="size-4 text-[#E2E54B]" />
              Merge duplicates
            </DialogTitle>
            <DialogDescription>
              No leads are available to merge yet. Capture a lead first, then
              come back here to combine duplicates.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // The `key` forces a remount of the body whenever the primary changes or
  // the dialog reopens, so internal form state resets without an effect.
  const bodyKey = `${safePrimary.id}:${open ? "1" : "0"}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogBody
          key={bodyKey}
          primary={safePrimary}
          candidates={candidates}
          onOpenChange={onOpenChange}
          onMerged={onMerged}
        />
      </DialogContent>
    </Dialog>
  )
}

function DialogBody({
  primary,
  candidates,
  onOpenChange,
  onMerged,
}: {
  primary: Lead
  candidates: Candidate[]
  onOpenChange: (open: boolean) => void
  onMerged?: (result: { primary: Lead; merged: Lead[] }) => void
}) {
  const safePrimary: Lead = React.useMemo(
    () => (primary?.id ? primary : ({} as Lead)),
    [primary],
  )
  const allLeads = React.useMemo(
    () => [safePrimary, ...candidates.map((c) => c?.lead).filter((l): l is Lead => Boolean(l?.id))],
    [safePrimary, candidates],
  )

  const [selected, setSelected] = React.useState<Record<string, boolean>>({})
  const [choices, setChoices] = React.useState<Record<MergeField, string>>(() =>
    buildInitialChoices(safePrimary, candidates.map((c) => c?.lead).filter((l): l is Lead => Boolean(l?.id))),
  )
  const [notesAppend, setNotesAppend] = React.useState("")
  const [transcriptMerge, setTranscriptMerge] = React.useState<"append" | "keep-primary">("append")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const selectedSecondaries = candidates.filter((c) => Boolean(c?.lead?.id) && selected[c.lead.id])
  const canSubmit = selectedSecondaries.length > 0 && !submitting && Boolean(safePrimary?.id)

  const handleSubmit = async () => {
    if (!safePrimary?.id) {
      setError("No primary lead selected")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const fieldChoices: MergeFieldChoice[] = MERGE_FIELDS.filter(
        (f) => choices[f.key] && choices[f.key] !== safePrimary.id,
      ).map((f) => ({ field: f.key, pickFromLeadId: choices[f.key] }))

      const result = await mergeLeadsAction({
        primaryLeadId: safePrimary.id,
        secondaryLeadIds: selectedSecondaries.map((c) => c.lead.id),
        fieldChoices,
        notesAppend: notesAppend.trim() || undefined,
        transcriptMerge,
      })

      if (!result.ok) {
        setError(result.error)
        setSubmitting(false)
        return
      }
      onMerged?.({ primary: result.data.primary, merged: result.data.merged })
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Merge failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Combine className="size-4 text-[#E2E54B]" />
          Merge duplicates
        </DialogTitle>
        <DialogDescription>
          {candidates.length === 1
            ? "We found a likely match for this lead. Confirm the merge to combine their history into one record."
            : `We found ${candidates.length} leads that look like the same person. Pick which one to keep and what to combine.`}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="rounded-xl border border-[#E2E54B]/20 bg-[#E2E54B]/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#E2E54B]">
            Will be kept (primary)
          </p>
          <LeadSummary lead={safePrimary} highlight />
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A8F98]">
            Will be merged into primary
          </p>
          {candidates.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#23252A] bg-[#0B0C0E] p-3 text-xs text-[#8A8F98]">
              No candidates selected. Run &quot;Find duplicates&quot; to detect matches.
            </p>
          ) : (
            <ul className="space-y-2">
              {candidates.map((c) => {
                if (!c?.lead?.id) return null
                const checked = !!selected[c.lead.id]
                return (
                  <li
                    key={c.lead.id}
                    className={cn(
                      "rounded-xl border p-3 transition",
                      checked
                        ? "border-[#E2E54B]/40 bg-[#E2E54B]/5"
                        : "border-[#23252A] bg-[#0B0C0E] hover:border-[#3A3D44]",
                    )}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSelected((prev) => ({ ...prev, [c.lead.id]: e.target.checked }))
                        }
                        className="mt-1 size-3.5 rounded border-[#23252A] bg-[#121316] accent-[#E2E54B]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-[#F7F8F8]">
                            {c.lead.name}
                          </p>
                          <LeadStatusBadge status={c.lead.status} />
                          <span className="rounded-md border border-[#5E6AD2]/30 bg-[#5E6AD2]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#5E6AD2]">
                            Match: {c.matchType}
                          </span>
                          <span className="text-[10px] text-[#62666D]">
                            {c.lead.source} · {formatRelativeTime(c.lead.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-[#8A8F98]">
                          {c.lead.email || "no email"} · {c.lead.phone || "no phone"}
                        </p>
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {selectedSecondaries.length > 0 ? (
          <div className="space-y-3 rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="size-3.5 text-[#8A8F98]" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A8F98]">
                Pick a value for each field (default: primary)
              </p>
            </div>
            <ul className="space-y-1.5">
              {MERGE_FIELDS.map((f) => (
                <li
                  key={f.key}
                  className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-2 text-xs"
                >
                  <span className="flex items-center gap-1 text-[#8A8F98]">
                    {f.icon} {f.label}
                  </span>
                  <span className="truncate text-[#F7F8F8]">
                    {valueFor(
                      allLeads.find((l) => l.id === choices[f.key]) ?? safePrimary,
                      f.key,
                    ) || <em className="text-[#62666D]">empty</em>}
                  </span>
                  <select
                    value={choices[f.key] ?? safePrimary.id}
                    onChange={(e) =>
                      setChoices((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                    className="h-7 rounded-md border border-[#23252A] bg-[#121316] px-2 text-xs text-[#F7F8F8] outline-none focus:border-[#3A3D44]"
                  >
                    {allLeads.map((l, i) => (
                      <option key={l?.id ?? `lead-${i}`} value={l?.id ?? ""}>
                        {l?.name ?? "Unknown"}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-1 gap-2 border-t border-[#23252A] pt-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[#8A8F98]">
                Transcripts
                <select
                  value={transcriptMerge}
                  onChange={(e) =>
                    setTranscriptMerge(e.target.value as "append" | "keep-primary")
                  }
                  className="h-8 rounded-md border border-[#23252A] bg-[#121316] px-2 text-xs text-[#F7F8F8] outline-none focus:border-[#3A3D44]"
                >
                  <option value="append">Append all transcripts</option>
                  <option value="keep-primary">Keep primary only</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[#8A8F98]">
                Append to notes (optional)
                <input
                  type="text"
                  value={notesAppend}
                  onChange={(e) => setNotesAppend(e.target.value)}
                  placeholder="e.g. Confirmed botox follow-up"
                  className="h-8 rounded-md border border-[#23252A] bg-[#121316] px-2 text-xs text-[#F7F8F8] outline-none focus:border-[#3A3D44]"
                />
              </label>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-[#EB5757]/30 bg-[#EB5757]/10 p-2.5 text-xs text-[#F7F8F8]">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-[#EB5757]" />
            {error}
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
          <X className="size-4" />
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Merging…
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4" />
              Merge {selectedSecondaries.length || ""} into {(safePrimary?.name ?? "lead").split(" ")[0]}
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  )
}

function LeadSummary({ lead, highlight }: { lead: Lead; highlight?: boolean }) {
  const safeLead: Lead = lead?.id ? lead : ({} as Lead)
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Link
        href={safeLead?.id ? `/dashboard/leads/${safeLead.id}` : "/dashboard/leads"}
        className="truncate text-sm font-semibold text-[#F7F8F8] hover:underline"
      >
        {safeLead?.name ?? "Unknown lead"}
      </Link>
      <LeadStatusBadge status={safeLead?.status ?? "new"} />
      <span className="text-[10px] text-[#8A8F98]">
        {safeLead?.source ?? "Website Chat"} · created {formatDateTime(safeLead?.createdAt ?? "")}
      </span>
      {safeLead?.mergedFrom && safeLead.mergedFrom.length > 0 ? (
        <span className="rounded-md border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#22D3EE]">
          Already merged: {safeLead.mergedFrom.length}
        </span>
      ) : null}
      {highlight ? (
        <span className="rounded-md border border-[#E2E54B]/30 bg-[#E2E54B]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#E2E54B]">
          Primary
        </span>
      ) : null}
    </div>
  )
}

export function MergedHistoryList({ entries }: { entries: MergedLeadEntry[] }) {
  if (entries.length === 0) return null
  return (
    <ul className="mt-3 space-y-1.5">
      {entries.map((e) => (
        <li
          key={`${e.id}-${e.mergedAt}`}
          className="flex flex-wrap items-center gap-2 rounded-md border border-[#23252A] bg-[#0B0C0E] px-2.5 py-1.5 text-[11px]"
        >
          <span className="font-semibold text-[#F7F8F8]">{e.name}</span>
          <span className="text-[#8A8F98]">{e.source}</span>
          <span className="text-[#62666D]">merged {formatRelativeTime(e.mergedAt)}</span>
        </li>
      ))}
    </ul>
  )
}
