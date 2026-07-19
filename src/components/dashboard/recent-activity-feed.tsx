"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarCheck2,
  CheckCircle2,
  CircleUserRound,
  CreditCard,
  RefreshCw,
  Settings2,
  ShieldCheck,
  UserPlus,
  Users,
  MessageCircleMore,
} from "lucide-react"

import type { ActivityCategory, FormattedActivity } from "@/lib/activity/formatter"
import { cn, formatRelativeTime } from "@/lib/utils"

export type RecentActivityEntry = FormattedActivity & { id: string }

const categoryStyles: Record<ActivityCategory, { className: string; Icon: typeof UserPlus }> = {
  lead: { className: "bg-[#E2E54B]/12 text-[#E2E54B]", Icon: UserPlus },
  booking: { className: "bg-[#4CB782]/12 text-[#4CB782]", Icon: CalendarCheck2 },
  team: { className: "bg-[#5E6AD2]/14 text-[#8B95E0]", Icon: Users },
  billing: { className: "bg-[#22D3EE]/12 text-[#22D3EE]", Icon: CreditCard },
  setup: { className: "bg-[#FF77E9]/12 text-[#FF77E9]", Icon: Settings2 },
  security: { className: "bg-[#8A8F98]/12 text-[#A7ABB2]", Icon: ShieldCheck },
  widget: { className: "bg-[#E2E54B]/12 text-[#E2E54B]", Icon: MessageCircleMore },
  notification: { className: "bg-[#F59E0B]/12 text-[#F59E0B]", Icon: AlertTriangle },
}

export function RecentActivitySkeleton() {
  return (
    <div className="mt-4 space-y-3" aria-label="Loading recent activity">
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex animate-pulse gap-3 rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3">
          <span className="size-8 shrink-0 rounded-lg bg-[#23252A]" />
          <div className="flex-1 space-y-2 py-0.5">
            <span className="block h-3 w-2/3 rounded bg-[#23252A]" />
            <span className="block h-2.5 w-full rounded bg-[#1A1B1E]" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function RecentActivityFeed({ entries, error = false }: { entries: RecentActivityEntry[]; error?: boolean }) {
  const router = useRouter()

  return (
    <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#F7F8F8]">Recent activity</h2>
          <p className="mt-0.5 text-xs text-[#8A8F98]">Important customer and workspace updates</p>
        </div>
        <CircleUserRound className="size-4 shrink-0 text-[#22D3EE]" />
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-[#F05B5B]/30 bg-[#F05B5B]/5 p-4 text-center">
          <p className="text-sm font-semibold text-[#F7F8F8]">We couldn&apos;t load recent activity</p>
          <p className="mt-1 text-xs text-[#8A8F98]">Your data is safe. Refresh this section to try again.</p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#34373D] px-3 py-1.5 text-xs font-semibold text-[#F7F8F8] transition hover:bg-[#1A1B1E]"
          >
            <RefreshCw className="size-3" /> Retry
          </button>
        </div>
      ) : entries.length > 0 ? (
        <ol className="mt-4 divide-y divide-[#23252A]">
          {entries.map((entry) => {
            const { Icon, className } = categoryStyles[entry.category]
            return (
              <li key={entry.id} className="flex min-w-0 gap-3 py-3 first:pt-0 last:pb-0">
                <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", className)}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5">
                    <p className="min-w-0 break-words text-sm font-semibold leading-5 text-[#F7F8F8]">{entry.title}</p>
                    <time className="shrink-0 text-[10px] text-[#62666D]" dateTime={entry.timestamp}>
                      {formatRelativeTime(entry.timestamp)}
                    </time>
                  </div>
                  {entry.description ? <p className="mt-0.5 break-words text-xs leading-5 text-[#8A8F98]">{entry.description}</p> : null}
                  <div className="mt-1.5 flex min-w-0 items-center gap-2 text-[10px] text-[#62666D]">
                    <span className="truncate">by {entry.actorName}</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 capitalize",
                        entry.status === "error" ? "text-[#F05B5B]" : entry.status === "warning" ? "text-[#F59E0B]" : "text-[#4CB782]",
                      )}
                    >
                      <CheckCircle2 className="size-2.5" /> {entry.status}
                    </span>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="mt-4 flex min-h-40 items-center justify-center rounded-xl border border-dashed border-[#23252A] bg-[#1A1B1E]/40 p-5 text-center">
          <div>
            <p className="text-sm font-semibold text-[#F7F8F8]">No recent business activity yet.</p>
            <p className="mt-1 text-xs leading-5 text-[#8A8F98]">Lead, booking, setup, and team updates will appear here.</p>
          </div>
        </div>
      )}

      <Link href="/dashboard/team" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#E2E54B] hover:underline">
        View audit log <ArrowUpRight className="size-3" />
      </Link>
    </div>
  )
}
