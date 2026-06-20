"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useDashboardDrawer } from "@/components/dashboard/dashboard-drawer-context";

interface DashboardHeaderProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

export function DashboardHeader({ actions }: DashboardHeaderProps) {
  const pathname = usePathname();
  const { openDrawer } = useDashboardDrawer();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-[#23252A] bg-[#08090A]/85 px-4 backdrop-blur-xl sm:px-5 lg:gap-4 lg:px-8">
      <button
        type="button"
        aria-label="Open navigation"
        onClick={openDrawer}
        className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#23252A] bg-[#0F1013] text-[#F7F8F8] transition hover:border-[#3A3D44] hover:bg-[#1A1B1E] lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#62666D]" />
          <Input
            placeholder="Search leads, conversations, services…"
            className="h-9 w-full pl-9"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-[#23252A] bg-[#1A1B1E] px-1.5 py-0.5 text-[10px] font-mono text-[#8A8F98] sm:inline-block">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 lg:flex-initial">
        <span className="hidden text-xs text-[#8A8F98] sm:inline">
          {pathname.split("/").filter(Boolean).join(" / ")}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Notifications" className="relative">
              <Bell className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-80 border border-[#23252A] bg-[#0F1013] p-0">
            <div className="flex items-center justify-between px-3 py-2.5">
              <DropdownMenuLabel className="p-0 text-sm font-semibold text-[#F7F8F8]">
                Notifications
              </DropdownMenuLabel>
              <span className="rounded-full bg-[#1A1B1E] px-2 py-0.5 text-[10px] font-semibold text-[#8A8F98]">
                0 new
              </span>
            </div>
            <DropdownMenuSeparator className="m-0 bg-[#23252A]" />
            <div className="p-6 text-center">
              <p className="text-xs font-semibold text-[#F7F8F8]">No notifications yet</p>
              <p className="mt-1 text-[11px] text-[#8A8F98]">
                Real lead alerts will appear here after they are sent.
              </p>
            </div>
            <DropdownMenuSeparator className="m-0 bg-[#23252A]" />
            <Link href="/dashboard/settings" className="block px-3 py-2 text-center text-xs font-semibold text-[#E2E54B] hover:bg-[#1A1B1E]">
              View notification settings
            </Link>
          </DropdownMenuContent>
        </DropdownMenu>
        {actions}
      </div>
    </header>
  );
}

