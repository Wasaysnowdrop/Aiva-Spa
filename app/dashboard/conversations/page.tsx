import type { Metadata } from "next";

import { ConversationsList } from "@/components/dashboard/conversations-list";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { FeatureLocked } from "@/components/dashboard/feature-locked";
import { PageHeader } from "@/components/dashboard/page-header";
import { getLeads, getLiveChatSessions } from "@/lib/leads";
import { getCurrentSubscription } from "@/lib/subscription";

export const metadata: Metadata = {
  title: "Conversations | AivaSpa Dashboard",
  description: "Full chat transcripts between AivaSpa and your website visitors.",
};

export const dynamic = "force-dynamic";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>
}) {
  const { conversation } = await searchParams
  const subscription = await getCurrentSubscription()
  if (!subscription.hasAccess("conversation_history")) {
    return <FeatureLocked title="Conversation history is a Growth feature" description="Upgrade to Growth to search and review complete visitor transcripts." requiredPlan="growth" />
  }
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
        <ConversationsList leads={leads} liveSessions={liveSessions} initialConversationId={conversation} />
      </div>
    </>
  );
}
