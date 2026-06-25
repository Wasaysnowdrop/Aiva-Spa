"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Clock, Sparkles, Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { dismissTrialPopupAction } from "@/app/actions/subscription";
import { PLANS, type PlanId } from "@/lib/subscription/plans";

type TrialPopupProps = {
  planName: string;
  daysRemaining: number;
  endsAtIso: string;
};

export function TrialPopup({ planName, daysRemaining, endsAtIso }: TrialPopupProps) {
  const [open, setOpen] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [hovered, setHovered] = React.useState<PlanId | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void handleClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const endsLabel = React.useMemo(() => {
    try {
      return new Date(endsAtIso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "in 7 days";
    }
  }, [endsAtIso]);

  async function handleClose() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await dismissTrialPopupAction();
    } catch {
      // best-effort
    } finally {
      setSubmitting(false);
      setOpen(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-popup-title"
      className="fixed inset-0 z-[100] flex items-center justify-center px-3 py-6 sm:px-6 sm:py-10"
    >
      {/* Backdrop — heavy blur so the dashboard is visibly blurred behind */}
      <button
        type="button"
        aria-label="Close trial popup"
        onClick={() => void handleClose()}
        className="absolute inset-0 cursor-default bg-[#04050a]/75 backdrop-blur-xl"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 10%, rgba(226,229,75,0.08), transparent 55%), radial-gradient(circle at 80% 90%, rgba(94,106,210,0.10), transparent 60%)",
        }}
      />

      <div className="relative z-10 w-full max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl border border-[#23252A] bg-[#0B0C0E] shadow-[0_30px_120px_-20px_rgba(0,0,0,0.7)]">
          {/* Subtle accent gradient */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background:
                "radial-gradient(circle at 0% 0%, rgba(226,229,75,0.10), transparent 45%), radial-gradient(circle at 100% 100%, rgba(94,106,210,0.10), transparent 50%)",
            }}
          />
          <div className="relative">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#23252A] px-6 py-5 sm:px-8 sm:py-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E2E54B]">
                  <Sparkles className="size-3" />
                  Growth 7-day trial · live now
                </div>
                <h2
                  id="trial-popup-title"
                  className="mt-3 text-2xl font-bold tracking-tight text-[#F7F8F8] sm:text-3xl"
                >
                  Your free trial is active
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#8A8F98]">
                  You have full access to the {planName} plan for {daysRemaining} more
                  day{daysRemaining === 1 ? "" : "s"} (ends {endsLabel}). Pick a
                  plan below to keep your access after the trial — or close this
                  popup and explore on your own.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleClose()}
                disabled={submitting}
                aria-label="Close"
                className="group inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#23252A] bg-[#121316] text-[#8A8F98] transition hover:border-[#EB5757]/60 hover:bg-[#1A1B1E] hover:text-[#F7F8F8] disabled:opacity-50"
              >
                <X className="size-5 transition group-hover:scale-110" />
              </button>
            </div>

            {/* Trial counter strip */}
            <div className="grid grid-cols-2 gap-3 border-b border-[#23252A] bg-[#08090A]/60 px-6 py-4 sm:grid-cols-3 sm:px-8">
              <StatChip
                icon={<Clock className="size-3.5" />}
                label="Days remaining"
                value={String(daysRemaining)}
                accent="#E2E54B"
              />
              <StatChip
                icon={<Sparkles className="size-3.5" />}
                label="Trial ends"
                value={endsLabel}
                accent="#5E6AD2"
              />
              <StatChip
                icon={<Star className="size-3.5" />}
                label="Current plan"
                value={planName}
                accent="#22D3EE"
                className="col-span-2 sm:col-span-1"
              />
            </div>

            {/* All 4 plans with full features */}
            <div className="px-6 py-6 sm:px-8 sm:py-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#62666D]">
                  Choose a plan to continue after your trial
                </p>
                <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-[#4CB782] sm:inline">
                  7 days free · cancel anytime
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(["starter", "growth", "pro"] as const).map((id) => {
                  const plan = PLANS[id];
                  const isHighlight = hovered === id || (!hovered && id === "growth");
                  return (
                    <div
                      key={id}
                      onMouseEnter={() => setHovered(id)}
                      onMouseLeave={() => setHovered(null)}
                      className={`relative flex flex-col rounded-2xl border bg-[#121316] p-4 transition ${
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
                        asChild
                        size="sm"
                        className="mt-4 h-9 rounded-lg text-[11px] font-semibold text-[#08090A]"
                        style={{
                          backgroundColor: isHighlight ? plan.accent : "#1A1B1E",
                          color: isHighlight ? "#08090A" : "#F7F8F8",
                          border: isHighlight ? "none" : "1px solid #23252A",
                        }}
                      >
                        <Link href={plan.ctaHref}>
                          {id === "pro" ? "Book demo" : id === "growth" ? "Start free trial" : `Choose ${plan.name}`}
                        </Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col items-stretch gap-3 border-t border-[#23252A] bg-[#08090A]/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <button
                type="button"
                onClick={() => void handleClose()}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-[#8A8F98] underline-offset-4 transition hover:text-[#F7F8F8] hover:underline disabled:opacity-50"
              >
                Remind me later — keep exploring the dashboard
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
                <Button
                  asChild
                  size="sm"
                  className="h-10 rounded-xl bg-[#E2E54B] px-4 text-xs font-semibold text-[#08090A] hover:bg-[#E2E54B]/90"
                >
                  <Link href="/checkout/growth">Upgrade now</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] text-[#8A8F98]">
          This popup can be closed with the X button, the Escape key, or by
          clicking outside.
        </p>
      </div>
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
  accent,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-[#23252A] bg-[#0B0C0E] px-3 py-2.5 ${className}`}
    >
      <span
        className="flex size-7 items-center justify-center rounded-md"
        style={{ backgroundColor: `${accent}1A`, color: accent }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#62666D]">
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-[#F7F8F8]">{value}</p>
      </div>
    </div>
  );
}
