import type { Metadata } from "next";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsView } from "@/components/dashboard/settings-view";
import { createClient } from "@/lib/supabase/server";
import { getCardLast4, getCurrentSubscription } from "@/lib/subscription";
import { listApiKeys } from "@/app/actions/api-keys";

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
  const isUnlimited = subscription.quota === Number.MAX_SAFE_INTEGER;
  const periodStart = subscription.row?.periodStart ?? new Date().toISOString();
  const periodEnd = subscription.row?.periodEnd ?? new Date().toISOString();
  const trialStartedAt = subscription.row?.trialStartedAt ?? null;

  // API section data
  const apiKeys = await listApiKeys().catch(() => [])
  let rawWebhooks: unknown[] = []
  try {
    const { data } = await supabase
      .from("webhooks")
      .select("*")
      .order("created_at", { ascending: false })
    rawWebhooks = (data ?? []) as unknown[]
  } catch {
    rawWebhooks = []
  }
  let rawDeliveries: unknown[] = []
  try {
    const { data } = await supabase
      .from("webhook_deliveries")
      .select("id, webhook_id, event, response_status, success, attempt, duration_ms, delivered_at, created_at, error")
      .order("created_at", { ascending: false })
      .limit(25)
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

  return (
    <>
      <DashboardHeader />
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 lg:px-8">
        <PageHeader
          title="Settings"
          description="Account, notifications, integrations, privacy, billing, and developer settings."
        />
        <SettingsView
          billing={{
            planId: subscription.planId,
            planName: subscription.planName,
            status: subscription.status,
            billingInterval: subscription.row?.billingInterval ?? "monthly",
            monthlyQuota: subscription.quota,
            used: subscription.used,
            periodStart,
            periodEnd,
            trialStartedAt,
            trialEndsAt: subscription.trialEndsAt ? subscription.trialEndsAt.toISOString() : null,
            trialDaysRemaining: subscription.trialDaysRemaining,
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
