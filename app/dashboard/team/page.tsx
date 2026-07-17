import type { Metadata } from "next";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { FeatureLocked } from "@/components/dashboard/feature-locked";
import { PageHeader } from "@/components/dashboard/page-header";
import { TeamManagement } from "@/components/dashboard/team-management";
import { getCurrentSubscription } from "@/lib/subscription";

export const metadata: Metadata = {
  title: "Team | AivaSpa Dashboard",
  description: "Manage team members, roles, and permissions for your spa staff.",
};

export default async function TeamPage() {
  const subscription = await getCurrentSubscription()
  if (!subscription.hasAccess("role_based_access")) {
    return <FeatureLocked title="Team roles are a Pro feature" description="Upgrade to Pro to invite staff and assign workspace roles." requiredPlan="pro" />
  }
  return (
    <>
      <DashboardHeader />
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
        <PageHeader
          title="Team"
          description="Invite staff, assign roles, and control who can see leads and edit your knowledge base."
        />
        <TeamManagement />
      </div>
    </>
  );
}
