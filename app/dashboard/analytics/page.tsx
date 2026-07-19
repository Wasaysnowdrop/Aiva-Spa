import type { Metadata } from "next";

import { AnalyticsDashboard } from "@/components/dashboard/analytics-dashboard";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { FeatureLocked } from "@/components/dashboard/feature-locked";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAnalyticsPayload } from "@/lib/analytics/server";
import { getWidgetConfig } from "@/lib/db/widget.server";
import { getCurrentSubscription } from "@/lib/subscription";

export const metadata: Metadata = {
  title: "Analytics | AivaSpa Dashboard",
  description: "Detailed analytics — leads, conversion, response time, and KPIs vs. targets.",
};

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const subscription = await getCurrentSubscription()
  if (!subscription.hasAccess("conversion_analytics")) {
    return <FeatureLocked title="Analytics is a Growth feature" description="Upgrade to Growth for conversion trends, visitor intelligence, and performance insights." requiredPlan="growth" />
  }
  const [{ range }, widget] = await Promise.all([searchParams, getWidgetConfig().catch(() => null)]);

  const timezone = widget?.workingHours?.tz ?? "America/Los_Angeles";
  const payload = await getAnalyticsPayload(range, timezone);

  return (
    <>
      <DashboardHeader />
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
        <PageHeader
          title="Analytics"
          description="Understand lead generation, booking performance, response quality, and visitor behaviour."
        />
        <AnalyticsDashboard payload={payload} />
      </div>
    </>
  );
}
