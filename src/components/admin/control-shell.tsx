"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity, AlertTriangle, BarChart3, BookOpenCheck, Bot, Building2,
  CalendarDays, CircleDollarSign, Database, Gauge, LogOut, MailCheck,
  MessageSquare, ReceiptText, ScrollText, Settings2, Users, WalletCards,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAVIGATION = [
  { group: "Control centre", items: [
    { href: "/admin", label: "Overview", icon: Gauge },
    { href: "/admin/live", label: "Live activity", icon: Activity },
    { href: "/admin/incidents", label: "Incidents", icon: AlertTriangle },
  ]},
  { group: "Customers", items: [
    { href: "/admin/businesses", label: "Businesses", icon: Building2 },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/subscriptions", label: "Subscriptions", icon: WalletCards },
  ]},
  { group: "Operations", items: [
    { href: "/admin/leads", label: "Leads", icon: BookOpenCheck },
    { href: "/admin/conversations", label: "Conversations", icon: MessageSquare },
    { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
    { href: "/admin/email", label: "Email delivery", icon: MailCheck },
  ]},
  { group: "AI & usage", items: [
    { href: "/admin/ai-usage", label: "AI usage", icon: Bot },
    { href: "/admin/conversation-usage", label: "Conversation usage", icon: BarChart3 },
    { href: "/admin/costs", label: "Cost monitoring", icon: CircleDollarSign },
  ]},
  { group: "System", items: [
    { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    { href: "/admin/database", label: "Database health", icon: Database },
    { href: "/admin/settings", label: "Configuration", icon: Settings2 },
  ]},
]

export function AdminControlSidebar({ email, role }: { email: string | null; role: string }) {
  const pathname = usePathname()
  return (
    <aside className="sticky top-0 hidden h-screen w-[252px] shrink-0 flex-col border-r border-[#202329] bg-[#090A0C] lg:flex">
      <div className="border-b border-[#202329] px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#E5E73F] text-sm font-black text-[#090A0C]">A</span>
          <div className="min-w-0">
            <p className="font-semibold tracking-tight text-[#F5F6F7]">AivaSpa Admin</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#7B828C]"><span className="size-1.5 rounded-full bg-[#55C58A]" /> Operations control centre</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAVIGATION.map((section) => (
          <div key={section.group} className="mb-5">
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#59606A]">{section.group}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
                const Icon = item.icon
                return <li key={item.href}><Link href={item.href} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors", active ? "bg-[#1A1D21] text-white" : "text-[#969DA6] hover:bg-[#121418] hover:text-white")}><Icon className={cn("size-4", active ? "text-[#E5E73F]" : "text-[#69717C]")} />{item.label}</Link></li>
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-[#202329] px-4 py-4">
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-[#111318] px-3 py-2.5">
          <ReceiptText className="size-4 text-[#747B85]" />
          <div className="min-w-0"><p className="truncate text-xs text-[#D9DCE0]">{email ?? "Admin"}</p><p className="mt-0.5 text-[10px] capitalize text-[#686F79]">{role.replaceAll("_", " ")}</p></div>
        </div>
        <form action="/api/admin/logout" method="post"><button className="flex w-full items-center gap-2 px-2 text-xs text-[#7D848D] hover:text-[#F26C6C]" type="submit"><LogOut className="size-3.5" /> Sign out</button></form>
      </div>
    </aside>
  )
}
