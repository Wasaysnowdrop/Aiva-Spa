import type { Metadata } from "next";
import { headers } from "next/headers";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { GuideView } from "@/components/dashboard/guide-view";
import { PageHeader } from "@/components/dashboard/page-header";
import { getWidgetConfig } from "@/lib/db/widget.server";
import { getSpaSettings } from "@/lib/db/settings.server";
import { listWidgetInstalls } from "@/lib/widget/installs";
import { getLatestWidgetVerification } from "@/lib/widget/installation-checks.server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Install Guide | AivaSpa Dashboard",
  description:
    "Add the AivaSpa chat widget to any website. Copy the snippet, paste it before the closing body tag, and you're live.",
};

export default async function GuidePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [widget, spa, installs] = await Promise.all([
    getWidgetConfig().catch(() => null),
    getSpaSettings().catch(() => null),
    user ? listWidgetInstalls(user.id) : Promise.resolve([]),
  ]);

  const primaryInstall = installs.find((install) => install.active) ?? installs[0];
  const latestVerification = user && primaryInstall
    ? await getLatestWidgetVerification(user.id, primaryInstall.widgetKey)
    : null;

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;

  return (
    <>
      <DashboardHeader />
      <div className="mx-auto w-full max-w-5xl px-5 pb-16 pt-8 lg:px-8">
        <PageHeader
          title="Install Guide"
          description="Add the AivaSpa chat widget to any website in under five minutes. Copy the snippet, paste it before the closing body tag, and you're live."
        />
        <GuideView
          installs={installs}
          siteUrl={siteUrl}
          website={spa?.website ?? ""}
          brandName={widget?.brandName ?? "your spa"}
          spaTimezone={widget?.workingHours?.tz ?? "America/Los_Angeles"}
          latestVerification={latestVerification}
        />
      </div>
    </>
  );
}
