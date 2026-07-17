"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  AlertCircle,
  Bot,
  Boxes,
  Database,
  Gauge,
  ListChecks,
  LogOut,
  MessageSquare,
  Network,
  ScrollText,
  Settings,
  Users,
  Webhook,
} from "lucide-react"

import { cn } from "@/lib/utils"

export type AdminNavItem = {
  href: string
  label: string
  icon: React.ReactNode
  group?: string
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: <Gauge className="size-4" />, group: "Live" },
  { href: "/admin/live", label: "Live feed", icon: <Activity className="size-4" />, group: "Live" },
  { href: "/admin/llm", label: "LLM stats", icon: <Bot className="size-4" />, group: "Live" },
  { href: "/admin/leads", label: "Leads", icon: <ListChecks className="size-4" />, group: "Data" },
  { href: "/admin/conversations", label: "Conversations", icon: <MessageSquare className="size-4" />, group: "Data" },
  { href: "/admin/users", label: "Users", icon: <Users className="size-4" />, group: "Account" },
  { href: "/admin/spas", label: "Spas / installs", icon: <Boxes className="size-4" />, group: "Account" },
  { href: "/admin/webhooks", label: "Webhooks", icon: <Webhook className="size-4" />, group: "Integrations" },
  { href: "/admin/notifications", label: "Notifications", icon: <Network className="size-4" />, group: "Integrations" },
  { href: "/admin/audit", label: "Audit log", icon: <ScrollText className="size-4" />, group: "System" },
  { href: "/admin/database", label: "Database", icon: <Database className="size-4" />, group: "System" },
  { href: "/admin/settings", label: "Settings", icon: <Settings className="size-4" />, group: "System" },
]

const groupedNav = (() => {
  const groups: Record<string, AdminNavItem[]> = {}
  for (const item of ADMIN_NAV) {
    const group = item.group ?? ""
    if (!groups[group]) groups[group] = []
    groups[group].push(item)
  }
  return groups
})()

export function AdminSidebar({ email }: { email: string | null }) {
  const pathname = usePathname()
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[#23252A] bg-[#08090a] lg:flex">
      <div className="flex items-center gap-2 border-b border-[#23252A] px-5 py-4">
        <span className="flex size-7 items-center justify-center rounded-md bg-[#E2E54B] text-[10px] font-bold text-[#08090A]">
          A
        </span>
        <div>
          <p className="text-xs font-semibold tracking-tight text-[#F7F8F8]">
            AivaSpa · Admin
          </p>
          <p className="text-[10px] text-[#62666D]">
            <span className="mr-1 inline-block size-1.5 rounded-full bg-[#4CB782]" />
            Realtime control room
          </p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {Object.entries(groupedNav).map(([group, items]) => (
          <div key={group} className="mb-3">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#62666D]">
              {group}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname?.startsWith(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition",
                        active
                          ? "bg-[#1A1B1E] text-[#F7F8F8]"
                          : "text-[#8A8F98] hover:bg-[#101115] hover:text-[#F7F8F8]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-sm",
                          active ? "text-[#E2E54B]" : "text-[#62666D]",
                        )}
                      >
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-[#23252A] px-4 py-3 text-[10px] text-[#62666D]">
        <p className="truncate font-mono text-[#8A8F98]">{email ?? "—"}</p>
        <form action="/api/admin/logout" method="post">
          <button
            type="submit"
            className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8A8F98] transition hover:text-[#EB5757]"
          >
            <LogOut className="size-3" /> Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}

export function AdminTopBar({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
}) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#23252A] bg-[#08090a]/85 px-5 py-3 backdrop-blur-xl">
      <div>
        <h1 className="text-base font-bold text-[#F7F8F8] sm:text-lg">{title}</h1>
        {subtitle ? (
          <p className="text-[11px] text-[#8A8F98]">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">{right}</div>
    </div>
  )
}

export function AdminErrorBanner({ message }: { message: string }) {
  return (
    <div className="mx-5 mt-3 flex items-center gap-2 rounded-md border border-[#EB5757]/30 bg-[#EB5757]/10 px-3 py-2 text-xs text-[#EB5757]">
      <AlertCircle className="size-3.5 shrink-0" />
      {message}
    </div>
  )
}
