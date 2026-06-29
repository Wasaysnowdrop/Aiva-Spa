import * as React from "react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardDrawerProvider } from "@/components/dashboard/dashboard-drawer-context";
import { MobileSidebarDrawer } from "@/components/dashboard/dashboard-sidebar";
import { Paywall } from "@/components/billing/paywall";
import { QuotaBanner } from "@/components/billing/quota-banner";
import { TrialPopup } from "@/components/billing/trial-popup";
import { PricingModal } from "@/components/billing/pricing-modal";
import {
  getCurrentSubscription,
  shouldShowTrialPopup,
  deriveSnapshot,
} from "@/lib/subscription";
import type { SubscriptionSnapshot } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=%2Fdashboard");
  }

  // Defense in depth: the proxy.ts should already have blocked banned
  // users before this runs, but if a banned user lands here via a
  // server action or cached page, sign them out and bounce them to
  // the login screen with a clear message.
  if ((user.app_metadata as { banned?: boolean } | null)?.banned) {
    await supabase.auth.signOut().catch(() => null);
    redirect("/login?error=banned");
  }

  // Defense in depth: redirect users who haven't completed onboarding
  // to /onboarding. proxy.ts should already handle this, but if a user
  // bypasses the middleware (e.g., server action), catch them here.
  const onboardingCompleted =
    (user.user_metadata as Record<string, unknown> | null | undefined)
      ?.onboarding_completed === true;
  if (!onboardingCompleted) {
    redirect("/onboarding");
  }

  let subscription: SubscriptionSnapshot
  try {
    subscription = await getCurrentSubscription()
  } catch (e) {
    console.error("[dashboard-layout] getCurrentSubscription failed:", e)
    subscription = deriveSnapshot(null)
  }

  const sidebarUser = {
    fullName:
      (user?.user_metadata?.full_name as string | undefined) ??
      (user?.user_metadata?.name as string | undefined) ??
      null,
    email: user?.email ?? null,
    spaName:
      (user?.user_metadata?.spa_name as string | undefined) ?? "Your med spa",
    planName: subscription.isActive ? subscription.planName : null,
    planId: subscription.isActive ? subscription.planId : null,
    planStatus: subscription.status,
    trialDaysRemaining: subscription.trialDaysRemaining,
  };

  const showPaywall = subscription.isLocked;
  const showQuotaBanner = subscription.isActive && subscription.isQuotaExhausted;
  const showTrialPopup = shouldShowTrialPopup(subscription);

  return (
    <DashboardDrawerProvider>
      <div className="flex min-h-screen bg-[#08090A] text-[#F7F8F8]">
        <DashboardSidebar user={sidebarUser} />
        <MobileSidebarDrawer user={sidebarUser} />
        <div className="flex min-w-0 flex-1 flex-col">
          {showQuotaBanner ? (
            <QuotaBanner
              planName={subscription.planName}
              used={subscription.used}
              quota={subscription.quota}
            />
          ) : null}
          {children}
          {showTrialPopup && subscription.row ? (
            <TrialPopup
              planName={subscription.planName}
              daysRemaining={subscription.trialDaysRemaining}
              endsAtIso={subscription.row.trialEndsAt ?? ""}
              trialUsed={subscription.row.trialUsed ?? false}
            />
          ) : null}
          {showPaywall ? <Paywall spaName={sidebarUser.spaName ?? ""} trialUsed={subscription.row?.trialUsed ?? true} /> : null}
          <Suspense fallback={null}>
            <PricingModal subscription={subscription} />
          </Suspense>
        </div>
      </div>
    </DashboardDrawerProvider>
  );
}
