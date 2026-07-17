"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consume, getRequestIpAsync } from "@/lib/security/limiter"
import { consumeRateLimit, peekRateLimit } from "@/lib/security/rate-limit"
import { clearRateLimit, hashRateLimitKey } from "@/lib/security/rate-limit"
import { LIMITS } from "@/lib/security/limits";
import { ensureTrialSubscription } from "@/lib/subscription";
import { buildWelcomeEmail, sendEmail } from "@/lib/notifications/email";

export type AuthResult = {
  ok: boolean;
  error?: string;
  message?: string;
  url?: string;
  redirectTo?: string;
};

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

function isAdminSubdomainRequest(headersList: Awaited<ReturnType<typeof headers>>): boolean {
  const host = (headersList.get("host") ?? "").split(":")[0].toLowerCase();
  return host.startsWith("admin.");
}

/**
 * Brute-force protection for sign-in. We check BOTH a per-IP bucket and
 * a per-email bucket. The per-email bucket is what stops an attacker
 * with a botnet from hammering one account; the per-IP bucket stops
 * an attacker from probing many accounts from one machine.
 */
async function signinRateLimited(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ip = await getRequestIpAsync()
  const normalized = email.trim().toLowerCase()
  const emailKey = hashRateLimitKey([LIMITS.auth.signinEmail.bucket, `e=${normalized}`])
  const ipKey = hashRateLimitKey([LIMITS.auth.signin.bucket, `ip=${ip}`])
  const emailDecision = peekRateLimit(emailKey, LIMITS.auth.signinEmail.options)
  if (emailDecision.limited) {
    const s = Math.max(1, Math.ceil(emailDecision.retryAfterMs / 1000))
    return { ok: false, error: `Too many sign-in attempts for this account. Try again in ${s} seconds.` }
  }
  const ipDecision = consumeRateLimit(ipKey, LIMITS.auth.signin.options)
  if (ipDecision.limited) {
    const s = Math.max(1, Math.ceil(ipDecision.retryAfterMs / 1000))
    return { ok: false, error: `Too many sign-in attempts. Try again in ${s} seconds.` }
  }
  // Only count the email bucket when the per-IP check passes, so a
  // legit user behind a shared NAT (coffee shop, mobile carrier) does
  // not lock themselves out of their own account.
  consumeRateLimit(emailKey, LIMITS.auth.signinEmail.options)
  return { ok: true }
}

function noteFailedSignin(email: string) {
  // On failure, do not clear — instead, leave the counters as-is. The
  // counters decrement on their own once the window elapses, and the
  // legitimate user can still sign in once they slow down.
  void email
}

function clearSigninOnSuccess(email: string) {
  const normalized = email.trim().toLowerCase()
  clearRateLimit(
    hashRateLimitKey([LIMITS.auth.signinEmail.bucket, `e=${normalized}`]),
  )
}

