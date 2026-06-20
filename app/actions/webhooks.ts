"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  WEBHOOK_EVENTS,
  deliverToWebhook,
  generateWebhookSecret,
  isValidWebhookUrl,
  listWebhooks,
  type WebhookEvent,
} from "@/lib/webhooks";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readEvents(formData: FormData): WebhookEvent[] {
  const raw = formData.getAll("events").map(String);
  return (WEBHOOK_EVENTS as readonly string[]).filter(
    (e): e is WebhookEvent => raw.includes(e),
  );
}

export type WebhookResult = { ok: boolean; error?: string; webhookId?: string };

export async function createWebhookAction(
  formData: FormData,
): Promise<WebhookResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/dashboard/settings?section=api");

  const url = readString(formData, "url");
  const description = readString(formData, "description");
  const events = readEvents(formData);

  if (!isValidWebhookUrl(url)) {
    return {
      ok: false,
      error: "Please enter a valid public HTTP(S) URL (not localhost or an internal host).",
    };
  }
  if (events.length === 0) {
    return { ok: false, error: "Subscribe to at least one event." };
  }

  const { data, error } = await supabase
    .from("webhooks")
    .insert({
      user_id: user.id,
      url,
      description,
      events,
      secret: generateWebhookSecret(),
      active: true,
    } as never)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings");
  return { ok: true, webhookId: (data as { id: string }).id };
}

export async function toggleWebhookAction(
  id: string,
  active: boolean,
): Promise<WebhookResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("webhooks")
    .update({ active, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings");
  return { ok: true, webhookId: id };
}

export async function deleteWebhookAction(
  id: string,
): Promise<WebhookResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("webhooks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function testWebhookAction(
  id: string,
): Promise<WebhookResult & { status?: number; durationMs?: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const hooks = await listWebhooks(user.id);
  const hook = hooks.find((h) => h.id === id);
  if (!hook) return { ok: false, error: "Webhook not found." };

  const payload = {
    test: true,
    message: "This is a test event from AivaSpa",
  };
  const result = await deliverToWebhook(hook, "lead.created", payload);

  await supabase.from("webhook_deliveries").insert({
    webhook_id: hook.id,
    user_id: user.id,
    event: "lead.created",
    payload: { event: "lead.created", data: payload, test: true } as never,
    response_status: result.status ?? null,
    response_body: result.body ?? null,
    success: result.ok,
    attempt: 1,
    duration_ms: result.durationMs,
    error: result.error ?? null,
    delivered_at: new Date().toISOString(),
  } as never);

  if (!result.ok) {
    return {
      ok: false,
      error: result.error ?? `Webhook returned ${result.status ?? "no response"}`,
      status: result.status,
      durationMs: result.durationMs,
    };
  }
  revalidatePath("/dashboard/settings");
  return {
    ok: true,
    webhookId: id,
    status: result.status,
    durationMs: result.durationMs,
  };
}

export async function rotateWebhookSecretAction(
  id: string,
): Promise<WebhookResult & { secret?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const secret = generateWebhookSecret();
  const { error } = await supabase
    .from("webhooks")
    .update({ secret, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings");
  return { ok: true, webhookId: id, secret };
}
