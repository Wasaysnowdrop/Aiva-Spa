"use client";

import { Lock, Star } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/subscription/plans";

type PaywallProps = {
  spaName: string;
};

export function Paywall({ spaName }: PaywallProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[#08090A]/95 px-4 py-10 backdrop-blur-md">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(circle at top, rgba(226,229,75,0.18), transparent 55%), radial-gradient(circle at bottom right, rgba(94,106,210,0.18), transparent 60%)",
        }}
      />
      <div className="relative z-10 w-full max-w-3xl rounded-3xl border border-[#23252A] bg-[#0B0C0E] p-8 shadow-2xl shadow-black/40">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#EB5757]/40 bg-[#EB5757]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#EB5757]">
          <Lock className="size-3" />
          Subscription required
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
          Your 7-day trial has ended, {spaName ? spaName : "friend"}.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#8A8F98]">
          Choose a plan to unlock the full AivaSpa dashboard — leads, conversations,
          widget, analytics, and team tools. Your setup, knowledge base, and leads
          are safe and waiting for you.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {(["starter", "growth", "pro"] as const).map((id) => {
            const plan = PLANS[id];
            return (
              <div
                key={id}
                className="flex flex-col rounded-2xl border border-[#23252A] bg-[#121316] p-4"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex size-7 items-center justify-center rounded-md border"
                    style={{
                      backgroundColor: `${plan.accent}1A`,
                      borderColor: `${plan.accent}55`,
                      color: plan.accent,
                    }}
                  >
                    <Star className="size-3.5" />
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8A8F98]">
                    {plan.name}
                  </p>
                </div>
                <p className="mt-3 text-2xl font-bold text-[#F7F8F8]">
                  ${plan.priceMonthly}
                  <span className="ml-1 text-xs font-medium text-[#8A8F98]">
                    /mo
                  </span>
                </p>
                <p className="mt-1 text-xs text-[#62666D]">
                  {plan.monthlyQuota.toLocaleString()} conversations / month
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-[#C9CCD2]">
                  {plan.features.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <span className="mt-1.5 size-1 rounded-full bg-[#4CB782]" />
                      <span className="leading-5">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  size="sm"
                  className="mt-4 h-9 rounded-lg text-xs font-semibold text-[#08090A]"
                  style={{ backgroundColor: plan.accent }}
                >
                  <Link href={plan.ctaHref}>
                    {id === "pro" ? "Book demo" : id === "growth" ? "Start free trial" : `Choose ${plan.name}`}
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col items-center gap-2 text-xs text-[#62666D] sm:flex-row sm:justify-between">
          <p>Need something custom? Reach out to our team.</p>
          <div className="flex items-center gap-3">
            <Link
              href="mailto:sales@aivaspa.com"
              className="font-semibold text-[#8A8F98] hover:text-[#F7F8F8]"
            >
              Talk to sales
            </Link>
            <Link
              href="/pricing"
              className="font-semibold text-[#E2E54B] hover:underline"
            >
              See all plans →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
