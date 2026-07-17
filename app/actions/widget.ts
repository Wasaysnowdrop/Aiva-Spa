"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { invalidateKnowledgeCache } from "@/lib/ai/retrieval";
import { recordAudit } from "@/lib/audit";
import { checkActionLimit } from "@/lib/security/check-action-limit";
import { LIMITS } from "@/lib/security/limits";
import { assertPlanLimit, EntitlementError, entitlementErrorPayload, getEntitlementContextForUser, requireFeatureForUser } from "@/lib/subscription/entitlements.server";

export type WidgetActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error?: string }
  | ReturnType<typeof entitlementErrorPayload>;

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
    .select("id, primary_color, welcome_message, show_branding")
    .limit(1)
    .maybeSingle()
    .then((r) => r.data as { id: string } | null);
  if (!existing) return { ok: false, error: "No widget config found" };
  try {
    if ((input.primaryColor !== undefined && input.primaryColor !== (existing as { primary_color?: string }).primary_color) ||
        (input.welcomeMessage !== undefined && input.welcomeMessage !== (existing as { welcome_message?: string }).welcome_message)) {
      await requireFeatureForUser(user.id, "custom_widget_colors", supabase)
    }
    if (input.showBranding === false) {
      await requireFeatureForUser(user.id, "white_label", supabase)
    }
  } catch (error) {
    if (error instanceof EntitlementError) return entitlementErrorPayload(error)
    throw error
  }

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

function normalizeRecipients(
  channel: "email" | "daily_summary",
  recipients: string[],
): { ok: true; recipients: string[] } | { ok: false; error: string } {
  const normalized = [...new Set(
    recipients
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => value.toLowerCase()),
  )]
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const invalid = normalized.find((value) => !emailRe.test(value))
  if (invalid) {
    return {
      ok: false,
      error: "Enter a valid email address",
    }
  }
  return { ok: true, recipients: normalized }
}

export type NotificationChannelUpdate = {
  id: string;
  enabled?: boolean;
  recipients?: string[];
};

export type CreateNotificationChannelInput = {
  channel: "email" | "daily_summary";
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

    try {
    await requireFeatureForUser(user.id, "email_notifications", supabase)
  } catch (error) {
    if (error instanceof EntitlementError) return entitlementErrorPayload(error)
    throw error
  }
const { data: existing } = await supabase
    .from("notification_channels")
    .select("channel")
    .eq("id", update.id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (!existing) return { ok: false, error: "Notification channel not found" }
  const channel = (existing as { channel: string }).channel
  if (channel !== "email" && channel !== "daily_summary") return { ok: false, error: "Unsupported notification channel." }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.enabled !== undefined) payload.enabled = update.enabled;
  if (update.recipients !== undefined) {
    const normalized = normalizeRecipients(channel, update.recipients)
    if (!normalized.ok) return normalized
    const context = await getEntitlementContextForUser(user.id, supabase)
    try {
      assertPlanLimit(context, "staffEmailRecipients", 0, normalized.recipients.length)
    } catch (error) {
      if (error instanceof EntitlementError) return entitlementErrorPayload(error)
      throw error
    }
    payload.recipients = normalized.recipients
  }

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

    try {
    await requireFeatureForUser(user.id, "email_notifications", supabase)
  } catch (error) {
    if (error instanceof EntitlementError) return entitlementErrorPayload(error)
    throw error
  }
const channel = (input.channel ?? "").trim() as "email" | "daily_summary";
  const label = (input.label ?? "").trim();
  if (!channel) return { ok: false, error: "Channel type is required" };
  if (channel !== "email" && channel !== "daily_summary") return { ok: false, error: "Unsupported notification channel." };
  if (!label) return { ok: false, error: "Channel label is required" };
  const normalized = normalizeRecipients(channel, input.recipients ?? [])
  if (!normalized.ok) return normalized
  const context = await getEntitlementContextForUser(user.id, supabase)
  try {
    assertPlanLimit(context, "staffEmailRecipients", 0, normalized.recipients.length)
  } catch (error) {
    if (error instanceof EntitlementError) return entitlementErrorPayload(error)
    throw error
  }
  input = { ...input, recipients: normalized.recipients }

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

export type SendTestNotificationInput = { recipient?: string };

export async function sendTestNotificationAction(
  input: SendTestNotificationInput = {},
): Promise<WidgetActionResult<{ provider: string; count: number; id?: string }>> {
  const limit = await checkActionLimit(LIMITS.actionWidget)
  if (!limit.ok) return { ok: false, error: limit.error }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: channelRow, error: channelError } = await supabase
    .from("notification_channels")
    .select("recipients")
    .eq("user_id", user.id)
    .eq("channel", "email")
    .eq("enabled", true)
    .maybeSingle()
  if (channelError) return { ok: false, error: "Could not load the Email channel" }

  const recipients = normalizeRecipients(
    "email",
    Array.isArray((channelRow as { recipients?: unknown } | null)?.recipients)
      ? ((channelRow as unknown as { recipients: string[] }).recipients)
      : [],
  )
  if (!recipients.ok) return recipients
  if (recipients.recipients.length === 0) {
    return { ok: false, error: "Add at least one recipient to the Email channel first" }
  }

  const requested = (input.recipient ?? "").trim().toLowerCase()
  if (requested && !recipients.recipients.includes(requested)) {
    return { ok: false, error: "Test recipient must be configured on the Email channel" }
  }
  const targets = requested ? [requested] : recipients.recipients
  const { sendEmail } = await import("@/lib/notifications/email");
  const admin = createAdminClient()

  let delivered = 0
  let provider = "log"
  let lastId: string | undefined
  let lastError: string | undefined
  for (const recipient of targets) {
    const result = await sendEmail({
      to: recipient,
      subject: "AivaSpa · test notification",
      text: "Hi! This is a test message from your AivaSpa dashboard. If you're reading this, the Email channel is wired up correctly.",
      html: "<div style=\"font-family: sans-serif; background:#08090A; color:#F7F8F8; padding:24px\"><div style=\"max-width:480px;margin:0 auto;background:#121316;border:1px solid #23252A;border-radius:16px;padding:24px\"><h1 style=\"color:#E2E54B\">AivaSpa · Test notification</h1><p>If you're reading this, your Email channel is wired up correctly.</p></div></div>",
    })
    provider = result.provider
    lastId = result.id
    lastError = result.ok ? undefined : result.error
    if (result.ok) delivered += 1

    const { error: logError } = await admin.from("notification_logs").insert({
      user_id: user.id,
      lead_id: null,
      lead_name: "Test notification",
      channel: "Email",
      recipient,
      status: result.ok ? "delivered" : "failed",
      detail: result.ok ? {} : { error: result.error ?? "Provider failure", test: true },
    } as never)
    if (logError) {
      console.error("[notifications] failed to log test delivery", {
        code: logError.code,
        message: logError.message,
      })
    }
  }

  await recordAudit({
    userName: user.email?.split("@")[0] || user.id,
    action: "notifications.test_sent count=" + delivered,
  });
  revalidatePath("/dashboard/settings")

  if (delivered !== targets.length) {
    return { ok: false, error: lastError ?? "One or more test notifications failed. Check Recent notifications." }
  }
  return { ok: true, data: { provider, count: delivered, id: lastId } };
}