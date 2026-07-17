import type { Metadata } from "next";

import { AnalyticsView } from "@/components/dashboard/analytics-view";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { FeatureLocked } from "@/components/dashboard/feature-locked";
import { PageHeader } from "@/components/dashboard/page-header";
import { getLeads } from "@/lib/leads";
import { getWidgetConfig } from "@/lib/db/widget.server";
import { getCurrentSubscription } from "@/lib/subscription";

export const metadata: Metadata = {
  title: "Analytics | AivaSpa Dashboard",
  description: "Detailed analytics — leads, conversion, response time, and KPIs vs. targets.",
};

export default async function AnalyticsPage() {
  const subscription = await getCurrentSubscription()
  if (!subscription.hasAccess("conversion_analytics")) {
    return <FeatureLocked title="Analytics is a Growth feature" description="Upgrade to Growth for conversion trends, visitor intelligence, and performance insights." requiredPlan="growth" />
  }
  const [leads, widget] = await Promise.all([
    getLeads(),
    getWidgetConfig().catch(() => null),
  ]);

  const timezone = widget?.workingHours?.tz ?? "America/Los_Angeles";

  return (
    <>
      <DashboardHeader />
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
        <PageHeader
          title="Analytics"
          description="Trends, KPIs, and how AivaSpa is performing against the PRD success metrics."
        />
        <AnalyticsView leads={leads} timezone={timezone} />
      </div>
    </>
  );
}
