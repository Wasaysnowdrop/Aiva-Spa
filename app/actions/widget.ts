"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { invalidateKnowledgeCache } from "@/lib/ai/retrieval";
import { recordAudit } from "@/lib/audit";
import { checkActionLimit } from "@/lib/security/check-action-limit";
import { LIMITS } from "@/lib/security/limits";

export type WidgetActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error?: string };

type WorkingHoursInput = {
  enabled?: boolean;
  tz?: string;
  schedule?: { day: string; open: boolean; from: string; to: string }[];
};

export async function updateWidgetBranding(input: {
  brandName?: string;
  logoInitial?: string;
  bubbleLogoUrl?: string | null;
  primaryColor?: string;
  position?: "bottom-right" | "bottom-left";
  welcomeMessage?: string;
  proactiveEnabled?: boolean;
  proactiveDelaySeconds?: number;
  proactiveMessage?: string;
  showBranding?: boolean;
  collectEmail?: boolean;
  collectPhone?: boolean;
  consentText?: string;
  workingHours?: WorkingHoursInput;
}): Promise<WidgetActionResult> {
  const limit = await checkActionLimit(LIMITS.actionWidget)
  if (!limit.ok) return { ok: false, error: limit.error }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const existing = await supabase
    .from("widget_config")
    .select("id")
    .limit(1)
    .maybeSingle()
    .then((r) => r.data as { id: string } | null);
  if (!existing) return { ok: false, error: "No widget config found" };

  const payload: Record<string, unknown> = {};
  if (input.brandName !== undefined) payload.brand_name = input.brandName;
  if (input.logoInitial !== undefined) payload.logo_initial = input.logoInitial;
  if (input.primaryColor !== undefined) payload.primary_color = input.primaryColor;
  if (input.position !== undefined) payload.position = input.position;
  if (input.welcomeMessage !== undefined) payload.welcome_message = input.welcomeMessage;
  if (input.proactiveEnabled !== undefined) payload.proactive_enabled = input.proactiveEnabled;
  if (input.proactiveDelaySeconds !== undefined)
    payload.proactive_delay_seconds = input.proactiveDelaySeconds;
  if (input.proactiveMessage !== undefined) payload.proactive_message = input.proactiveMessage;
  if (input.showBranding !== undefined) payload.show_branding = input.showBranding;
  if (input.collectEmail !== undefined) payload.collect_email = input.collectEmail;
  if (input.collectPhone !== undefined) payload.collect_phone = input.collectPhone;
  if (input.consentText !== undefined) payload.consent_text = input.consentText;
  if (input.workingHours !== undefined) payload.working_hours = input.workingHours as unknown as Record<string, unknown>;
  if (input.bubbleLogoUrl !== undefined) payload.bubble_logo_url = input.bubbleLogoUrl;
  payload.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("widget_config")
    .update(payload as never)
    .eq("id", existing.id);
  if (error) return { ok: false, error: error.message };

  invalidateKnowledgeCache();

  await recordAudit({
    userName: user.email?.split("@")[0] || user.id,
    action: `widget.updated ${Object.keys(input).join(",")}`,
  });
  return { ok: true };
}

export type NotificationChannelUpdate = {
  id: string;
  enabled?: boolean;
  recipients?: string[];
};

export type CreateNotificationChannelInput = {
  channel: "email" | "sms" | "daily_summary";
  label: string;
  description?: string;
  enabled?: boolean;
  recipients?: string[];
};

export async function updateNotificationChannel(
  update: NotificationChannelUpdate,
): Promise<WidgetActionResult> {
  const limit = await checkActionLimit(LIMITS.actionWidget)
  if (!limit.ok) return { ok: false, error: limit.error }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.enabled !== undefined) payload.enabled = update.enabled;
  if (update.recipients !== undefined) payload.recipients = update.recipients;

  // Owner-scope: never let one tenant update another tenant's channel row.
  const { error } = await supabase
    .from("notification_channels")
    .update(payload as never)
    .eq("id", update.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    userName: user.email?.split("@")[0] || user.id,
    action: `notifications.channel_updated ${update.id} (enabled=${update.enabled ?? "?"}, recipients=${update.recipients?.length ?? "?"})`,
  });
  return { ok: true };
}

