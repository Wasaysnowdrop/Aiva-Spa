"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRateLimited, recordRequest } from "@/lib/rate-limit";
import { ensureTrialSubscription } from "@/lib/subscription";
import { buildWelcomeEmail, sendEmail } from "@/lib/notifications/email";

export type AuthResult = {
  ok: boolean;
  error?: string;
  message?: string;
  url?: string;
  redirectTo?: string;
};

const RESET_COOLDOWN_MS = 60_000;
const RESEND_COOLDOWN_MS = 5 * 60_000;
const MAX_RESET_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

const hourlyCounters = new Map<string, { count: number; resetAt: number }>();

function checkHourlyLimit(key: string, max: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = hourlyCounters.get(key);
  if (!bucket || bucket.resetAt <= now) {
    hourlyCounters.set(key, { count: 1, resetAt: now + HOUR_MS });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (bucket.count >= max) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function getOrigin(headersList: Awaited<ReturnType<typeof headers>>): string {
  const fromHeader = headersList.get("origin");
  if (fromHeader && fromHeader.startsWith("http")) return fromHeader;
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv && fromEnv.startsWith("http")) return fromEnv;
  return getSiteUrl();
}

export async function signInWithPassword(
  email: string,
  password: string,
  redirectTo?: string,
): Promise<AuthResult> {
  const supabase = await createClient();
  let error: { message: string } | null = null;
  try {
    const result = await supabase.auth.signInWithPassword({ email, password });
    error = result.error;
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; message?: string } };
    console.error("[signInWithPassword] thrown:", err.message, "cause:", err.cause?.code, err.cause?.message);
    return {
      ok: false,
      error:
        err.cause?.code === "ECONNRESET" || err.cause?.code === "ENOTFOUND" || err.cause?.code === "ETIMEDOUT"
          ? "Couldn't reach the auth server. Please try again in a moment."
          : "Could not sign in right now. Please try again.",
    };
  }

  if (error) {
    return { ok: false, error: error.message };
  }

  // Resolve the post-login destination. Prefer the explicit redirectTo from
  // the login form (e.g. /admin), otherwise infer from the user's role:
  // admins default to /admin, everyone else goes to /dashboard.
  let safeRedirect = redirectTo && redirectTo.startsWith("/") ? redirectTo : "";
  if (!safeRedirect) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const isAdmin = Boolean(
        (user?.app_metadata as { is_admin?: boolean } | null)?.is_admin,
      );
      safeRedirect = isAdmin ? "/admin" : "/dashboard";
    } catch {
      safeRedirect = "/dashboard";
    }
  }

  return { ok: true, redirectTo: safeRedirect };
}

export async function signUpWithPassword(
  email: string,
  password: string,
  fullName: string,
  spaName?: string,
): Promise<AuthResult> {
  // Server-side password length check. The client form also enforces this,
  // but we re-check here so a crafted request can't bypass it.
  if (typeof password !== "string" || password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." }
  }
  if (typeof email !== "string" || email.trim().length === 0) {
    return { ok: false, error: "Email is required." }
  }
  if (typeof fullName !== "string" || fullName.trim().length < 2) {
    return { ok: false, error: "Please enter your full name." }
  }

  const supabase = await createClient();
  const headerList = await headers();
  const origin = getOrigin(headerList);

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/onboarding")}`,
      data: {
        full_name: fullName.trim(),
        spa_name: spaName?.trim() || null,
        onboarding_completed: false,
        onboarding_started_at: new Date().toISOString(),
      },
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data.user) {
    try {
      await ensureTrialSubscription(data.user.id);
    } catch (e) {
      console.error("ensureTrialSubscription after signup failed", e);
    }

    // Welcome email (best-effort, fire-and-forget). Supabase already sends
    // its own confirmation email — this is the branded "welcome to AivaSpa"
    // message from us, sent via Resend.
    try {
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>
      const welcomeFullName =
        typeof meta.full_name === "string" && meta.full_name.trim().length > 0
          ? meta.full_name
          : fullName.trim()
      const welcomeSpaName =
        typeof meta.spa_name === "string" ? meta.spa_name : (spaName ?? null)
      const { subject, text, html } = buildWelcomeEmail({
        fullName: welcomeFullName,
        spaName: welcomeSpaName,
        loginUrl: `${origin}/login`,
      })
      void sendEmail({
        to: data.user.email ?? email.trim().toLowerCase(),
        subject,
        text,
        html,
      }).catch((e) => console.error("welcome email send failed", e))
    } catch (e) {
      console.error("buildWelcomeEmail failed", e)
    }
  }

  if (data.session) {
    redirect("/onboarding");
  }

  redirect(
    `/check-email?email=${encodeURIComponent(email)}`,
  );
}

