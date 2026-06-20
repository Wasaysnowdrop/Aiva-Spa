"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/audit";

export type SettingsActionResult = {
  ok: boolean;
  error?: string;
};

export async function updateSpaSettings(updates: {
  spaName?: string;
  website?: string;
  ownerName?: string;
  ownerEmail?: string;
  address?: string;
}): Promise<SettingsActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const payload: Record<string, unknown> = {};
  if ("spaName" in updates) payload.spa_name = updates.spaName;
  if ("website" in updates) payload.website = updates.website;
  if ("ownerName" in updates) payload.owner_name = updates.ownerName;
  if ("ownerEmail" in updates) payload.owner_email = updates.ownerEmail;
  if ("address" in updates) payload.address = updates.address;

  const existing = await supabase
    .from("spa_settings")
    .select("id")
    .limit(1)
    .maybeSingle()
    .then((r) => r.data as { id: string } | null);
  if (!existing) {
    return { ok: false, error: "No spa settings found" };
  }

  const { error: dbError } = await supabase
    .from("spa_settings")
    .update(payload as never)
    .eq("id", existing.id)
    .select()
    .single();

  if (dbError) {
    return { ok: false, error: dbError.message };
  }

  if (updates.spaName !== undefined) {
    const admin = createAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: { ...user.user_metadata, spa_name: updates.spaName },
      },
    );
    if (authError) {
      return { ok: false, error: authError.message };
    }
  }

  await recordAudit({
    userName: user.email?.split("@")[0] || user.id,
    action: `settings.updated ${Object.keys(updates).join(",")}`,
  });

  return { ok: true };
}

export async function deleteWorkspaceAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const admin = createAdminClient();

    // Clear all data tables. The schema is single-tenant (one spa per
    // deployment), so we wipe workspace-owned data and remove the user.
    // The auth user is deleted last so cascading deletes run while the
    // user still exists. Foreign-key cascades handle the rest.
    const wipe = async (table: string, idCol: string) => {
      try {
        await admin.from(table).delete().neq(idCol, "00000000-0000-0000-0000-000000000000");
      } catch (e) {
        console.error(`delete failed for ${table}`, e);
      }
    }

    await wipe("webhook_deliveries", "id")
    await wipe("webhooks", "id")
    await wipe("api_keys", "id")
    await wipe("calendar_reminders", "id")
    await wipe("calendar_bookings", "id")
    await wipe("calendar_settings", "id")
    await wipe("widget_installs", "id")
    await wipe("subscriptions", "id")
    await wipe("leads", "id")
    await wipe("chat_sessions", "id")
    await wipe("notification_logs", "id")
    await wipe("team_members", "email")

    try {
      await admin
        .from("widget_config")
        .update({
          brand_name: "Glow Med Spa",
          logo_initial: "G",
          welcome_message: "Hi! Are you looking to book a consultation or ask about a treatment?",
          proactive_message: "Still browsing? I can answer questions or set up a consultation in seconds.",
          consent_text: "By chatting, you agree to our privacy policy. We'll only contact you about your inquiry.",
          updated_at: new Date().toISOString(),
        } as never)
        .neq("id", "00000000-0000-0000-0000-000000000000")
    } catch (e) {
      console.error("widget_config reset failed", e)
    }

    try {
      await admin
        .from("spa_settings")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000")
    } catch (e) {
      console.error("spa_settings wipe failed", e)
    }

    await recordAudit({
      userName: user.email?.split("@")[0] || user.id,
      action: "workspace.deleted",
    });

    try {
      await admin.auth.admin.deleteUser(user.id)
    } catch (e) {
      console.error("auth delete failed", e)
    }

    revalidatePath("/", "layout")
    redirect("/")
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete workspace" }
  }
}
