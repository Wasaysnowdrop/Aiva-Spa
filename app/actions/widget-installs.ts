"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createWidgetInstall, deleteWidgetInstall } from "@/lib/widget/installs";
import { checkActionLimit } from "@/lib/security/check-action-limit";
import { LIMITS } from "@/lib/security/limits";

export type WidgetInstallActionResult = {
  ok: boolean;
  error?: string;
  code?: "limit" | "duplicate" | "no_active_subscription" | "invalid";
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function addWidgetInstallAction(
  formData: FormData,
): Promise<WidgetInstallActionResult> {
  const limit = await checkActionLimit(LIMITS.actionWidgetInstalls)
  if (!limit.ok) return { ok: false, error: limit.error }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/dashboard/widget");

  const domain = readString(formData, "domain");
  const label = readString(formData, "label");

  const result = await createWidgetInstall(user.id, { domain, label });
  if (!result.ok) {
    return { ok: false, error: result.error, code: result.code };
  }
  revalidatePath("/dashboard/widget");
  return { ok: true };
}

export async function removeWidgetInstallAction(
  installId: string,
): Promise<{ ok: boolean; error?: string }> {
  const limit = await checkActionLimit(LIMITS.actionWidgetInstalls)
  if (!limit.ok) return { ok: false, error: limit.error }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const result = await deleteWidgetInstall(user.id, installId);
  revalidatePath("/dashboard/widget");
  return result;
}
