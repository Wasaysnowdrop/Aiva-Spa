"use server";

import { createClient } from "@/lib/supabase/server";
import { invalidateKnowledgeCache } from "@/lib/ai/retrieval";
import { recordAudit } from "@/lib/audit";

export type WidgetActionResult = { ok: boolean; error?: string };

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

export async function updateNotificationChannel(
  update: NotificationChannelUpdate,
): Promise<WidgetActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.enabled !== undefined) payload.enabled = update.enabled;
  if (update.recipients !== undefined) payload.recipients = update.recipients;

  const { error } = await supabase
    .from("notification_channels")
    .update(payload as never)
    .eq("id", update.id);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    userName: user.email?.split("@")[0] || user.id,
    action: `notifications.channel_updated ${update.id} (enabled=${update.enabled ?? "?"}, recipients=${update.recipients?.length ?? "?"})`,
  });
  return { ok: true };
}