export async function signInWithPassword(
  email: string,
  password: string,
  redirectTo?: string,
): Promise<AuthResult> {
  const gate = await signinRateLimited(email)
  if (!gate.ok) return { ok: false, error: gate.error }

  const supabase = await createClient();
  let error: { message: string } | null = null;
  try {
    const result = await supabase.auth.signInWithPassword({ email, password });
    error = result.error;
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; message?: string } };
    console.error("[signInWithPassword] thrown:", err.message, "cause:", err.cause?.code, err.cause?.message);
    noteFailedSignin(email);
    return {
      ok: false,
      error:
        err.cause?.code === "ECONNRESET" || err.cause?.code === "ENOTFOUND" || err.cause?.code === "ETIMEDOUT"
          ? "Couldn't reach the auth server. Please try again in a moment."
          : "Could not sign in right now. Please try again.",
    };
  }

  if (error) {
    noteFailedSignin(email);
    return { ok: false, error: error.message };
  }

  // Successful sign-in — wipe the per-email bucket so the user is not
  // permanently locked out by a slow trickle of bad attempts.
  clearSigninOnSuccess(email);

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
  redirectTo?: string,
): Promise<AuthResult> {
  const headerList = await headers();
  if (isAdminSubdomainRequest(headerList)) {
    return { ok: false, error: "Sign-up is disabled on the admin panel." }
  }

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

  const ip = await getRequestIpAsync()
  const normalized = email.trim().toLowerCase()
  const emailKey = hashRateLimitKey([LIMITS.auth.signup.bucket, `e=${normalized}`])
  const ipKey = hashRateLimitKey([LIMITS.auth.signupIp.bucket, `ip=${ip}`])

  const emailDecision = peekRateLimit(emailKey, LIMITS.auth.signup.options)
  if (emailDecision.limited) {
    const m = Math.max(1, Math.ceil(emailDecision.retryAfterMs / 60_000))
    return {
      ok: false,
      error: `This email has been used to sign up too many times recently. Try again in about ${m} minute${m === 1 ? "" : "s"}.`,
    }
  }
  const ipDecision = consumeRateLimit(ipKey, LIMITS.auth.signupIp.options)
  if (ipDecision.limited) {
    const s = Math.max(1, Math.ceil(ipDecision.retryAfterMs / 1000))
    return { ok: false, error: `Too many sign-up attempts from this network. Try again in ${s} seconds.` }
  }
  consumeRateLimit(emailKey, LIMITS.auth.signup.options)

  const supabase = await createClient();
  const origin = getOrigin(headerList);
  const safeRedirect = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/onboarding";

  const { data, error } = await supabase.auth.signUp({
    email: normalized,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeRedirect)}`,
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
      const adminSupabase = createAdminClient();
      await ensureTrialSubscription(data.user.id, adminSupabase);
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
        to: data.user.email ?? normalized,
        subject,
        text,
        html,
      }).catch((e) => console.error("welcome email send failed", e))
    } catch (e) {
      console.error("buildWelcomeEmail failed", e)
    }
  }

  if (data.session) {
    redirect(safeRedirect);
  }

  redirect(
    `/check-email?email=${encodeURIComponent(normalized)}`,
  );
}

export async function signInWithOAuth(
  provider: "google",
  redirectTo?: string,
): Promise<AuthResult> {
  const headerList = await headers();
  if (isAdminSubdomainRequest(headerList)) {
    return { ok: false, error: "Social sign-up is disabled on the admin panel." }
  }
  const ip = await getRequestIpAsync()
  const decision = consume(LIMITS.auth.oauth, { ip })
  if (decision.limited) {
    const s = Math.max(1, Math.ceil(decision.retryAfterMs / 1000))
    return { ok: false, error: `Too many OAuth start attempts. Try again in ${s} seconds.` }
  }

  const supabase = await createClient();
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
  const ip = await getRequestIpAsync()
  const emailKey = hashRateLimitKey([LIMITS.auth.resend.bucket, `e=${normalized}`])
  const ipKey = hashRateLimitKey([LIMITS.auth.resend.bucket, `ip=${ip}`])

  const emailDecision = peekRateLimit(emailKey, LIMITS.auth.resend.options)
  if (emailDecision.limited) {
    const s = Math.max(1, Math.ceil(emailDecision.retryAfterMs / 1000))
    return {
      ok: false,
      error: `Please wait ${s} seconds before requesting another confirmation email.`,
    }
  }
  const ipDecision = consumeRateLimit(ipKey, LIMITS.auth.resend.options)
  if (ipDecision.limited) {
    const s = Math.max(1, Math.ceil(ipDecision.retryAfterMs / 1000))
    return { ok: false, error: `Too many requests from this network. Try again in ${s} seconds.` }
  }
  consumeRateLimit(emailKey, LIMITS.auth.resend.options)

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
      return {
        ok: false,
        error: "We couldn't resend the confirmation link. Please try again in a moment.",
      };
    }
  } catch {
    return {
      ok: false,
      error: "We couldn't resend the confirmation link. Please try again in a moment.",
    };
  }

  return {
    ok: true,
    message: "If that email has an account waiting to be confirmed, a fresh link is on its way.",
  };
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  const ip = await getRequestIpAsync()
  const emailKey = hashRateLimitKey([LIMITS.auth.resetRequest.bucket, `e=${normalized}`])
  const ipKey = hashRateLimitKey([LIMITS.auth.resetRequest.bucket, `ip=${ip}`])

  const emailDecision = peekRateLimit(emailKey, LIMITS.auth.resetRequest.options)
  if (emailDecision.limited) {
    const s = Math.max(1, Math.ceil(emailDecision.retryAfterMs / 1000))
    return {
      ok: false,
      error: `Please wait ${s} seconds before requesting another reset link.`,
    }
  }
  const ipDecision = consumeRateLimit(ipKey, LIMITS.auth.resetRequest.options)
  if (ipDecision.limited) {
    const s = Math.max(1, Math.ceil(ipDecision.retryAfterMs / 1000))
    return { ok: false, error: `Too many requests from this network. Try again in ${s} seconds.` }
  }
  consumeRateLimit(emailKey, LIMITS.auth.resetRequest.options)

  const supabase = createAdminClient();
  const headerList = await headers();
  const origin = getOrigin(headerList);

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });
    if (error) {
      return {
        ok: false,
        error: "We couldn't send a reset link right now. Please try again in a moment.",
      };
    }
  } catch {
    return {
      ok: false,
      error: "We couldn't send a reset link right now. Please try again in a moment.",
    };
  }

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

  const ip = await getRequestIpAsync()
  const confirmKey = hashRateLimitKey([
    LIMITS.auth.resetConfirm.bucket,
    `id=${user.id}`,
    `ip=${ip}`,
  ])
  const decision = consumeRateLimit(confirmKey, LIMITS.auth.resetConfirm.options)
  if (decision.limited) {
    const s = Math.max(1, Math.ceil(decision.retryAfterMs / 1000))
    return { ok: false, error: `Too many reset attempts. Try again in ${s} seconds.` }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { ok: false, error: error.message };
  }

  redirect("/dashboard");
}
