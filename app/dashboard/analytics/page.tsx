import type { Metadata } from "next"

import { AnalyticsDashboard } from "@/components/dashboard/analytics-dashboard"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { FeatureLocked } from "@/components/dashboard/feature-locked"
import { PageHeader } from "@/components/dashboard/page-header"
import { getAnalyticsResult } from "@/lib/analytics/server"
import type { AnalyticsLoadError } from "@/lib/analytics/types"
import { getWidgetConfig } from "@/lib/db/widget.server"
import { getCurrentSubscription } from "@/lib/subscription"

export const metadata: Metadata = {
  title: "Analytics | AivaSpa Dashboard",
  description: "Detailed analytics — leads, conversion, response time, and KPIs vs. targets.",
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  console.info("ANALYTICS_PAGE_RENDER_STARTED")

  const subscription = await getCurrentSubscription()
  console.info("ANALYTICS_AUTH_LOADED", {
    subscriptionFound: Boolean(subscription.row),
    subscriptionStatus: subscription.status,
  })

  const [{ range }, widget] = await Promise.all([
    searchParams,
    getWidgetConfig().catch((error) => {
      console.error("ANALYTICS_BUSINESS_LOAD_FAILED", {
        message: error instanceof Error ? error.message : String(error),
      })
      return null
    }),
  ])
  console.info("ANALYTICS_BUSINESS_LOADED", { businessLoaded: Boolean(widget) })

  const hasAccess = subscription.hasAccess("conversion_analytics")
  console.info("ANALYTICS_ENTITLEMENT_CHECKED", {
    plan: subscription.planId,
    status: subscription.status,
    hasAccess,
  })
  if (!hasAccess) {
    return <FeatureLocked title="Analytics is a Growth feature" description="Upgrade to Growth for conversion trends, visitor intelligence, and performance insights." requiredPlan="growth" />
  }

  const timezone = widget?.workingHours?.tz ?? "America/Los_Angeles"
  const result = await getAnalyticsResult(range, timezone)
  const loadError: AnalyticsLoadError | null = result.error
    ? process.env.NODE_ENV === "production"
      ? { stage: result.error.stage }
      : result.error
    : null

  return (
    <>
      <DashboardHeader />
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
        <PageHeader
          title="Analytics"
          description="Understand lead generation, booking performance, response quality, and visitor behaviour."
        />
        <AnalyticsDashboard payload={result.payload} loadError={loadError} />
      </div>
    </>
  )
}
