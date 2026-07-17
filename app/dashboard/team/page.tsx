import type { Metadata } from "next"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { FeatureLocked } from "@/components/dashboard/feature-locked"
import { PageHeader } from "@/components/dashboard/page-header"
import { TeamManagement } from "@/components/dashboard/team-management"
import { TeamAccessError } from "@/lib/team/access.server"
import { getTeamDashboardData } from "@/lib/team/server"

export const metadata: Metadata = {
  title: "Team | AivaSpa Dashboard",
  description: "Manage team members, secure invitations, roles, and workspace activity.",
}

export default async function TeamPage() {
  let data: Awaited<ReturnType<typeof getTeamDashboardData>>
  try {
    data = await getTeamDashboardData()
  } catch (error) {
    if (error instanceof TeamAccessError) {
      return <FeatureLocked title="Team roles are a Pro feature" description={error.message} requiredPlan="pro" />
    }
    throw error
  }

  return (
    <>
      <DashboardHeader />
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
        <PageHeader
          title="Team"
          description="Invite staff, assign roles, and review workspace access in one place."
        />
        <TeamManagement {...data} />
      </div>
    </>
  )
}