export async function signInWithOAuth(
  provider: "google",
  redirectTo?: string,
): Promise<AuthResult> {
  const supabase = await createClient();
  const headerList = await headers();
  const origin = getOrigin(headerList);

  const next = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/dashboard";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data.url) {
    return { ok: true, url: data.url };
  }

  return { ok: false, error: "Could not start OAuth flow. Please try again." };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function resendConfirmationEmail(
  email: string,
): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  const throttleKey = `resend:${normalized}`;

  const throttled = isRateLimited(throttleKey, RESEND_COOLDOWN_MS);
  if (throttled.limited) {
    const seconds = Math.ceil(throttled.retryAfterMs / 1000);
    return {
      ok: false,
      error: `Please wait ${seconds} seconds before requesting another confirmation email.`,
    };
  }

  const supabase = createAdminClient();
  const headerList = await headers();
  const origin = getOrigin(headerList);

  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalized,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/onboarding")}`,
      },
    });
    if (error) {
      recordRequest(throttleKey, RESEND_COOLDOWN_MS);
      return {
        ok: false,
        error: "We couldn't resend the confirmation link. Please try again in a moment.",
      };
    }
  } catch {
    recordRequest(throttleKey, RESEND_COOLDOWN_MS);
    return {
      ok: false,
      error: "We couldn't resend the confirmation link. Please try again in a moment.",
    };
  }

  recordRequest(throttleKey, RESEND_COOLDOWN_MS);

  return {
    ok: true,
    message: "If that email has an account waiting to be confirmed, a fresh link is on its way.",
  };
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  const throttleKey = `reset:${normalized}`;
  const hourlyKey = `reset:hour:${normalized}`;

  const throttled = isRateLimited(throttleKey, RESET_COOLDOWN_MS);
  if (throttled.limited) {
    const seconds = Math.ceil(throttled.retryAfterMs / 1000);
    return {
      ok: false,
      error: `Please wait ${seconds} seconds before requesting another reset link.`,
    };
  }

  const hourly = checkHourlyLimit(hourlyKey, MAX_RESET_PER_HOUR);
  if (!hourly.allowed) {
    const minutes = Math.max(1, Math.ceil(hourly.retryAfterMs / 60_000));
    return {
      ok: false,
      error: `Too many reset attempts for this email. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const supabase = createAdminClient();
  const headerList = await headers();
  const origin = getOrigin(headerList);

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });
    if (error) {
      recordRequest(throttleKey, RESET_COOLDOWN_MS);
      return {
        ok: false,
        error: "We couldn't send a reset link right now. Please try again in a moment.",
      };
    }
  } catch {
    recordRequest(throttleKey, RESET_COOLDOWN_MS);
    return {
      ok: false,
      error: "We couldn't send a reset link right now. Please try again in a moment.",
    };
  }

  recordRequest(throttleKey, RESET_COOLDOWN_MS);

  return {
    ok: true,
    message: "Check your inbox — a password reset link is on its way. It can take up to a minute to arrive.",
  };
}

export async function updatePassword(newPassword: string): Promise<AuthResult> {
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "Your reset link has expired. Please request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { ok: false, error: error.message };
  }

  redirect("/dashboard");
}
