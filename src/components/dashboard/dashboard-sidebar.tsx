"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Home,
  Inbox,
  LifeBuoy,
  LogOut,
  MessageSquareText,
  Settings,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react"
import { Logo } from "@/components/logo"

import { cn } from "@/lib/utils"
import { signOut } from "@/app/actions/auth"
import { createClient } from "@/lib/supabase/client"
import { useDashboardDrawer } from "@/components/dashboard/dashboard-drawer-context"

const navItems = [
  { href: "/dashboard", label: "Overview", icon: Home, exact: true },
  { href: "/dashboard/leads", label: "Leads", icon: Inbox, badgeKey: "newLeads" as const },
  { href: "/dashboard/conversations", label: "Conversations", icon: MessageSquareText },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/knowledge-base", label: "Knowledge Base", icon: BookOpen },
  { href: "/dashboard/widget", label: "Widget", icon: Wand2 },
  { href: "/dashboard/team", label: "Team", icon: Users },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/guide", label: "Install Guide", icon: LifeBuoy },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
]

export type SidebarUser = {
  fullName: string | null
  email: string | null
  spaName: string | null
  planName?: string | null
  planId?: string | null
  planStatus?: "trialing" | "active" | "canceled" | "expired" | "none" | null
  trialDaysRemaining?: number
}

function initials(user: SidebarUser) {
  const source = (user.fullName && user.fullName.trim()) || user.email || "U"
  return source
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part?.[0]?.toUpperCase() ?? "")
    .filter(Boolean)
    .join("") || "U"
}

export function DashboardSidebar({ user }: { user: SidebarUser }) {
  return (
    <aside className="sticky top-0 z-30 hidden h-screen w-64 shrink-0 flex-col border-r border-[#23252A] bg-[#0B0C0E] lg:flex">
      <SidebarPanel user={user} />
    </aside>
  )
}

/**
 * Panel-only renderer — used by the desktop sidebar wrapper above and
 * by the mobile drawer. Owns the live-data fetching (new-leads count)
 * so both surfaces stay in sync with the same Supabase channel.
 */
function SidebarPanel({ user, onNavigate }: { user: SidebarUser; onNavigate?: () => void }) {
  const pathname = usePathname()
  const [newLeadsCount, setNewLeadsCount] = React.useState(0)
  const reactId = React.useId()
  const channelId = React.useMemo(
    () => `sidebar-leads-${user.email ?? "anon"}-${reactId.replace(/[:]/g, "")}`,
    [user.email, reactId],
  )

  React.useEffect(() => {
    if (typeof window === "undefined") return
    let cancelled = false
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null
    let supabase: ReturnType<typeof createClient> | null = null
    try {
      supabase = createClient()
      const client = supabase
      const fetchCount = async () => {
        try {
          const { count } = await client
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("status", "new")
          if (!cancelled && typeof count === "number") setNewLeadsCount(count)
        } catch (e) {
          console.error("[sidebar] leads count fetch failed:", e)
        }
      }
      void fetchCount()
      try {
        channel = client
          .channel(channelId)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "leads" },
            () => {
              void fetchCount()
            },
          )
          .subscribe()
      } catch (e) {
        console.error("[sidebar] realtime subscribe failed:", e)
      }
    } catch (e) {
      console.error("[sidebar] supabase client init failed:", e)
    }
    return () => {
      cancelled = true
      try {
        if (supabase && channel) {
          void supabase.removeChannel(channel)
        }
      } catch (e) {
        console.error("[sidebar] removeChannel failed:", e)
      }
    }
  }, [channelId])

  return (
    <SidebarBody
      user={user}
      pathname={pathname}
      badges={{ newLeads: newLeadsCount }}
      onNavigate={onNavigate}
    />
  )
}

/**
 * Mobile drawer containing the same sidebar content. Opens via the
 * hamburger button rendered in the dashboard header on screens < lg.
 * State is shared via DashboardDrawerContext so any header on any
 * page can open it. Closes on navigation, on backdrop tap, and on
 * Escape.
 */
