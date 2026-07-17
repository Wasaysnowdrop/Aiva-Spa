"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Sparkles, Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PLANS, type PlanId } from "@/lib/subscription/plans";
import type { PricingSubscriptionSummary } from "@/lib/subscription/pricing-summary";

type PricingModalProps = {
  subscription: PricingSubscriptionSummary;
};

export function PricingModal({ subscription }: PricingModalProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [hovered, setHovered] = React.useState<PlanId | null>(null);

  const isOpen = searchParams.get("plans") === "true";

  const handleClose = React.useCallback(() => {
    router.replace("/dashboard", { scroll: false });
  }, [router]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        router.replace("/dashboard", { scroll: false });
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, router]);

  const canStartTrial = subscription.canStartTrial;

  function getCtaText(planId: PlanId): string {
    if (planId === "pro") return "Book demo";
    if (planId === "growth") {
      if (canStartTrial) return "Start free trial";
      if (subscription.planId === "growth" && subscription.isActive) return "Current plan";
      return "Choose Growth";
    }
    if (planId === "starter") {
      if (subscription.planId === "starter" && subscription.isActive) return "Current plan";
      return "Choose Starter";
    }
    return `Choose ${PLANS[planId as PlanId].name}`;
  }

  function getCtaHref(planId: PlanId): string {
    if (planId === "pro") return PLANS[planId].ctaHref;
    if (planId === "growth" && canStartTrial) return "/checkout/growth";
    if (planId === "growth" && subscription.planId === "growth" && subscription.isActive) return "#";
    if (planId === "starter" && subscription.planId === "starter" && subscription.isActive) return "#";
    return `/checkout/${planId}`;
  }

  function isCurrentPlan(planId: PlanId): boolean {
    return subscription.planId === planId && subscription.isActive;
  }

  function isDisabled(planId: PlanId): boolean {
    return isCurrentPlan(planId) && planId !== "pro";
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricing-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center px-3 py-6 sm:px-6 sm:py-10"
    >
      <button
        type="button"
        aria-label="Close pricing modal"
        onClick={handleClose}
        className="absolute inset-0 cursor-default bg-[#04050a]/75 backdrop-blur-xl"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 10%, rgba(226,229,75,0.08), transparent 55%), radial-gradient(circle at 80% 90%, rgba(94,106,210,0.10), transparent 60%)",
        }}
      />

      <div className="relative z-10 w-full max-w-7xl">
        <div className="relative max-h-[calc(100vh-40px)] overflow-y-auto rounded-3xl border border-[#23252A] bg-[#0B0C0E] shadow-[0_30px_120px_-20px_rgba(0,0,0,0.7)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background:
                "radial-gradient(circle at 0% 0%, rgba(226,229,75,0.10), transparent 45%), radial-gradient(circle at 100% 100%, rgba(94,106,210,0.10), transparent 50%)",
            }}
          />
          <div className="relative">
            <div className="flex items-start justify-between gap-4 border-b border-[#23252A] px-6 py-5 sm:px-8 sm:py-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E2E54B]">
                  <Sparkles className="size-3" />
                  {subscription.status === "expired" || subscription.status === "canceled" || subscription.status === "none"
                    ? "Choose a plan"
                    : "Upgrade your plan"}
                </div>
                <h2
                  id="pricing-modal-title"
                  className="mt-3 text-2xl font-bold tracking-tight text-[#F7F8F8] sm:text-3xl"
                >
                  {subscription.status === "expired" || subscription.status === "canceled"
                    ? "Your trial has ended"
                    : subscription.status === "none"
                      ? "Pick your plan"
                      : "Explore plans"}
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#8A8F98]">
                  {subscription.status === "expired" || subscription.status === "canceled"
                    ? "Choose a plan below to unlock the full dashboard. Your data, knowledge base, and leads are safe and waiting for you."
                    : "Find the plan that fits your med spa. All plans include AI chat, lead capture, and done-for-you setup."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="group inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#23252A] bg-[#121316] text-[#8A8F98] transition hover:border-[#EB5757]/60 hover:bg-[#1A1B1E] hover:text-[#F7F8F8]"
              >
                <X className="size-5 transition group-hover:scale-110" />
              </button>
            </div>

            <div className="px-6 py-6 sm:px-8 sm:py-7">
              {canStartTrial ? (
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#62666D]">
                    Start your 7-day free trial
                  </p>
                  <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-[#4CB782] sm:inline">
                    7 days free · cancel anytime
                  </span>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {(["starter", "growth", "pro"] as const).map((id) => {
                  const plan = PLANS[id];
                  const isHighlight = hovered === id || (!hovered && id === "growth");
                  const disabled = isDisabled(id);
                  const ctaText = getCtaText(id);
                  const ctaHref = getCtaHref(id);

                  return (
                    <div
                      key={id}
                      onMouseEnter={() => setHovered(id)}
                      onMouseLeave={() => setHovered(null)}
                      className={`relative flex flex-col rounded-2xl border bg-[#121316] p-5 transition ${
                        isHighlight
                          ? "border-[#E2E54B]/60"
                          : "border-[#23252A] hover:border-[#3A3D44]"
                      }`}
                    >
                      {id === "growth" ? (
                        <span
                          className="absolute -top-2.5 right-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#08090A]"
                          style={{ backgroundColor: plan.accent }}
                        >
                          <Star className="size-2.5 fill-current" />
                          Most popular
                        </span>
                      ) : null}

                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex size-7 items-center justify-center rounded-md border"
                          style={{
                            backgroundColor: `${plan.accent}1A`,
                            borderColor: `${plan.accent}55`,
                            color: plan.accent,
                          }}
                        >
                          <Sparkles className="size-3.5" />
                        </span>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8A8F98]">
                          {plan.name}
                        </p>
                      </div>

                      <div className="mt-3">
                        <p className="text-2xl font-bold tracking-tight text-[#F7F8F8]">
                          ${plan.priceMonthly}
                          <span className="ml-1 text-xs font-medium text-[#8A8F98]">
                            /month
                          </span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#62666D]">
                          {`${plan.monthlyQuota.toLocaleString()} conversations / month`}
                        </p>
                      </div>

                      <ul className="mt-4 flex-1 space-y-1.5">
                        {plan.features.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-start gap-2 text-[11px] leading-5 text-[#C9CCD2]"
                          >
                            <span
                              className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-sm"
                              style={{
                                backgroundColor: `${plan.accent}1A`,
                                color: plan.accent,
                              }}
                            >
                              <Check className="size-2.5" />
                            </span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        asChild={!disabled}
                        size="sm"
                        disabled={disabled}
                        className="mt-4 h-9 rounded-lg text-[11px] font-semibold text-[#08090A]"
                        style={{
                          backgroundColor: isHighlight ? plan.accent : "#1A1B1E",
                          color: isHighlight ? "#08090A" : "#F7F8F8",
                          border: isHighlight ? "none" : "1px solid #23252A",
                          opacity: disabled ? 0.5 : 1,
                        }}
                      >
                        {disabled ? (
                          <span>{ctaText}</span>
                        ) : (
                          <Link href={ctaHref}>{ctaText}</Link>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 border-t border-[#23252A] bg-[#08090A]/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-[#8A8F98] underline-offset-4 transition hover:text-[#F7F8F8] hover:underline"
              >
                {subscription.isActive ? "Keep exploring the dashboard" : "Go back to dashboard"}
              </button>
              <div className="flex items-center gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-xl border-[#23252A] bg-[#121316] text-xs font-semibold text-[#F7F8F8] hover:bg-[#1A1B1E]"
                >
                  <Link href="/pricing">Compare all features</Link>
                </Button>
                {canStartTrial ? (
                  <Button
                    asChild
                    size="sm"
                    className="h-10 rounded-xl bg-[#E2E54B] px-4 text-xs font-semibold text-[#08090A] hover:bg-[#E2E54B]/90"
                  >
                    <Link href="/checkout/growth">Start free trial</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
