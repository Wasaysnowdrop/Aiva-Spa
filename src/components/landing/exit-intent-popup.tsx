"use client";

import * as React from "react";
import { ArrowRight, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";

const STORAGE_KEY = "aiva:exit-intent:dismissed";
const STORAGE_SUBMITTED = "aiva:exit-intent:submitted";

const DELAY_MS = 4500;
const IDLE_MS = 12000;

type Props = {
  /** Seconds the user must be on the page before the listener activates. */
  delaySeconds?: number;
  /** Seconds of inactivity that will also trigger the popup on mobile / no-mouse. */
  idleSeconds?: number;
  className?: string;
};

export function ExitIntentPopup({
  delaySeconds = Math.round(DELAY_MS / 1000),
  idleSeconds = Math.round(IDLE_MS / 1000),
  className,
}: Props) {
  const [visible, setVisible] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [error, setError] = React.useState<string | null>(null);

  const trigger = React.useCallback(() => {
    setVisible((v) => {
      if (v) return v;
      try {
        if (window.sessionStorage.getItem(STORAGE_KEY) === "1") return v;
        if (window.localStorage.getItem(STORAGE_SUBMITTED) === "1") return v;
      } catch {}
      return true;
    });
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let mounted = true;
    const enableAfter = window.setTimeout(() => {
      if (!mounted) return;

      let lastY = window.scrollY;
      const onMouseLeave = (e: MouseEvent) => {
        if (e.clientY <= 4 && window.scrollY < 80) {
          trigger();
        }
      };
      const onScroll = () => {
        const goingUp = window.scrollY < lastY - 24;
        if (goingUp && window.scrollY < 80) {
          trigger();
        }
        lastY = window.scrollY;
      };

      document.documentElement.addEventListener("mouseleave", onMouseLeave);
      window.addEventListener("scroll", onScroll, { passive: true });

      const idleTimer = window.setTimeout(trigger, idleSeconds * 1000);
      const resetIdle = () => {
        window.clearTimeout(idleTimer);
      };
      const events: (keyof WindowEventMap)[] = [
        "mousemove",
        "keydown",
        "scroll",
        "touchstart",
      ];
      events.forEach((ev) =>
        window.addEventListener(ev, resetIdle, { passive: true }),
      );

      return () => {
        document.documentElement.removeEventListener("mouseleave", onMouseLeave);
        window.removeEventListener("scroll", onScroll);
        window.clearTimeout(idleTimer);
        events.forEach((ev) => window.removeEventListener(ev, resetIdle));
      };
    }, delaySeconds * 1000);

    return () => {
      mounted = false;
      window.clearTimeout(enableAfter);
    };
  }, [delaySeconds, idleSeconds, trigger]);

  const dismiss = React.useCallback((persist = true) => {
    setVisible(false);
    if (persist) {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {}
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email.");
      return;
    }
    setError(null);
    setStatus("sending");
    try {
      await new Promise((r) => window.setTimeout(r, 700));
      try {
        window.localStorage.setItem(STORAGE_SUBMITTED, "1");
      } catch {}
      setStatus("done");
      window.setTimeout(() => dismiss(false), 2400);
    } catch {
      setStatus("error");
      setError("Something went wrong. Please try again.");
    }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="exit-intent-title"
      className={cn(
        "fixed inset-0 z-[60] flex items-end justify-center px-4 pb-4 sm:items-center sm:p-6",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => dismiss(true)}
        className="absolute inset-0 bg-[#08090A]/70 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#23252A] bg-[#121316] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-bottom-4 duration-300">
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => dismiss(true)}
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-[#8A8F98] transition hover:bg-[#1A1B1E] hover:text-[#F7F8F8]"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-[#E2E54B]/15 text-[#E2E54B]">
            <Sparkles className="size-4" />
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E2E54B]">
            Before you go
          </p>
        </div>

        {status === "done" ? (
          <div className="mt-4">
            <h3
              id="exit-intent-title"
              className="text-xl font-bold text-[#F7F8F8]"
            >
              You&apos;re in. We&apos;ll be in touch shortly.
            </h3>
            <p className="mt-2 text-sm text-[#8A8F98]">
              A med-spa growth specialist will email you within 1 business hour
              to set up your free AI receptionist consultation.
            </p>
          </div>
        ) : (
          <>
            <h3
              id="exit-intent-title"
              className="mt-4 text-2xl font-bold leading-tight tracking-tight text-[#F7F8F8]"
            >
              Want a free 15-min consultation?
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#8A8F98]">
              Drop your email and we&apos;ll show you how AivaSpa can capture
              more bookings for your med spa — no credit card, no commitment.
            </p>

            <form onSubmit={submit} className="mt-5 space-y-2.5">
              <label htmlFor="exit-intent-email" className="sr-only">
                Email address
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="exit-intent-email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@yourspa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 flex-1 rounded-xl border border-[#23252A] bg-[#0B0C0E] px-3.5 text-sm text-[#F7F8F8] placeholder:text-[#62666D] focus:border-[#E2E54B] focus:outline-none focus:ring-2 focus:ring-[#E2E54B]/20"
                />
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#E2E54B] px-4 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90 disabled:opacity-60"
                >
                  {status === "sending" ? (
                    "Sending…"
                  ) : (
                    <>
                      Book it
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </div>
              {error ? <p className="text-xs text-[#EB5757]">{error}</p> : null}
              <p className="text-[11px] text-[#62666D]">
                We&apos;ll never share your email. Unsubscribe anytime.
              </p>
            </form>
          </>
        )}

        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-[#E2E54B]/15 blur-3xl"
        />
      </div>
    </div>
  );
}
