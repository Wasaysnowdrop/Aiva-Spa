import type { Metadata } from "next";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PageHeader } from "@/components/dashboard/page-header";
import { WidgetSettings } from "@/components/dashboard/widget-settings";
import { WidgetInstallsPanel } from "@/components/dashboard/widget-installs-panel";
import { getWidgetConfig } from "@/lib/db/widget.server";
import { getSpaSettings } from "@/lib/db/settings.server";
import { getCurrentSubscription } from "@/lib/subscription";
import { listWidgetInstalls } from "@/lib/widget/installs";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Widget | AivaSpa Dashboard",
  description: "Customize the AivaSpa chat widget — appearance, greeting, lead capture, and install.",
};

export default async function WidgetPage() {
  const [widget, spa, subscription, supabase] = await Promise.all([
    getWidgetConfig().catch(() => null),
    getSpaSettings().catch(() => null),
    getCurrentSubscription(),
    createClient(),
  ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const installs = user ? await listWidgetInstalls(user.id) : [];

  // Compute site URL for the install snippet
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;

  const plan = (await import("@/lib/subscription/plans")).PLANS[subscription.planId];
  const unlimited = plan.maxWidgets === Number.MAX_SAFE_INTEGER;
  const usedCount = installs.filter((i) => i.active).length;

  return (
    <>
      <DashboardHeader />
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
        <PageHeader
          title="Widget"
          description="Customize how AivaSpa looks and behaves on your website."
        />

        <div className="mb-6">
          <WidgetInstallsPanel
            initialInstalls={installs}
            planName={plan.name}
            maxWidgets={plan.maxWidgets}
            usedCount={usedCount}
            unlimited={unlimited}
            siteUrl={siteUrl}
          />
        </div>

        <WidgetSettings
          initialConfig={widget}
          initialWebsite={spa?.website ?? ""}
        />
      </div>
    </>
  );
}
