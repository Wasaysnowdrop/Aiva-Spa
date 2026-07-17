import type { Metadata } from "next";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsView } from "@/components/dashboard/settings-view";
import { createClient } from "@/lib/supabase/server";
import { getCardLast4, getCurrentSubscription, backfillConversationsFromSessions } from "@/lib/subscription";
import {
  getNotificationChannelsServer,
  getNotificationLogsServer,
} from "@/lib/db/notifications.server";
import { getSpaSettings } from "@/lib/db/settings.server";
import type {
  NotificationChannelConfig,
  NotificationLog,
  SpaSettings,
} from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Settings | AivaSpa Dashboard",
  description: "Manage account, email notifications, privacy, and billing.",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const subscription = await getCurrentSubscription();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userMeta = (user?.user_metadata as Record<string, unknown> | null) ?? null;
  const cardLast4 = getCardLast4(userMeta);

  // Backfill quota from real chat_sessions so returning users see
  // their actual usage, not 0. Then re-read the subscription so the
  // page renders the corrected count without a manual refresh.
  if (user?.id) {
    try {
      await backfillConversationsFromSessions(user.id)
    } catch (e) {
      console.error("backfillConversationsFromSessions failed", e)
    }
  }
  const refreshedSubscription = user?.id ? await getCurrentSubscription() : subscription
  const isUnlimited = refreshedSubscription.quota === Number.MAX_SAFE_INTEGER;
  const periodStart = refreshedSubscription.row?.periodStart ?? new Date().toISOString();
  const periodEnd = refreshedSubscription.row?.periodEnd ?? new Date().toISOString();
  const trialStartedAt = refreshedSubscription.row?.trialStartedAt ?? null;

  let initialChannels: NotificationChannelConfig[] = []
  let initialLogs: NotificationLog[] = []
  let initialSpaSettings: SpaSettings | null = null
  const accountEmail: string | null = user?.email ?? null
  try {
    const [channels, logs, spa] = await Promise.all([
      getNotificationChannelsServer(),
      getNotificationLogsServer(),
      getSpaSettings(),
    ])
    initialChannels = channels ?? []
    initialLogs = logs ?? []
    initialSpaSettings = spa ?? null
  } catch (e) {
    console.error("[settings] failed to pre-load notification data:", e)
  }

  return (
    <>
      <DashboardHeader />
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
        <PageHeader
          title="Settings"
          description="Account, email notifications, privacy, and billing settings."
        />
        <SettingsView
          accountEmail={accountEmail}
          initialSpaSettings={initialSpaSettings}
          initialChannels={initialChannels}
          initialLogs={initialLogs}
          billing={{
            planId: refreshedSubscription.planId,
            planName: refreshedSubscription.planName,
            status: refreshedSubscription.status,
            billingInterval: refreshedSubscription.row?.billingInterval ?? "monthly",
            monthlyQuota: refreshedSubscription.quota,
            used: refreshedSubscription.used,
            periodStart,
            periodEnd,
            trialStartedAt,
            trialEndsAt: refreshedSubscription.trialEndsAt ? refreshedSubscription.trialEndsAt.toISOString() : null,
            trialDaysRemaining: refreshedSubscription.trialDaysRemaining,
            cardLast4,
            isUnlimited,
            pendingPlan: refreshedSubscription.row?.pendingPlan ?? null,
            pendingPlanEffectiveAt: refreshedSubscription.row?.pendingPlanEffectiveAt ?? null,
          }}
        />
      </div>
    </>
  );
}
