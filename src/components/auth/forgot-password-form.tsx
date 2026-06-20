"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Mail, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/app/actions/auth";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
});

type Values = z.infer<typeof schema>;

const COOLDOWN_SECONDS = 60;
const COOLDOWN_KEY = "aivaspa:reset-cooldown";

function readStoredCooldown(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(COOLDOWN_KEY);
  const until = raw ? Number.parseInt(raw, 10) : 0;
  if (!Number.isFinite(until) || until <= Date.now()) {
    window.localStorage.removeItem(COOLDOWN_KEY);
    return 0;
  }
  return Math.ceil((until - Date.now()) / 1000);
}

function isThrottleMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("please wait") ||
    lower.includes("too many reset") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests")
  );
}

function ForgotPasswordFormInner() {
  const searchParams = useSearchParams();
  const expired = searchParams.get("error") === "recovery";

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [throttled, setThrottled] = useState(false);
  const [cooldown, setCooldown] = useState<number>(readStoredCooldown);
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => {
      setCooldown((prev) => {
        const next = prev - 1;
        if (next <= 0 && typeof window !== "undefined") {
          window.localStorage.removeItem(COOLDOWN_KEY);
        }
        return Math.max(0, next);
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  const startCooldown = useCallback(() => {
    if (typeof window === "undefined") return;
    const until = Date.now() + COOLDOWN_SECONDS * 1000;
    window.localStorage.setItem(COOLDOWN_KEY, String(until));
    setCooldown(COOLDOWN_SECONDS);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setInfoMessage(null);
    setThrottled(false);
    if (cooldown > 0) return;
    setSubmitting(true);
    try {
      const result = await requestPasswordReset(values.email);
      if (result && !result.ok) {
        setServerError(
          result.error ?? "We couldn't process that request. Please try again.",
        );
        if (isThrottleMessage(result.error)) {
          setThrottled(true);
        }
        startCooldown();
      } else if (result?.message) {
        setInfoMessage(result.message);
        setSentEmail(values.email);
        startCooldown();
      }
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : null;
      setServerError(
        errMessage ?? "Something went wrong. Please try again.",
      );
      if (isThrottleMessage(errMessage)) {
        setThrottled(true);
      }
      startCooldown();
    } finally {
      setSubmitting(false);
    }
  });

  const buttonDisabled = submitting || cooldown > 0;

  if (infoMessage && sentEmail) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-[#E2E54B]/40 bg-[#E2E54B]/10 text-[#E2E54B]">
            <Mail className="size-6" />
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#F7F8F8]">
            Check your inbox
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-[#8A8F98]">
            We sent a password reset link to{" "}
            <span className="font-semibold text-[#F7F8F8]">{sentEmail}</span>.
            Click the link in the email to set a new password.
          </p>
        </div>

        <div className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">
            What to do next
          </p>
          <ol className="mt-3 space-y-2.5 text-sm text-[#8A8F98]">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1A1B1E] text-[10px] font-semibold text-[#F7F8F8]">
                1
              </span>
              <span>Open the email from AivaSpa and click <span className="text-[#F7F8F8]">Reset your password</span>.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1A1B1E] text-[10px] font-semibold text-[#F7F8F8]">
                2
              </span>
              <span>You&apos;ll land on the &ldquo;Set a new password&rdquo; page.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1A1B1E] text-[10px] font-semibold text-[#F7F8F8]">
                3
              </span>
              <span>Choose a new password and you&apos;re back in the dashboard.</span>
            </li>
          </ol>
        </div>

        <div className="rounded-xl border border-[#23252A] bg-[#0B0C0E] px-4 py-3 text-xs leading-5 text-[#8A8F98]">
          Didn&apos;t get the email? Check your spam folder — it can take up to a minute to arrive.
        </div>

        <Button
          type="button"
          onClick={() => {
            setInfoMessage(null);
            setSentEmail(null);
          }}
          variant="outline"
          className="h-11 w-full rounded-xl border-[#23252A] bg-[#0B0C0E] text-sm font-semibold text-[#F7F8F8] hover:border-[#3A3D44] hover:bg-[#121316]"
        >
          Use a different email
        </Button>

        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-[#8A8F98] transition hover:text-[#F7F8F8]"
        >
          <ArrowLeft className="size-3.5" />
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-[#F7F8F8]">
          Forgot your password?
        </h1>
        <p className="text-sm leading-6 text-[#8A8F98]">
          Enter the email associated with your AivaSpa account and we&apos;ll send
          you a link to reset your password.
        </p>
      </div>

      {expired ? (
        <div className="rounded-xl border border-[#EB5757]/40 bg-[#EB5757]/10 px-4 py-3 text-sm text-[#EB5757]">
          That reset link has expired or already been used. Request a new one below.
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email" className="text-[#F7F8F8]">
          Work email
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@medspa.com"
          aria-invalid={!!errors.email}
          className="h-11 border-[#23252A] bg-[#0B0C0E] text-[#F7F8F8] placeholder:text-[#62666D] focus-visible:border-[#E2E54B] focus-visible:ring-[#E2E54B]/30"
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-xs text-[#EB5757]">{errors.email.message}</p>
        ) : null}
      </div>

      {serverError ? (
        <div className="rounded-xl border border-[#EB5757]/40 bg-[#EB5757]/10 px-4 py-3 text-sm text-[#EB5757]">
          {serverError}
        </div>
      ) : null}

      {throttled ? (
        <p className="text-xs leading-5 text-[#8A8F98]">
          We limit how often reset links can be sent for your security. The
          cooldown resets automatically — usually within a minute.
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={buttonDisabled}
        className="h-11 w-full rounded-xl bg-[#E2E54B] text-sm font-semibold text-[#08090A] hover:bg-[#E2E54B]/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Sending reset link…
          </>
        ) : cooldown > 0 ? (
          <>
            <Timer className="size-4" />
            Resend available in {cooldown}s
          </>
        ) : (
          "Send reset link"
        )}
      </Button>

      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm text-[#8A8F98] transition hover:text-[#F7F8F8]"
      >
        <ArrowLeft className="size-3.5" />
        Back to log in
      </Link>
    </form>
  );
}

export function ForgotPasswordForm() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordFormInner />
    </Suspense>
  );
}
