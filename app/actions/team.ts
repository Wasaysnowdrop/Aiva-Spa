"use server";
import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/notifications/email";
import { checkActionLimit } from "@/lib/security/check-action-limit";
import { LIMITS } from "@/lib/security/limits";
import type { TeamRole } from "@/lib/supabase/types";

export type TeamActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

function buildInviteToken() {
  return "invite_" + randomBytes(24).toString("hex");
}

export async function inviteTeamMemberAction(input: {
  email: string;
  name?: string;
  role: TeamRole;
  phone?: string;
}): Promise<TeamActionResult<{ id: string; inviteUrl: string }>> {
  const limit = await checkActionLimit(LIMITS.actionTeam)
  if (!limit.ok) return { ok: false, error: limit.error }

  const user = await requireUser();
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "A valid email is required." };
  }
  if (!input.role) {
    return { ok: false, error: "Pick a role for this teammate." };
  }
  if (input.role === "Owner") {
    return { ok: false, error: "You can't invite another Owner." };
  }

  try {
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("team_members")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();

    if (existing && (existing as { status?: string }).status === "active") {
      return {
        ok: false,
        error: "This person is already on your team.",
      };
    }

    const inviteToken = buildInviteToken();
    const displayName =
      input.name?.trim() || email.split("@")[0].replace(/[._-]+/g, " ");

    let row: { id: string } | null = null;

    if (existing) {
      const { data, error } = await supabase
        .from("team_members")
        .update({
          name: displayName,
          role: input.role,
          phone: input.phone?.trim() || null,
          status: "invited",
          last_active_at: null,
        } as never)
        .eq("id", (existing as { id: string }).id)
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      row = data as { id: string };
    } else {
      const { data, error } = await supabase
        .from("team_members")
        .insert({
          name: displayName,
          email,
          role: input.role,
          phone: input.phone?.trim() || null,
          status: "invited",
        } as never)
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      row = data as { id: string };
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const inviteUrl = `${siteUrl}/invite/${inviteToken}`;

    // Best-effort invite email. Failure to send doesn't fail the action —
    // the dashboard still gets the invite URL to copy/share manually.
    try {
      const result = await sendEmail({
        to: email,
        subject: `${user.email?.split("@")[0] || "A teammate"} invited you to AivaSpa`,
        text: `You've been invited to join ${user.email ?? "an AivaSpa workspace"} as ${input.role}.\n\nAccept the invite: ${inviteUrl}\n\nIf you weren't expecting this, you can ignore the email.`,
      })
      if (!result.ok) {
        console.warn("[team] invite email not sent:", result.error)
      }
    } catch (e) {
      console.warn("[team] invite email send threw:", e)
    }

    void recordAudit({
      userName: user.email?.split("@")[0] || user.id,
      action: `team.invited ${email} as ${input.role}`,
    });

    revalidatePath("/dashboard/team");

    return {
      ok: true,
      data: { id: row.id, inviteUrl },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to send invite",
    };
  }
}

export async function updateTeamMemberRoleAction(
  id: string,
  role: TeamRole,
): Promise<TeamActionResult> {
  const user = await requireUser();
  if (role === "Owner") {
    return { ok: false, error: "Can't promote to Owner." };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("team_members")
      .update({ role, updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    void recordAudit({
      userName: user.email?.split("@")[0] || user.id,
      action: `team.role_changed ${id} -> ${role}`,
    });
    revalidatePath("/dashboard/team");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function removeTeamMemberAction(
  id: string,
): Promise<TeamActionResult> {
  const user = await requireUser();
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("team_members").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    void recordAudit({
      userName: user.email?.split("@")[0] || user.id,
      action: `team.removed ${id}`,
    });
    revalidatePath("/dashboard/team");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
