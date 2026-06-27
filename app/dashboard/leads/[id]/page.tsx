import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ChevronLeft } from "lucide-react"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { LeadDetail } from "@/components/dashboard/lead-detail"
import { getLead } from "@/lib/leads"

export const dynamic = "force-dynamic"

interface LeadDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: LeadDetailPageProps): Promise<Metadata> {
  const { id } = await params
  try {
    const lead = await getLead(id)
    return {
      title: lead ? `${lead.name} · Lead` : "Lead not found",
      description: lead ? `Lead from ${lead.source} interested in ${lead.service}.` : "Lead not found.",
    }
  } catch {
    return { title: "Lead not found" }
  }
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params
  const lead = await getLead(id)

  if (!lead) {
    notFound()
  }

  return (
    <>
      <DashboardHeader />
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
        <Link
          href="/dashboard/leads"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#8A8F98] transition hover:text-[#F7F8F8]"
        >
          <ChevronLeft className="size-3.5" /> Back to leads
        </Link>
        <LeadDetail lead={lead} />
      </div>
    </>
  )
}
