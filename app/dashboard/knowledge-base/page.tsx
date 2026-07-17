import type { Metadata } from "next";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { KnowledgeBaseEditor } from "@/components/dashboard/knowledge-base-editor";
import { PageHeader } from "@/components/dashboard/page-header";

export const metadata: Metadata = {
  title: "Knowledge Base | AivaSpa Dashboard",
  description: "Manage services, FAQs, and guardrails that power AivaSpa's answers.",
};

export const dynamic = "force-dynamic";

export default function KnowledgeBasePage() {
  console.info("KNOWLEDGE_BASE_PAGE_RENDER_STARTED", {
    route: "/dashboard/knowledge-base",
  });

  return (
    <>
      <DashboardHeader />
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
        <PageHeader
          title="Knowledge Base"
          description="Everything AivaSpa is allowed to say. Update services, FAQs, and guardrails in one place."
        />
        <KnowledgeBaseEditor />
      </div>
    </>
  );
}
