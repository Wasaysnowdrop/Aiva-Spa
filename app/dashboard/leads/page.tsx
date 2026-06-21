import type { Metadata } from "next"
import Link from "next/link"

import { Bell } from "lucide-react"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { LeadsInbox } from "@/components/dashboard/leads-inbox"
import { PageHeader } from "@/components/dashboard/page-header"
import { getLeads } from "@/lib/leads"
import { getNotificationChannelsServer } from "@/lib/db/notifications.server"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Leads | AivaSpa Dashboard",
  description: "All captured leads, transcripts, and follow-up status.",
}

export default async function LeadsPage() {
  let leads: Awaited<ReturnType<typeof getLeads>> = []
  let emailConfigured = false
  let userId: string | null = null
  let userEmail: string | null = null

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id ?? null
    userEmail = user?.email ?? null
    console.log("[aivaspa] /dashboard/leads current user:", { userId, userEmail })

    const [fetchedLeads, channels] = await Promise.all([
      getLeads(),
      getNotificationChannelsServer(),
    ])
    leads = Array.isArray(fetchedLeads) ? fetchedLeads : []
    console.log("[aivaspa] /dashboard/leads supabase leads response:", {
      count: leads.length,
      sample: leads.slice(0, 2).map((l) => ({ id: l?.id, name: l?.name })),
    })

    const emailChannel = Array.isArray(channels)
      ? channels.find((c) => c?.channel === "email")
      : undefined
    emailConfigured =
      !!emailChannel?.enabled && (emailChannel.recipients?.length ?? 0) > 0
  } catch (e) {
    console.error("[aivaspa] /dashboard/leads render failed:", e)
  }

  return (
    <>
      <DashboardHeader />
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
        <PageHeader
          title="Leads"
          description="Every visitor who raised their hand. Search, filter, and update status as you follow up."
        />

        {!emailConfigured ? (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E54B]/30 bg-[#E2E54B]/5 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#E2E54B]/30 bg-[#E2E54B]/10 text-[#E2E54B]">
                <Bell className="size-3.5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#F7F8F8]">
                  Pick where lead notifications go
                </p>
                <p className="text-xs text-[#8A8F98]">
                  You haven&apos;t added an email to receive new-lead alerts yet.
                  Add one in Settings → Notifications — every recipient you list
                  gets pinged the moment a lead is captured.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/settings?section=notifications"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E2E54B] px-3 py-1.5 text-xs font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90"
            >
              Add notification email
            </Link>
          </div>
        ) : null}

        <LeadsInbox leads={leads} />
      </div>
    </>
  )
}
