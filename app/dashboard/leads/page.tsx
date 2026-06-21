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

  try {
    // Make sure the user is authed before reading leads; this also
    // refreshes the session cookie as a side effect.
    const supabase = await createClient()
    await supabase.auth.getUser()
    const [fetchedLeads, channels] = await Promise.all([
      getLeads(),
      getNotificationChannelsServer(),
    ])
    leads = Array.isArray(fetchedLeads) ? fetchedLeads : []

    const emailChannel = Array.isArray(channels)
      ? channels.find((c) => c?.channel === "email")
      : undefined
    emailConfigured =
      !!emailChannel?.enabled && (emailChannel.recipients?.length ?? 0) > 0
  } catch (e) {
    console.error("[aivaspa] /dashboard/leads render failed:", e)
    leads = []
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
