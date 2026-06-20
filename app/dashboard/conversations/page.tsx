import type { Metadata } from "next";

import { ConversationsList } from "@/components/dashboard/conversations-list";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PageHeader } from "@/components/dashboard/page-header";
import { getLeads, getLiveChatSessions } from "@/lib/leads";

export const metadata: Metadata = {
  title: "Conversations | AivaSpa Dashboard",
  description: "Full chat transcripts between AivaSpa and your website visitors.",
};

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const [leads, liveSessions] = await Promise.all([
    getLeads(),
    getLiveChatSessions(60).catch(() => []),
  ]);

  return (
    <>
      <DashboardHeader />
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
        <PageHeader
          title="Conversations"
          description="Every chat between AivaSpa and your website visitors — live, searchable, and filterable."
        />
        <ConversationsList leads={leads} liveSessions={liveSessions} />
      </div>
    </>
  );
}
