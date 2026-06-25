"use client";

import { Loader2, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { fakeCheckout, startTrial } from "@/app/actions/subscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlanId } from "@/lib/subscription/plans";

type CheckoutMode = "trial" | "expired" | "paid";

type CheckoutFormProps = {
  planId: PlanId;
  accent: string;
  mode: CheckoutMode;
  trialEndsAtIso: string | null;
};

export function CheckoutForm({
  planId,
  accent,
  mode,
  trialEndsAtIso,
}: CheckoutFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isTrial = mode === "trial";

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (isTrial) {
      startTransition(async () => {
        const result = await startTrial();
        if (!result.ok) {
          setError(result.error ?? "Could not confirm your trial.");
          return;
        }
        setSuccess("Trial confirmed! Redirecting to your dashboard…");
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 800);
      });
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set("plan", planId);
    formData.set("interval", "monthly");

    startTransition(async () => {
      const result = await fakeCheckout(formData);
      if (!result.ok) {
        setError(result.error ?? "Checkout failed. Please try again.");
        return;
      }
      setSuccess("Plan activated! Redirecting to your dashboard…");
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 900);
    });
  }

  if (isTrial) {
    return (
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="rounded-2xl border border-[#E2E54B]/40 bg-[#E2E54B]/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#E2E54B]">
            <Sparkles className="size-4" />
            You&apos;re on the Growth trial
          </div>
          <p className="mt-1 text-xs leading-5 text-[#C9CCD2]">
            Your 7-day free trial is already active &mdash; no card needed, no charge
            today. Confirm below to keep your access through the end of the
            trial.
          </p>
          {trialEndsAtIso ? (
            <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-[#8A8F98]">
              Trial ends{" "}
              {new Date(trialEndsAtIso).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-[#EB5757]/40 bg-[#EB5757]/10 px-4 py-3 text-sm text-[#EB5757]">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-xl border border-[#4CB782]/40 bg-[#4CB782]/10 px-4 py-3 text-sm text-[#4CB782]">
            {success}
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={isPending}
          className="h-12 w-full rounded-xl text-sm font-semibold text-[#08090A] transition hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Confirming trial…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Continue trial · $0 today
            </>
          )}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#62666D]">
          <ShieldCheck className="size-3" />
          7 days free · cancel anytime · no card needed
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">

      <div className="space-y-2">
        <Label htmlFor="cardName">Name on card</Label>
        <Input
          id="cardName"
          name="cardName"
          required
          placeholder="Alex Morgan"
          className="h-11 border-[#23252A] bg-[#121316] text-[#F7F8F8] placeholder:text-[#62666D] focus-visible:border-[#E2E54B] focus-visible:ring-[#E2E54B]/30"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cardNumber">Card number</Label>
        <Input
          id="cardNumber"
          name="cardNumber"
          required
          inputMode="numeric"
          placeholder="4242 4242 4242 4242"
          className="h-11 border-[#23252A] bg-[#121316] font-mono tracking-wider text-[#F7F8F8] placeholder:text-[#62666D] focus-visible:border-[#E2E54B] focus-visible:ring-[#E2E54B]/30"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cardExpiry">Expiry</Label>
          <Input
            id="cardExpiry"
            name="cardExpiry"
            required
            placeholder="MM/YY"
            className="h-11 border-[#23252A] bg-[#121316] text-[#F7F8F8] placeholder:text-[#62666D] focus-visible:border-[#E2E54B] focus-visible:ring-[#E2E54B]/30"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cardCvc">CVC</Label>
          <Input
            id="cardCvc"
            name="cardCvc"
            required
            inputMode="numeric"
            placeholder="123"
            className="h-11 border-[#23252A] bg-[#121316] text-[#F7F8F8] placeholder:text-[#62666D] focus-visible:border-[#E2E54B] focus-visible:ring-[#E2E54B]/30"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-[#EB5757]/40 bg-[#EB5757]/10 px-4 py-3 text-sm text-[#EB5757]">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-[#4CB782]/40 bg-[#4CB782]/10 px-4 py-3 text-sm text-[#4CB782]">
          {success}
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={isPending}
        className="h-12 w-full rounded-xl text-sm font-semibold text-[#08090A] transition hover:opacity-90"
        style={{ backgroundColor: accent }}
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Activating plan…
          </>
        ) : (
          <>
            <Lock className="size-4" />
            Pay & activate plan
          </>
        )}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#62666D]">
        <ShieldCheck className="size-3" />
        Demo checkout · No real card is charged
      </p>
    </form>
  );
}
