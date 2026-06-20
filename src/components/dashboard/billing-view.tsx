"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CreditCard,
  Crown,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cancelSubscription } from "@/app/actions/subscription";
import { PLANS, type PlanId, formatPrice } from "@/lib/subscription/plans";

export type BillingViewProps = {
  planId: PlanId;
  planName: string;
  status: "trialing" | "active" | "canceled" | "expired" | "none";
  billingInterval: "monthly" | "yearly";
  monthlyQuota: number;
  used: number;
  periodStart: string;
  periodEnd: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  trialDaysRemaining: number;
  cardLast4: string;
  isUnlimited: boolean;
};

const STATUS_META: Record<
  BillingViewProps["status"],
  { label: string; color: string; bg: string; description: string }
> = {
  trialing: {
    label: "Trial",
    color: "#E2E54B",
    bg: "bg-[#E2E54B]/15",
    description: "Free professional trial — full access until your trial ends.",
  },
  active: {
    label: "Active",
    color: "#4CB782",
    bg: "bg-[#4CB782]/15",
    description: "Your subscription is active and will auto-renew.",
  },
  canceled: {
    label: "Canceled",
    color: "#EB5757",
    bg: "bg-[#EB5757]/15",
    description: "Your subscription has been canceled. Access ends at the period close.",
  },
  expired: {
    label: "Expired",
    color: "#EB5757",
    bg: "bg-[#EB5757]/15",
    description: "Your trial or subscription has ended. Pick a plan to continue.",
  },
  none: {
    label: "No plan",
    color: "#8A8F98",
    bg: "bg-[#8A8F98]/15",
    description: "Pick a plan to unlock your dashboard.",
  },
};

