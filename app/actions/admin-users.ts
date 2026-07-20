"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPermission } from "@/lib/admin/auth";
import { checkActionLimit } from "@/lib/security/check-action-limit";
import { LIMITS } from "@/lib/security/limits";
import { isEmailAllowedAsAdmin } from "@/lib/admin/allowlist";

export type AdminUserResult =
  | { ok: true }
  | { ok: false; error: string };

async function recordAdminAudit(
  action: string,
  target: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const admin = createAdminClient();
    const h = await headers();
    await admin.from("admin_audit_log").insert({
      admin_user_id: String(metadata.actorUserId ?? ""),
      admin_email: String(metadata.actorEmail ?? "system"),
      action,
      target,
      metadata: Object.fromEntries(Object.entries(metadata).filter(([key]) => !key.startsWith("actor"))),
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: h.get("user-agent")?.slice(0, 500) ?? null,
    } as never);
  } catch (e) {
    console.error("[admin-users] audit log failed", e);
  }
}

async function loadUser(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    return {
      user: null,
      error: error?.message ?? "User not found",
    };
  }
  return { user: data.user, error: null };
}

function nextMetadata(
  current: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(current ?? {}), ...patch };
}

// ---------------------------------------------------------------------------
// Ban
// ---------------------------------------------------------------------------
export async function banUserAction(
  userId: string,
  reason: string,
): Promise<AdminUserResult> {
  const auth = await requireAdminPermission("users:write");
  if (!auth.ok) return { ok: false, error: auth.error };

  const limit = await checkActionLimit(LIMITS.actionAdminUsers);
  if (!limit.ok) return { ok: false, error: limit.error };

  if (userId === auth.admin.id) {
    return { ok: false, error: "You cannot ban yourself." };
  }

  const { user, error: loadErr } = await loadUser(userId);
  if (loadErr || !user) return { ok: false, error: loadErr ?? "User not found" };

  if ((user.app_metadata as { banned?: boolean } | null)?.banned) {
    return { ok: false, error: "User is already banned." };
  }

  const admin = createAdminClient();
  const cleanedReason = reason.trim().slice(0, 500);

  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: nextMetadata(user.app_metadata, {
      banned: true,
      banned_at: new Date().toISOString(),
      banned_by: auth.admin.id,
      banned_by_email: auth.admin.email,
      ban_reason: cleanedReason || null,
    }),
  });
  if (updateErr) return { ok: false, error: updateErr.message };

  // Force the user to refresh their JWT and lose their session.
  try {
    await admin.auth.admin.signOut(userId);
  } catch (e) {
    console.warn("[admin-users] signOut on ban failed (non-fatal)", e);
  }

  const { error: insertErr } = await admin.from("banned_users").upsert(
    {
      user_id: userId,
      email: user.email ?? null,
      reason: cleanedReason || null,
      banned_by: auth.admin.id,
      banned_by_email: auth.admin.email,
      banned_at: new Date().toISOString(),
      unbanned_at: null,
      unbanned_by: null,
      unbanned_by_email: null,
    } as never,
    { onConflict: "user_id" },
  );
  if (insertErr) console.error("[admin-users] banned_users upsert failed", insertErr);

  await recordAdminAudit("user.ban", userId, { actorUserId: auth.admin.id, actorEmail: auth.admin.email,
    email: user.email,
    reason: cleanedReason || null,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Unban
// ---------------------------------------------------------------------------
export async function unbanUserAction(
  userId: string,
): Promise<AdminUserResult> {
  const auth = await requireAdminPermission("users:write");
  if (!auth.ok) return { ok: false, error: auth.error };

  const limit = await checkActionLimit(LIMITS.actionAdminUsers);
  if (!limit.ok) return { ok: false, error: limit.error };

  const { user, error: loadErr } = await loadUser(userId);
  if (loadErr || !user) return { ok: false, error: loadErr ?? "User not found" };

  if (!(user.app_metadata as { banned?: boolean } | null)?.banned) {
    return { ok: false, error: "User is not banned." };
  }

  const admin = createAdminClient();
  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: nextMetadata(user.app_metadata, {
      banned: false,
      banned_at: null,
      banned_by: null,
      banned_by_email: null,
      ban_reason: null,
    }),
  });
  if (updateErr) return { ok: false, error: updateErr.message };

  const { error: updateRowErr } = await admin
    .from("banned_users")
    .update({
      unbanned_at: new Date().toISOString(),
      unbanned_by: auth.admin.id,
      unbanned_by_email: auth.admin.email,
    } as never)
    .eq("user_id", userId)
    .is("unbanned_at", null);
  if (updateRowErr)
    console.error("[admin-users] banned_users update failed", updateRowErr);

  await recordAdminAudit("user.unban", userId, { actorUserId: auth.admin.id, actorEmail: auth.admin.email, email: user.email });
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
export async function deleteUserAction(
  userId: string,
): Promise<AdminUserResult> {
  const auth = await requireAdminPermission("users:write");
  if (!auth.ok) return { ok: false, error: auth.error };

  const limit = await checkActionLimit(LIMITS.actionAdminUsers);
  if (!limit.ok) return { ok: false, error: limit.error };

  if (userId === auth.admin.id) {
    return { ok: false, error: "You cannot delete your own admin account." };
  }

  const { user, error: loadErr } = await loadUser(userId);
  if (loadErr || !user) return { ok: false, error: loadErr ?? "User not found" };

  const admin = createAdminClient();
  const targetIsAdmin = Boolean(
    (user.app_metadata as { is_admin?: boolean } | null)?.is_admin,
  );
  if (targetIsAdmin) {
    // Don't allow removing the last allowed admin — count remaining admins
    // who are also email-allowlisted.
    const { data, error: listErr } = await admin.auth.admin.listUsers({
      perPage: 200,
    });
    if (listErr) return { ok: false, error: listErr.message };
    const remainingAllowed = (data?.users ?? []).filter(
      (u) =>
        u.id !== userId &&
        (u.app_metadata as { is_admin?: boolean } | null)?.is_admin &&
        isEmailAllowedAsAdmin(u.email),
    );
    if (remainingAllowed.length === 0) {
      return {
        ok: false,
        error:
          "Refusing to delete the last admin in the allowlist. Promote someone else first.",
      };
    }
  }

  const email = user.email;
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) return { ok: false, error: delErr.message };

  await recordAdminAudit("user.delete", userId, { actorUserId: auth.admin.id, actorEmail: auth.admin.email, email });
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Toggle admin flag
// ---------------------------------------------------------------------------
export async function setAdminFlagAction(
  userId: string,
  isAdmin: boolean,
): Promise<AdminUserResult> {
  const auth = await requireAdminPermission("users:write");
  if (!auth.ok) return { ok: false, error: auth.error };

  const limit = await checkActionLimit(LIMITS.actionAdminUsers);
  if (!limit.ok) return { ok: false, error: limit.error };

  if (userId === auth.admin.id) {
    return { ok: false, error: "You cannot change your own admin flag." };
  }

  const { user, error: loadErr } = await loadUser(userId);
  if (loadErr || !user) return { ok: false, error: loadErr ?? "User not found" };

  if (isAdmin && !isEmailAllowedAsAdmin(user.email)) {
    return {
      ok: false,
      error:
        "This email is not in the admin allowlist. Update the allowlist before promoting.",
    };
  }

  if (!isAdmin) {
    // Don't allow demoting the last allowed admin.
    const admin = createAdminClient();
    const { data, error: listErr } = await admin.auth.admin.listUsers({
      perPage: 200,
    });
    if (listErr) return { ok: false, error: listErr.message };
    const remaining = (data?.users ?? []).filter(
      (u) =>
        u.id !== userId &&
        (u.app_metadata as { is_admin?: boolean } | null)?.is_admin &&
        isEmailAllowedAsAdmin(u.email),
    );
    if (remaining.length === 0) {
      return {
        ok: false,
        error:
          "Refusing to demote the last admin in the allowlist. Promote someone else first.",
      };
    }
  }

  const admin = createAdminClient();
  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: nextMetadata(user.app_metadata, { is_admin: isAdmin }),
  });
  if (updateErr) return { ok: false, error: updateErr.message };

  // Force a JWT refresh so the new flag is honored on their next request.
  try {
    await admin.auth.admin.signOut(userId);
  } catch {
    /* non-fatal */
  }

  await recordAdminAudit(isAdmin ? "user.promote_admin" : "user.demote_admin", userId, { actorUserId: auth.admin.id, actorEmail: auth.admin.email,
    email: user.email,
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
  return { ok: true };
}

export async function revokeUserSessionsAction(userId: string): Promise<AdminUserResult> {
  const auth = await requireAdminPermission("users:write")
  if (!auth.ok) return { ok: false, error: auth.error }
  const limit = await checkActionLimit(LIMITS.actionAdminUsers)
  if (!limit.ok) return { ok: false, error: limit.error }
  if (userId === auth.admin.id) return { ok: false, error: "Use sign out for your own session." }
  const { user, error } = await loadUser(userId)
  if (error || !user) return { ok: false, error: error ?? "User not found" }
  const admin = createAdminClient()
  const { error: signOutError } = await admin.auth.admin.signOut(userId)
  if (signOutError) return { ok: false, error: "Sessions could not be revoked." }
  await recordAdminAudit("user.sessions_revoke", userId, { actorUserId: auth.admin.id, actorEmail: auth.admin.email, email: user.email })
  revalidatePath(`/admin/users/${userId}`)
  revalidatePath("/admin/audit")
  return { ok: true }
}