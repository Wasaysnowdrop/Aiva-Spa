import type { Metadata } from "next";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsView } from "@/components/dashboard/settings-view";
import { createClient } from "@/lib/supabase/server";
import { getCardLast4, getCurrentSubscription, backfillConversationsFromSessions } from "@/lib/subscription";
import { listApiKeys } from "@/app/actions/api-keys";
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
  description: "Manage account, notifications, integrations, privacy, billing, and API.",
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

  // API section data — scope everything to the signed-in user.
  const apiKeys = await listApiKeys().catch(() => [])
  const userId = user?.id ?? null
  let rawWebhooks: unknown[] = []
  try {
    const query = supabase
      .from("webhooks")
      .select("id, url, secret, events, active, description, created_at")
      .order("created_at", { ascending: false })
    const scoped = userId ? query.eq("user_id", userId) : query.eq("user_id", "00000000-0000-0000-0000-000000000000")
    const { data } = await scoped
    rawWebhooks = (data ?? []) as unknown[]
  } catch {
    rawWebhooks = []
  }
  let rawDeliveries: unknown[] = []
  try {
    const query = supabase
      .from("webhook_deliveries")
      .select("id, webhook_id, event, response_status, success, attempt, duration_ms, delivered_at, created_at, error")
      .order("created_at", { ascending: false })
      .limit(25)
    const scoped = userId ? query.eq("user_id", userId) : query.eq("user_id", "00000000-0000-0000-0000-000000000000")
    const { data } = await scoped
    rawDeliveries = (data ?? []) as unknown[]
  } catch {
    rawDeliveries = []
  }

  const initialWebhooks = (rawWebhooks ?? []).map((w) => {
    const r = w as {
      id: string
      url: string
      secret: string
      events: string[]
      active: boolean
      description: string
      created_at: string
    }
    return {
      id: r.id,
      url: r.url,
      description: r.description ?? "",
      events: r.events ?? [],
      active: r.active,
      createdAt: r.created_at,
      secret: r.secret,
    }
  })
  const initialDeliveries = (rawDeliveries ?? []).map((d) => {
    const r = d as {
      id: string
      webhook_id: string
      event: string
      response_status: number | null
      success: boolean
      attempt: number
      duration_ms: number | null
      delivered_at: string | null
      created_at: string
      error: string | null
    }
    return {
      id: r.id,
      webhook_id: r.webhook_id,
      event: r.event,
      response_status: r.response_status,
      success: r.success,
      attempt: r.attempt,
      duration_ms: r.duration_ms,
      delivered_at: r.delivered_at,
      created_at: r.created_at,
      error: r.error,
    }
  })

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
          description="Account, notifications, integrations, privacy, billing, and developer settings."
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
          }}
          api={{
            initialKeys: apiKeys,
            initialWebhooks,
            initialDeliveries,
          }}
        />
      </div>
    </>
  );
}
