import type { Metadata } from "next"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { LeadsInbox } from "@/components/dashboard/leads-inbox"
import { PageHeader } from "@/components/dashboard/page-header"
import { getLeads } from "@/lib/leads"

export const metadata: Metadata = {
  title: "Leads | AivaSpa Dashboard",
  description: "All captured leads, transcripts, and follow-up status.",
}

export default async function LeadsPage() {
  const leads = await getLeads()

  return (
    <>
      <DashboardHeader />
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
        <PageHeader
          title="Leads"
          description="Every visitor who raised their hand. Search, filter, and update status as you follow up."
        />
        <LeadsInbox leads={leads} />
      </div>
    </>
  )
}
