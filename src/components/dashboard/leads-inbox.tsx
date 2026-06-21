"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  Combine,
  Download,
  Filter,
  Inbox,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react"

import { LeadStatusBadge } from "@/components/dashboard/lead-status-badge"
import { Button } from "@/components/ui/button"
import { AddLeadDialog } from "@/components/dashboard/add-lead-dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Lead } from "@/lib/supabase/types"
import { cn, formatRelativeTime } from "@/lib/utils"
import { useRealtimeSubscription } from "@/lib/hooks/use-realtime"
import { mapLead } from "@/lib/supabase/types"
import { getDuplicateGroupsAction } from "@/app/actions/leads"
import { MergeDuplicatesDialog, type Candidate } from "@/components/dashboard/merge-duplicates-dialog"
import { toast } from "sonner"

const statuses: { value: string; label: string }[] = [
  { value: "all", label: "All leads" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "booked", label: "Booked" },
  { value: "lost", label: "Lost" },
]

const dateRanges = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
]

export function LeadsInbox({ leads: initialLeads }: { leads: Lead[] }) {
  const safeInitial = React.useMemo(
    () =>
      (Array.isArray(initialLeads) ? initialLeads : [])
        .filter((l): l is Lead => Boolean(l?.id))
        .map((l) => ({ ...l })),
    [initialLeads],
  )

  const { data: leads } = useRealtimeSubscription<Lead>({
    table: "leads",
    initialData: safeInitial,
    mapRow: (row) => mapLead(row),
    getId: (item) => item?.id ?? "",
  })

  const safeLeads = React.useMemo(
    () =>
      (Array.isArray(leads) ? leads : [])
        .filter((l): l is Lead => Boolean(l?.id))
        .map((l) => ({ ...l })),
    [leads],
  )

  if (typeof window !== "undefined") {
    console.log("[aivaspa] LeadsInbox data:", {
      count: safeLeads.length,
      sample: safeLeads.slice(0, 3).map((l) => ({ id: l?.id, name: l?.name })),
    })
  }

  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState<string>("all")
  const [service, setService] = React.useState<string>("all")
  const [range, setRange] = React.useState("30d")
  const [selected, setSelected] = React.useState<string[]>([])
  const [dupes, setDupes] = React.useState<Array<{
    matchKey: string
    matchType: "phone" | "email"
    value: string
    leadIds: string[]
  }> | null>(null)
  const [scanning, setScanning] = React.useState(false)
  const [mergePrimary, setMergePrimary] = React.useState<Lead | null>(null)
  const [mergeCandidates, setMergeCandidates] = React.useState<Candidate[]>([])
  const [mergeOpen, setMergeOpen] = React.useState(false)
  const [addOpen, setAddOpen] = React.useState(false)

  const services = React.useMemo(
    () => Array.from(new Set(safeLeads.map((l) => l?.service).filter(Boolean) as string[])).sort(),
    [safeLeads],
  )

  const filtered = React.useMemo(() => {
    return safeLeads.filter((lead) => {
      if (!lead?.id) return false
      if (status !== "all" && lead.status !== status) return false
      if (service !== "all" && lead.service !== service) return false
      if (query) {
        const q = query.toLowerCase()
        const name = (lead.name ?? "").toLowerCase()
        const email = (lead.email ?? "").toLowerCase()
        const phone = (lead.phone ?? "").toLowerCase()
        if (!name.includes(q) && !email.includes(q) && !phone.includes(q)) {
          return false
        }
      }
      return true
    })
  }, [safeLeads, query, status, service])

  const counts = React.useMemo(
    () => ({
      all: safeLeads.length,
      new: safeLeads.filter((l) => l?.status === "new").length,
      contacted: safeLeads.filter((l) => l?.status === "contacted").length,
      booked: safeLeads.filter((l) => l?.status === "booked").length,
      lost: safeLeads.filter((l) => l?.status === "lost").length,
    }),
    [safeLeads],
  )

  const toggleAll = () => {
    if (selected.length === filtered.length) setSelected([])
    else setSelected(filtered.map((l) => l?.id).filter((id): id is string => Boolean(id)))
  }
  const toggle = (id: string) => {
    if (!id) return
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  const scanDuplicates = React.useCallback(async () => {
    setScanning(true)
    try {
      const res = await getDuplicateGroupsAction()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setDupes(res.data)
      if (res.data.length === 0) {
        toast.success("No duplicates found — your leads are clean.")
      } else {
        toast.message(`Found ${res.data.length} duplicate group${res.data.length === 1 ? "" : "s"}`)
      }
    } finally {
      setScanning(false)
    }
  }, [])

  const openMergeForGroup = (group: { leadIds: string[]; matchType: "phone" | "email" }) => {
    const involved = group.leadIds
      .map((id) => safeLeads.find((l) => l?.id === id))
      .filter((l): l is Lead => Boolean(l?.id))
      .sort((a, b) => (a?.createdAt ?? "").localeCompare(b?.createdAt ?? ""))
    if (involved.length < 2) return
    const [primary, ...rest] = involved
    if (!primary) return
    setMergePrimary(primary)
    setMergeCandidates(
      rest.map((lead) => ({ lead, matchType: group.matchType })),
    )
    setMergeOpen(true)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {statuses.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(s.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                status === s.value
                  ? "border-[#E2E54B]/40 bg-[#E2E54B]/10 text-[#E2E54B]"
                  : "border-[#23252A] bg-[#121316] text-[#8A8F98] hover:text-[#F7F8F8]",
              )}
            >
              {s.label}
              <span
                className={cn(
                  "rounded px-1 py-0.5 font-mono text-[10px]",
                  status === s.value
                    ? "bg-[#E2E54B]/15 text-[#E2E54B]"
                    : "bg-[#1A1B1E] text-[#62666D]",
                )}
              >
                {counts[s.value as keyof typeof counts]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={scanDuplicates}
            disabled={scanning}
          >
            {scanning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Combine className="size-4" />
            )}
            Find duplicates
          </Button>
          <Button variant="outline" size="sm">
            <Download className="size-4" />
            Export
          </Button>
          <Button size="sm" className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add lead
          </Button>
        </div>
      </div>

      {dupes && dupes.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-[#E2E54B]/30 bg-[#E2E54B]/5 p-3">
          <div className="flex items-center gap-2">
            <Combine className="size-3.5 text-[#E2E54B]" />
            <p className="text-xs font-semibold text-[#F7F8F8]">
              {dupes.length} duplicate group{dupes.length === 1 ? "" : "s"} detected
            </p>
            <Button
              size="xs"
              variant="ghost"
              className="ml-auto"
              onClick={() => setDupes(null)}
            >
              <X className="size-3" />
              Dismiss
            </Button>
          </div>
          <ul className="space-y-1.5">
            {dupes.map((g) => {
              const involved = g.leadIds
                .map((id) => safeLeads.find((l) => l?.id === id))
                .filter((l): l is Lead => Boolean(l?.id))
                .sort((a, b) => (a?.createdAt ?? "").localeCompare(b?.createdAt ?? ""))
              return (
                <li
                  key={g.matchKey}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-[#23252A] bg-[#0B0C0E] px-2.5 py-1.5 text-xs"
                >
                  <span className="rounded-md border border-[#5E6AD2]/30 bg-[#5E6AD2]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#5E6AD2]">
                    {g.matchType}
                  </span>
                  <span className="font-mono text-[#8A8F98]">{g.value}</span>
                  <span className="flex flex-wrap items-center gap-1 text-[#F7F8F8]">
                    {involved.map((l, i) => (
                      <React.Fragment key={l?.id ?? i}>
                        {i > 0 ? <span className="text-[#62666D]">·</span> : null}
                        <Link
                          href={l?.id ? `/dashboard/leads/${l.id}` : "/dashboard/leads"}
                          className="hover:underline"
                        >
                          {l?.name ?? "Unknown lead"}
                        </Link>
                      </React.Fragment>
                    ))}
                  </span>
                  <Button
                    size="xs"
                    className="ml-auto bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
                    onClick={() => openMergeForGroup(g)}
                  >
                    Merge
                  </Button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-2xl border border-[#23252A] bg-[#121316] p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#62666D]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or phone…"
            className="h-9 w-full pl-9"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#62666D] hover:text-[#F7F8F8]"
              aria-label="Clear"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-[#62666D]" />
          <Select value={service} onValueChange={setService}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {services.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              {dateRanges.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E2E54B]/30 bg-[#E2E54B]/5 px-3 py-2 text-xs">
          <CheckCircle2 className="size-3.5 text-[#E2E54B]" />
          <span className="text-[#F7F8F8]">{selected.length} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="xs" variant="outline">
              Mark contacted
            </Button>
            <Button size="xs" variant="outline">
              Mark booked
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[#23252A] bg-[#121316]">
        <div className="grid grid-cols-[36px_minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_120px_36px] items-center gap-3 border-b border-[#23252A] bg-[#0B0C0E] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#62666D]">
          <div>
            <input
              type="checkbox"
              aria-label="Select all"
              checked={selected.length === filtered.length && filtered.length > 0}
              onChange={toggleAll}
              className="size-3.5 rounded border-[#23252A] bg-[#121316] accent-[#E2E54B]"
            />
          </div>
          <div className="flex items-center gap-1">
            Lead <ArrowUpDown className="size-2.5" />
          </div>
          <div>Service</div>
          <div className="flex items-center gap-1">
            Status <ArrowUpDown className="size-2.5" />
          </div>
          <div>Preferred time</div>
          <div className="flex items-center gap-1">
            Created <ArrowUpDown className="size-2.5" />
          </div>
          <div />
        </div>

        {filtered.length === 0 ? (
          safeLeads.length === 0 ? (
            <DatabaseEmptyState />
          ) : (
            <EmptyState onClear={() => { setQuery(""); setStatus("all"); setService("all") }} />
          )
        ) : (
          <ul className="divide-y divide-[#23252A]">
            {filtered.map((lead) =>
              lead?.id ? (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  checked={selected.includes(lead.id)}
                  onToggle={() => toggle(lead.id)}
                />
              ) : null,
            )}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-[#8A8F98]">
        <p>
          Showing {filtered.length} of {safeLeads.length} leads
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
          <span className="font-mono">1 / 1</span>
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        </div>
      </div>

      <MergeDuplicatesDialog
        open={mergeOpen}
        onOpenChange={(o) => {
          setMergeOpen(o)
          if (!o) {
            setMergePrimary(null)
            setMergeCandidates([])
          }
        }}
        primary={mergePrimary?.id ? mergePrimary : (safeLeads[0]?.id ? safeLeads[0] : null)}
        candidates={mergeCandidates}
        onMerged={() => {
          void scanDuplicates()
        }}
      />

      <AddLeadDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(id) => {
          if (typeof window !== "undefined") {
            console.log("[aivaspa] manual lead created:", id)
          }
        }}
      />
    </div>
  )
}

function LeadRow({
  lead,
  checked,
  onToggle,
}: {
  lead: Lead
  checked: boolean
  onToggle: () => void
}) {
  const safeName = lead?.name ?? "Unknown lead"
  const initials = safeName
    .split(" ")
    .map((n) => n?.[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("") || "?"
  const href = lead?.id ? `/dashboard/leads/${lead.id}` : "/dashboard/leads"
  return (
    <li
      className={cn(
        "group grid grid-cols-[36px_minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_120px_36px] items-center gap-3 px-4 py-3 transition hover:bg-[#1A1B1E]",
        checked && "bg-[#1A1B1E]",
      )}
    >
      <div>
        <input
          type="checkbox"
          aria-label={`Select ${safeName}`}
          checked={checked}
          onChange={onToggle}
          className="size-3.5 rounded border-[#23252A] bg-[#121316] accent-[#E2E54B]"
        />
      </div>
      <Link
        href={href}
        className="flex min-w-0 items-center gap-3"
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[#08090A]"
          style={{
            background: `linear-gradient(135deg, ${
              lead?.service === "Botox"
                ? "#E2E54B"
                : lead?.service === "Fillers"
                  ? "#5E6AD2"
                  : lead?.service === "Laser"
                    ? "#22D3EE"
                    : lead?.service === "Facials"
                      ? "#34D399"
                      : lead?.service === "Microneedling"
                        ? "#FF77E9"
                        : "#8A8F98"
            }, #1A1B1E)`,
          }}
        >
          {initials}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-[#F7F8F8] group-hover:text-[#E2E54B]">
              {safeName}
            </p>
            {lead?.afterHours ? (
              <span className="rounded-md border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#22D3EE]">
                After hrs
              </span>
            ) : null}
            {lead && !lead.consentGiven ? (
              <span
                className="rounded-md border border-[#EB5757]/30 bg-[#EB5757]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#EB5757]"
                title="No consent recorded"
              >
                No consent
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs text-[#8A8F98]">
            {lead?.email ?? "no email"} · {lead?.phone ?? "no phone"}
          </p>
        </div>
      </Link>
      <div className="min-w-0">
        <p className="truncate text-sm text-[#F7F8F8]">{lead?.service ?? "—"}</p>
        <p className="truncate text-xs text-[#8A8F98]">{lead?.sourceUrl ?? ""}</p>
      </div>
      <div>
        <LeadStatusBadge status={lead?.status ?? "new"} />
      </div>
      <div>
        <p className="truncate text-sm text-[#F7F8F8]">{lead?.preferredTime ?? "—"}</p>
        <p className="truncate text-xs text-[#8A8F98]">{lead?.source ?? ""}</p>
      </div>
      <div>
        <p className="text-sm text-[#F7F8F8]">{lead?.createdAt ? formatRelativeTime(lead.createdAt) : "—"}</p>
        <p className="text-[10px] text-[#62666D]">via {lead?.source ?? "—"}</p>
      </div>
      <Link
        href={href}
        className="flex size-8 items-center justify-center rounded-md text-[#62666D] hover:bg-[#23252A] hover:text-[#F7F8F8]"
        aria-label={`Open ${safeName}`}
      >
        <ChevronRight className="size-4" />
      </Link>
    </li>
  )
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-[#23252A] bg-[#1A1B1E] text-[#8A8F98]">
        <Inbox className="size-5" />
      </span>
      <p className="text-sm font-semibold text-[#F7F8F8]">No leads match these filters</p>
      <p className="max-w-sm text-xs text-[#8A8F98]">
        Try adjusting your search or clearing filters to see more leads in your pipeline.
      </p>
      <Button variant="outline" size="sm" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  )
}

function DatabaseEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-[#23252A] bg-[#1A1B1E] text-[#8A8F98]">
        <Inbox className="size-5" />
      </span>
      <p className="text-sm font-semibold text-[#F7F8F8]">No leads yet</p>
      <p className="max-w-sm text-xs text-[#8A8F98]">
        When a visitor shares their contact info through your widget, they&apos;ll show up here. Install the
        widget on your site to start capturing leads 24/7.
      </p>
      <Button asChild size="sm" className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90">
        <Link href="/dashboard/guide">Install widget</Link>
      </Button>
    </div>
  )
}
