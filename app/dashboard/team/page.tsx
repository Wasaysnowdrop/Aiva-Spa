import type { Metadata } from "next";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PageHeader } from "@/components/dashboard/page-header";
import { TeamManagement } from "@/components/dashboard/team-management";

export const metadata: Metadata = {
  title: "Team | AivaSpa Dashboard",
  description: "Manage team members, roles, and permissions for your spa staff.",
};

export default function TeamPage() {
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