export function MobileSidebarDrawer({ user }: { user: SidebarUser }) {
  const { open, closeDrawer } = useDashboardDrawer()

  // Lock body scroll while the menu is open so iOS Safari users can
  // still see the address bar.
  React.useEffect(() => {
    if (!open) return
    if (typeof document === "undefined") return
    let prev: string | null = null
    try {
      prev = document.body.style.overflow
      document.body.style.overflow = "hidden"
    } catch (e) {
      console.error("[sidebar] body lock failed:", e)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      try {
        document.body.style.overflow = prev ?? ""
      } catch (e) {
        console.error("[sidebar] body unlock failed:", e)
      }
    }
  }, [open, closeDrawer])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close menu"
        onClick={closeDrawer}
        className="absolute inset-0 bg-[#08090A]/80 backdrop-blur-sm"
      />
      <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-[#23252A] bg-[#0B0C0E] shadow-2xl">
        <SidebarPanel user={user} onNavigate={closeDrawer} />
      </aside>
    </div>
  )
}

/**
 * Inner body of the sidebar — used both for the persistent desktop
 * sidebar and for the mobile drawer. Extracted so the same nav, plan
 * pill, and sign-out are rendered identically on both surfaces.
 */
export function SidebarBody({
  user,
  pathname,
  badges,
  onNavigate,
}: {
  user: SidebarUser
  pathname: string
  badges: { newLeads: number }
  onNavigate?: () => void
}) {
  return (
    <>
      <div className="flex h-16 items-center gap-2.5 border-b border-[#23252A] px-5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 px-3 py-2"
          aria-label="AivaSpa"
          onClick={onNavigate}
        >
          <Logo />
        </Link>
      </div>

      <div className="space-y-3 px-3 pt-4">
        <div className="flex items-center gap-2 rounded-lg border border-[#23252A] bg-[#121316] px-3 py-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#E2E54B] to-[#5E6AD2] text-[10px] font-bold text-[#08090A]">
            {initials(user)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-[#F7F8F8]">
              {user.spaName ?? "Your med spa"}
            </p>
            <p className="truncate text-[10px] text-[#8A8F98]">
              {user.email ?? "Signed in"}
            </p>
          </div>
          <span className="flex size-2 rounded-full bg-[#4CB782]" aria-hidden />
        </div>

        {user.planName ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[#23252A] bg-[#0B0C0E] px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#62666D]">
                Current plan
              </p>
              <p className="truncate text-xs font-semibold text-[#F7F8F8]">
                {user.planName}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                user.planStatus === "trialing"
                  ? "bg-[#E2E54B]/15 text-[#E2E54B]"
                  : user.planStatus === "active"
                    ? "bg-[#4CB782]/15 text-[#4CB782]"
                    : "bg-[#EB5757]/15 text-[#EB5757]"
              }`}
            >
              {user.planStatus === "trialing"
                ? `Trial · ${user.trialDaysRemaining ?? 0}d`
                : user.planStatus === "active"
                  ? "Active"
                  : "Expired"}
            </span>
          </div>
        ) : null}

        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-start gap-2 rounded-lg border border-[#23252A] bg-[#0B0C0E] px-3 py-2 text-left text-xs font-semibold text-[#8A8F98] transition hover:border-[#3A3D44] hover:bg-[#121316] hover:text-[#F7F8F8]"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </form>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[#62666D]">
          Workspace
        </p>
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/")
            const badgeValue = item.badgeKey ? badges[item.badgeKey] : undefined
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#1A1B1E] text-[#F7F8F8]"
                      : "text-[#8A8F98] hover:bg-[#1A1B1E] hover:text-[#F7F8F8]",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 transition-colors",
                      isActive ? "text-[#E2E54B]" : "text-[#8A8F98] group-hover:text-[#F7F8F8]",
                    )}
                  />
                  <span className="flex-1">{item.label}</span>
                  {badgeValue !== undefined && badgeValue > 0 ? (
                    <span className="flex size-5 items-center justify-center rounded-md bg-[#E2E54B]/15 px-1.5 text-[10px] font-semibold text-[#E2E54B]">
                      {badgeValue}
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-[#23252A] p-3">
        <ButtonUpgrade
          planStatus={user.planStatus ?? null}
          planId={user.planId ?? null}
        />
      </div>
    </>
  )
}

function ButtonUpgrade({
  planStatus,
  planId,
}: {
  planStatus: SidebarUser["planStatus"]
  planId: SidebarUser["planId"]
}) {
  // Hide the upgrade CTA when the user already has an active paid plan.
  // Active trials and active subscriptions don't need an upgrade prompt.
  if (planStatus === "active" || planStatus === "trialing") {
    return null
  }
  const label = planStatus === "expired" || planStatus === "canceled" ? "Reactivate plan" : "Upgrade"
  return (
    <Link
      href={planId ? `/checkout/${planId}` : "/pricing"}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-3 py-2.5 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90"
    >
      <Sparkles className="size-4" />
      {label}
    </Link>
  )
}
