import { ArrowLeft, Check, CreditCard, Lock, ShieldCheck, Sparkles, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/logo";

import { CheckoutForm } from "./checkout-form";
import { PLANS, type PlanId, formatPrice } from "@/lib/subscription/plans";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Checkout | AivaSpa",
  description: "Activate your AivaSpa plan in seconds.",
};

type Params = { plan: string };

export default async function CheckoutPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { plan: rawPlan } = await params;
  const planId = rawPlan as PlanId;
  if (!(planId in PLANS)) notFound();

  const plan = PLANS[planId];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirectTo=/checkout/${planId}`);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08090A] text-[#F7F8F8]">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-24 h-96 w-96 rounded-full bg-[#E2E54B]/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 bottom-24 h-[28rem] w-[28rem] rounded-full bg-[#5E6AD2]/20 blur-3xl"
      />

      <header className="relative z-10 border-b border-[#23252A]/70 bg-[#08090A]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="AivaSpa home">
            <Logo />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-[#8A8F98] transition hover:text-[#F7F8F8]"
          >
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-16">
        <div>
          <div
            className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E2E54B]"
            style={{
              borderColor: `${plan.accent}55`,
              backgroundColor: `${plan.accent}1A`,
              color: plan.accent,
            }}
          >
            <Star className="size-3" />
            Activate {plan.name}
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-5xl">
            You&apos;re upgrading to {plan.name}.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#8A8F98]">
            This is a demo checkout — no real payment is processed. Enter any test
            values below to activate the plan on this account.
          </p>

          <div className="mt-8 rounded-3xl border border-[#23252A] bg-[#121316]/85 p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#62666D]">
              Your plan
            </p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-[#F7F8F8]">
                  {plan.name}
                </h2>
                <p className="text-sm text-[#8A8F98]">{plan.tagline}</p>
              </div>
              <PriceTag planId={planId} />
            </div>
            <ul className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-3 text-sm text-[#C9CCD2]"
                >
                  <span
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border bg-[#1A1B1E]"
                    style={{
                      borderColor: `${plan.accent}55`,
                      color: plan.accent,
                    }}
                  >
                    <Check className="size-3" />
                  </span>
                  <span className="leading-6">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#23252A] bg-[#121316]/85 p-4 text-xs text-[#8A8F98]">
              <div className="flex items-center gap-2 font-semibold text-[#F7F8F8]">
                <ShieldCheck className="size-4 text-[#4CB782]" />
                Demo mode
              </div>
              <p className="mt-1 leading-5">
                No real card is charged. Use any number, expiry, and CVC.
              </p>
            </div>
            <div className="rounded-2xl border border-[#23252A] bg-[#121316]/85 p-4 text-xs text-[#8A8F98]">
              <div className="flex items-center gap-2 font-semibold text-[#F7F8F8]">
                <Lock className="size-4 text-[#22D3EE]" />
                Cancel anytime
              </div>
              <p className="mt-1 leading-5">
                You can cancel from Settings → Billing at any time.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-3xl border border-[#23252A] bg-[#0B0C0E]/90 p-6 shadow-2xl shadow-black/30 md:p-8">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#F7F8F8]">
              <CreditCard className="size-4 text-[#E2E54B]" />
              Payment details
            </div>
            <p className="mt-1 text-xs text-[#8A8F98]">
              We never store raw card numbers in this demo. Any test values will work.
            </p>
            <CheckoutForm planId={planId} accent={plan.accent} />
            <div className="mt-6 border-t border-[#23252A] pt-5 text-xs text-[#62666D]">
              By activating you agree to our Terms of Service and Privacy Policy. A
              14-day free trial is included for new accounts; billing starts after
              the trial unless you cancel.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function PriceTag({ planId }: { planId: PlanId }) {
  const plan = PLANS[planId];
  const monthly = formatPrice(plan, "monthly");
  const yearly = formatPrice(plan, "yearly");
  return (
    <div className="text-right">
      <p className="text-3xl font-bold tracking-tight text-[#F7F8F8]">
        {monthly.display}
        {monthly.suffix ? (
          <span className="ml-1 text-sm font-medium text-[#8A8F98]">
            {monthly.suffix}
          </span>
        ) : null}
      </p>
      <p className="text-[11px] text-[#62666D]">
        or {yearly.display}/mo billed yearly
      </p>
    </div>
  );
}