export async function createNotificationChannelAction(
  input: CreateNotificationChannelInput,
): Promise<WidgetActionResult<{ id: string }>> {
  const limit = await checkActionLimit(LIMITS.actionWidget)
  if (!limit.ok) return { ok: false, error: limit.error }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const channel = (input.channel ?? "").trim();
  const label = (input.label ?? "").trim();
  if (!channel) return { ok: false, error: "Channel type is required" };
  if (!label) return { ok: false, error: "Channel label is required" };

  // Look for an existing row for this channel kind scoped to THIS user.
  // (After migration 00018 the unique key is (channel, user_id), so the
  // legacy global row, if any, is no longer the right match — it's only
  // claimed below if it has a NULL user_id AND we're the first caller.)
  const { data: ownExisting } = await supabase
    .from("notification_channels")
    .select("id")
    .eq("channel", channel)
    .eq("user_id", user.id)
    .maybeSingle();
  const ownExistingRow = ownExisting as { id: string } | null;

  if (ownExistingRow?.id) {
    const recipients = Array.isArray(input.recipients) ? input.recipients : [];
    const updatePayload: Record<string, unknown> = {
      enabled: input.enabled ?? true,
      updated_at: new Date().toISOString(),
    };
    if (recipients.length > 0) {
      updatePayload.label = label;
      updatePayload.description = input.description ?? "";
      updatePayload.recipients = recipients;
    }
    const { error } = await supabase
      .from("notification_channels")
      .update(updatePayload as never)
      .eq("id", ownExistingRow.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
    await recordAudit({
      userName: user.email?.split("@")[0] || user.id,
      action: `notifications.channel_upserted ${channel} (id=${ownExistingRow.id})`,
    });
    revalidatePath("/dashboard/settings");
    return { ok: true, data: { id: ownExistingRow.id } };
  }

  // Claim any legacy NULL-user_id global row for this channel kind. This
  // preserves the behavior from before owner-scoping existed: the first
  // authenticated owner to ask for the channel adopts the row.
  const { data: legacyExisting } = await supabase
    .from("notification_channels")
    .select("id")
    .eq("channel", channel)
    .is("user_id", null)
    .maybeSingle();
  const legacyExistingRow = legacyExisting as { id: string } | null;

  if (legacyExistingRow?.id) {
    const recipients = Array.isArray(input.recipients) ? input.recipients : [];
    const updatePayload: Record<string, unknown> = {
      enabled: input.enabled ?? true,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };
    if (recipients.length > 0) {
      updatePayload.label = label;
      updatePayload.description = input.description ?? "";
      updatePayload.recipients = recipients;
    }
    const { error } = await supabase
      .from("notification_channels")
      .update(updatePayload as never)
      .eq("id", legacyExistingRow.id)
      .is("user_id", null);
    if (error) return { ok: false, error: error.message };
    await recordAudit({
      userName: user.email?.split("@")[0] || user.id,
      action: `notifications.channel_claimed ${channel} (id=${legacyExistingRow.id})`,
    });
    revalidatePath("/dashboard/settings");
    return { ok: true, data: { id: legacyExistingRow.id } };
  }

  const insertPayload = {
    channel,
    label,
    description: input.description ?? "",
    enabled: input.enabled ?? true,
    recipients: Array.isArray(input.recipients) ? input.recipients : [],
    user_id: user.id,
  };

  const { data, error } = await supabase
    .from("notification_channels")
    .insert(insertPayload as never)
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  const inserted = data as { id: string } | null;

  await recordAudit({
    userName: user.email?.split("@")[0] || user.id,
    action: `notifications.channel_created ${channel} (id=${inserted?.id})`,
  });
  revalidatePath("/dashboard/settings");
  return { ok: true, data: { id: inserted?.id ?? "" } };
}

export type SendTestNotificationInput = { recipient: string };

/**
 * Send a one-off test email so the owner can verify their address is
 * correctly wired (and that RESEND_API_KEY is set on the server). Doesn't
 * touch notification_logs — this is a manual probe, not a real dispatch.
 */
export async function sendTestNotificationAction(
  input: SendTestNotificationInput,
): Promise<WidgetActionResult<{ provider: string; id?: string }>> {
  const limit = await checkActionLimit(LIMITS.actionWidget)
  if (!limit.ok) return { ok: false, error: limit.error }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const recipient = (input.recipient ?? "").trim();
  if (!recipient) return { ok: false, error: "Recipient is required" };
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(recipient)) return { ok: false, error: "Recipient must be a valid email" };

  const { sendEmail } = await import("@/lib/notifications/email");
  const result = await sendEmail({
    to: recipient,
    subject: "AivaSpa · test notification",
    text: `Hi! This is a test message from your AivaSpa dashboard. If you're reading this, the Email channel is wired up correctly. — AivaSpa`,
    html: `<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#08090A; color:#F7F8F8; padding:24px;">
      <div style="max-width:480px; margin:0 auto; background:#121316; border:1px solid #23252A; border-radius:16px; padding:24px;">
        <h1 style="margin:0 0 8px 0; font-size:20px; color:#E2E54B;">AivaSpa · Test notification</h1>
        <p style="margin:0 0 12px 0; color:#C9CDD3; font-size:14px; line-height:1.5;">If you're reading this, the Email channel is wired up correctly and you will receive a real lead alert the next time Aiva captures one for your spa.</p>
        <p style="margin:0; color:#62666D; font-size:12px;">— AivaSpa</p>
      </div>
    </div>`,
  });

  if (!result.ok) {
    if (result.provider === "log") {
      console.info(
        `[notifications] test email (log-only) to=${recipient} — set RESEND_API_KEY to actually send`,
      );
    }
    return { ok: false, error: result.error ?? "Failed to send test" };
  }

  await recordAudit({
    userName: user.email?.split("@")[0] || user.id,
    action: `notifications.test_sent to=${recipient}`,
  });

  return { ok: true, data: { provider: result.provider, id: result.id } };
}
