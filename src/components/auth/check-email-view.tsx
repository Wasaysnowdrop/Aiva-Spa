"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, Loader2, CheckCircle2, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resendConfirmationEmail } from "@/app/actions/auth";

const COOLDOWN_SECONDS = 60;
const COOLDOWN_KEY = "aivaspa:resend-cooldown";

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
    lower.includes("too many") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests")
  );
}

export function CheckEmailView({ email }: { email: string | null }) {
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [throttled, setThrottled] = useState(false);
  const [cooldown, setCooldown] = useState<number>(readStoredCooldown);

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

  const onResend = async () => {
    if (!email || cooldown > 0) return;
    setMessage(null);
    setError(null);
    setThrottled(false);
    setResending(true);
    try {
      const result = await resendConfirmationEmail(email);
      if (result && !result.ok) {
        setError(result.error ?? "We couldn't resend the email. Please try again.");
        if (isThrottleMessage(result.error)) {
          setThrottled(true);
        }
        startCooldown();
      } else if (result?.message) {
        setMessage(result.message);
        startCooldown();
      }
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : null;
      setError(errMessage ?? "Something went wrong. Please try again.");
      if (isThrottleMessage(errMessage)) {
        setThrottled(true);
      }
      startCooldown();
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl border border-[#E2E54B]/40 bg-[#E2E54B]/10 text-[#E2E54B]">
          <Mail className="size-6" />
        </span>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#F7F8F8]">
          Check your email
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-[#8A8F98]">
          We sent a confirmation link
          {email ? (
            <>
              {" "}to{" "}
              <span className="font-semibold text-[#F7F8F8]">{email}</span>
            </>
          ) : (
            " to your inbox"
          )}
          . Click it to activate your AivaSpa account and finish onboarding.
        </p>
      </div>

      <div className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">
          What happens next
        </p>
        <ol className="mt-3 space-y-2.5 text-sm text-[#8A8F98]">
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1A1B1E] text-[10px] font-semibold text-[#F7F8F8]">
              1
            </span>
            <span>Open the email from AivaSpa and click <span className="text-[#F7F8F8]">Confirm your email</span>.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1A1B1E] text-[10px] font-semibold text-[#F7F8F8]">
              2
            </span>
            <span>You&apos;ll land back here on the 4-step onboarding.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1A1B1E] text-[10px] font-semibold text-[#F7F8F8]">
              3
            </span>
            <span>Paste the widget snippet on your med spa site and go live.</span>
          </li>
        </ol>
      </div>

      {message ? (
        <div className="flex items-start gap-2 rounded-xl border border-[#4CB782]/40 bg-[#4CB782]/10 px-4 py-3 text-sm text-[#4CB782]">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>{message}</span>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-[#EB5757]/40 bg-[#EB5757]/10 px-4 py-3 text-sm text-[#EB5757]">
          {error}
        </div>
      ) : null}

      {throttled ? (
        <p className="text-xs leading-5 text-[#8A8F98]">
          We limit how often confirmation links can be sent for your security.
          The cooldown resets automatically — usually within a few minutes.
        </p>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {email ? (
          <Button
            type="button"
            onClick={onResend}
            disabled={resending || cooldown > 0}
            className="h-11 w-full rounded-xl bg-[#E2E54B] text-sm font-semibold text-[#08090A] hover:bg-[#E2E54B]/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {resending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Resending email…
              </>
            ) : cooldown > 0 ? (
              <>
                <Timer className="size-4" />
                Resend available in {cooldown}s
              </>
            ) : (
              <>
                Resend confirmation email
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        ) : null}
        <Link
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#23252A] bg-[#0B0C0E] text-sm font-semibold text-[#F7F8F8] transition hover:border-[#3A3D44] hover:bg-[#121316]"
        >
          Back to log in
        </Link>
      </div>

      <p className="text-center text-[11px] leading-5 text-[#62666D]">
        Didn&apos;t get the email? Check your spam folder, or wait a minute — it can
        take up to 60 seconds to arrive.
      </p>
    </div>
  );
}