export function BillingView(props: BillingViewProps) {
  const {
    planId,
    planName,
    status,
    billingInterval,
    monthlyQuota,
    used,
    periodStart,
    periodEnd,
    trialEndsAt,
    trialDaysRemaining,
    cardLast4,
    isUnlimited,
  } = props;

  const router = useRouter();
  const [cancelling, setCancelling] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  const meta = STATUS_META[status];
  const plan = PLANS[planId];
  const price = formatPrice(plan, billingInterval);

  const pct = isUnlimited
    ? 5
    : Math.min(100, Math.round((used / Math.max(1, monthlyQuota)) * 100));
  const remaining = isUnlimited
    ? Number.POSITIVE_INFINITY
    : Math.max(0, monthlyQuota - used);

  const periodStartLabel = formatDate(periodStart);
  const periodEndLabel = formatDate(periodEnd);
  const trialEndLabel = trialEndsAt ? formatDate(trialEndsAt) : null;

  const showUpgradeList = !isUnlimited;
  const otherPlans = (Object.values(PLANS) as Array<typeof PLANS[PlanId]>).filter(
    (p) => p.id !== planId,
  );

  async function handleCancel() {
    if (cancelling) return;
    setCancelling(true);
    try {
      const result = await cancelSubscription();
      if (!result.ok) {
        toast.error(result.error ?? "Could not cancel subscription.");
        return;
      }
      toast.success("Subscription canceled.");
      router.refresh();
    } finally {
      setCancelling(false);
      setConfirming(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        {/* Current plan card */}
        <section className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#62666D]">
                Current plan
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="inline-flex size-9 items-center justify-center rounded-xl border"
                  style={{
                    backgroundColor: `${plan.accent}1A`,
                    borderColor: `${plan.accent}55`,
                    color: plan.accent,
                  }}
                >
                  {status === "active" || status === "trialing" ? (
                    <Crown className="size-4" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-[#F7F8F8]">
                  {planName}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.bg}`}
                  style={{ color: meta.color }}
                >
                  {meta.label}
                </span>
              </div>
              <p className="mt-2 max-w-md text-sm text-[#8A8F98]">
                {meta.description}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tracking-tight text-[#F7F8F8]">
                {price.display}
                {price.suffix ? (
                  <span className="ml-1 text-xs font-medium text-[#8A8F98]">
                    {price.suffix}
                  </span>
                ) : null}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-[#62666D]">
                {status === "trialing" ? "After trial" : billingInterval}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <InfoTile
              icon={<CalendarClock className="size-3.5" />}
              label={
                status === "trialing" ? "Trial started" : "Current period"
              }
              value={status === "trialing" ? trialEndLabel ?? periodStartLabel : periodStartLabel}
            />
            <InfoTile
              icon={<RefreshCcw className="size-3.5" />}
              label={
                status === "trialing"
                  ? "Trial ends in"
                  : status === "active"
                    ? "Renews on"
                    : "Access ends"
              }
              value={
                status === "trialing"
                  ? `${trialDaysRemaining} day${trialDaysRemaining === 1 ? "" : "s"}`
                  : periodEndLabel
              }
            />
            <InfoTile
              icon={<CreditCard className="size-3.5" />}
              label="Payment method"
              value={
                status === "trialing" || status === "none"
                  ? "None on file"
                  : `Visa ending in ${cardLast4}`
              }
            />
          </div>
        </section>

        {/* Usage */}
        <section className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#F7F8F8]">Conversations used</h3>
              <p className="mt-0.5 text-xs text-[#8A8F98]">
                Resets at the start of each billing cycle.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md border border-[#4CB782]/30 bg-[#4CB782]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#4CB782]">
              <TrendingUp className="size-3" /> Live
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <p className="text-3xl font-bold text-[#F7F8F8]">
                {used.toLocaleString()}
                <span className="ml-1 text-sm font-medium text-[#8A8F98]">
                  / {isUnlimited ? "Unlimited" : monthlyQuota.toLocaleString()}
                </span>
              </p>
              <p className="text-xs font-semibold text-[#E2E54B]">{pct}%</p>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#1A1B1E]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${isUnlimited ? 6 : Math.max(2, pct)}%`,
                  background: isUnlimited
                    ? "linear-gradient(90deg, #4CB782, #22D3EE)"
                    : pct >= 100
                      ? "#F59E0B"
                      : "linear-gradient(90deg, #E2E54B, #5E6AD2)",
                }}
              />
            </div>
            <p className="mt-2 text-xs text-[#8A8F98]">
              {isUnlimited
                ? "You're on an unlimited plan."
                : `${remaining.toLocaleString()} conversation${remaining === 1 ? "" : "s"} remaining this month.`}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Daily limit" value={isUnlimited ? "∞" : `~${Math.round(monthlyQuota / 30)}`} />
            <MiniStat label="Locations" value={plan.maxLocations === Number.MAX_SAFE_INTEGER ? "∞" : String(plan.maxLocations)} />
            <MiniStat label="Widgets" value={plan.maxWidgets === Number.MAX_SAFE_INTEGER ? "∞" : String(plan.maxWidgets)} />
            <MiniStat label="SMS alerts" value={planAllowsSms(planId) ? "✓" : "—"} />
          </div>
        </section>

        {/* Cancel */}
        {status === "active" || status === "trialing" ? (
          <section className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 items-center justify-center rounded-lg border border-[#EB5757]/30 bg-[#EB5757]/10 text-[#EB5757]">
                <XCircle className="size-4" />
              </span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[#F7F8F8]">Cancel subscription</h3>
                <p className="mt-0.5 text-xs leading-5 text-[#8A8F98]">
                  Your access stays active until {periodEndLabel}. After that the
                  dashboard will be locked until you pick a plan again.
                </p>
                {confirming ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2 text-xs text-[#EB5757]">
                      <AlertTriangle className="size-3.5" />
                      Are you sure? This will end your subscription.
                    </div>
                    <div className="flex items-center gap-2 sm:ml-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirming(false)}
                        disabled={cancelling}
                        className="h-8 rounded-lg border-[#23252A] bg-[#121316] text-xs text-[#F7F8F8] hover:bg-[#1A1B1E]"
                      >
                        Keep plan
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleCancel()}
                        disabled={cancelling}
                        className="h-8 rounded-lg bg-[#EB5757] text-xs font-semibold text-[#F7F8F8] hover:bg-[#EB5757]/90"
                      >
                        {cancelling ? (
                          <>
                            <Loader2 className="size-3 animate-spin" />
                            Canceling…
                          </>
                        ) : (
                          <>Yes, cancel</>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirming(true)}
                    className="mt-3 h-8 rounded-lg border-[#23252A] bg-[#121316] text-xs font-semibold text-[#F7F8F8] hover:bg-[#1A1B1E]"
                  >
                    Cancel subscription
                  </Button>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {/* Sidebar: change plan */}
      <aside className="space-y-3">
        {showUpgradeList ? (
          <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
            <div className="flex items-center gap-2">
              <Star className="size-4 text-[#E2E54B]" />
              <h3 className="text-sm font-semibold text-[#F7F8F8]">Change plan</h3>
            </div>
            <p className="mt-1 text-xs text-[#8A8F98]">
              Switch instantly — quota resets on upgrade. Downgrade takes effect at next cycle.
            </p>
            <ul className="mt-4 space-y-2">
              {otherPlans.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/checkout/${p.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3 transition hover:border-[#3A3D44] hover:bg-[#1A1B1E]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: p.accent }}
                        />
                        <p className="truncate text-sm font-semibold text-[#F7F8F8]">
                          {p.name}
                        </p>
                        {isUpgrade(planId, p.id) ? (
                          <span className="rounded-md border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#E2E54B]">
                            Upgrade
                          </span>
                        ) : (
                          <span className="rounded-md border border-[#23252A] bg-[#121316] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#8A8F98]">
                            Downgrade
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-[#8A8F98]">
                        {p.monthlyQuota === Number.MAX_SAFE_INTEGER
                          ? "Unlimited conversations"
                          : `${p.monthlyQuota.toLocaleString()} conversations / month`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#F7F8F8]">
                        {p.priceMonthly === 0 ? "Custom" : `$${p.priceMonthly}`}
                        {p.priceMonthly > 0 ? (
                          <span className="ml-0.5 text-[10px] font-normal text-[#8A8F98]">
                            /mo
                          </span>
                        ) : null}
                      </p>
                      <ArrowRight className="size-3.5 text-[#62666D]" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/pricing"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#E2E54B] hover:underline"
            >
              See full feature comparison →
            </Link>
          </div>
        ) : null}

        <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#4CB782]" />
            <h3 className="text-sm font-semibold text-[#F7F8F8]">Billing & security</h3>
          </div>
          <ul className="mt-3 space-y-2 text-xs text-[#8A8F98]">
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 size-3 shrink-0 text-[#4CB782]" />
              <span>14-day free trial on every new account</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 size-3 shrink-0 text-[#4CB782]" />
              <span>Cancel anytime — no long-term contracts</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 size-3 shrink-0 text-[#4CB782]" />
              <span>HIPAA-aware handling of PII</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 size-3 shrink-0 text-[#4CB782]" />
              <span>Invoice receipts emailed every cycle</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#23252A] bg-[#0B0C0E] p-3">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#62666D]">
        {icon}
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-[#F7F8F8]">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#23252A] bg-[#0B0C0E] px-2.5 py-2 text-center">
      <p className="text-sm font-bold text-[#F7F8F8]">{value}</p>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#62666D]">
        {label}
      </p>
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—"
  }
}

function isUpgrade(current: PlanId, target: PlanId) {
  const order: PlanId[] = ["starter", "growth", "pro"]
  return order.indexOf(target) > order.indexOf(current)
}

function planAllowsSms(id: PlanId) {
  return id === "growth" || id === "pro"
}
