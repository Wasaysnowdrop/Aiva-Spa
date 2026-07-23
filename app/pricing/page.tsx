import { ArrowRight, Check, ChevronRight, Sparkles, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AnimatedFaq, type FaqItem } from "@/components/landing/animated-faq";
import { FloatingShapes } from "@/components/landing/floating-shapes";
import { MarqueeLogos } from "@/components/landing/marquee-logos";
import { MobileMenu } from "@/components/landing/mobile-menu";
import {
  Reveal,
  RevealItem,
  RevealStagger,
} from "@/components/landing/motion-primitives";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { PLAN_ENTITLEMENTS, PLAN_ORDER, PLANS, type PlanId } from "@/lib/subscription/plans";

export const metadata: Metadata = {
  title: "Pricing | AivaSpa",
  description:
    "Simple, fair pricing for the AivaSpa 24/7 AI receptionist. Plans for single-location med spas, growing practices, and multi-location groups.",
};

const navLinks = [
  { label: "Product", href: "/#product" },
  { label: "Features", href: "/#features" },
  { label: "Live demo", href: "/demo" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/#faq" },
] as const;

type Plan = {
  name: string;
  label: string;
  price: string;
  period: string;
  description: string;
  cta: { label: string; href: string };
  featured?: boolean;
  accent: string;
  features: string[];
  highlights: { label: string; value: string }[];
};

const planDescriptions: Record<PlanId, string> = {
  starter: "Everything a small med spa needs to answer visitor questions, capture leads, and notify staff.",
  growth: "Built for med spas that want more bookings, smarter lead handling, and better follow-up automation.",
  pro: "For med spa groups that need multi-location routing, white-label branding, custom setup, and priority support.",
}

const plans: Plan[] = PLAN_ORDER.map((planId) => {
  const plan = PLANS[planId]
  const entitlements = PLAN_ENTITLEMENTS[planId]
  const highlights =
    planId === "growth"
      ? [
          { label: "Conversations", value: `${entitlements.monthlyConversations.toLocaleString()} / mo` },
          { label: "Locations", value: `Up to ${entitlements.locations}` },
          { label: "Languages", value: `${entitlements.languages} incl. RTL` },
        ]
      : planId === "pro"
        ? [
            { label: "Conversations", value: `${entitlements.monthlyConversations.toLocaleString()} / mo` },
            { label: "Locations", value: `Up to ${entitlements.locations}` },
            { label: "White-label", value: "Custom domain" },
          ]
        : [
            { label: "Conversations", value: `${entitlements.monthlyConversations.toLocaleString()} / mo` },
            { label: "Widgets", value: String(entitlements.widgets) },
            { label: "Locations", value: String(entitlements.locations) },
          ]
  return {
    name: plan.name,
    label: plan.tagline,
    price: planId === "pro" ? `From $${plan.priceMonthly}` : `$${plan.priceMonthly}`,
    period: "/month",
    description: planDescriptions[planId],
    cta: { label: plan.cta, href: plan.ctaHref },
    featured: planId === "growth",
    accent: plan.accent,
    features: plan.features,
    highlights,
  }
})

const comparisonRows: { feature: string; starter: string; growth: string; pro: string }[] = [
  { feature: "AI chat widget", starter: "1 website", growth: "2 websites", pro: "Unlimited" },
  { feature: "Locations", starter: "1", growth: "1–2", pro: "Up to 5" },
  { feature: "Monthly conversations", starter: "300", growth: "1,500", pro: "5,000" },
  { feature: "Knowledge base answers", starter: "Basic", growth: "Full", pro: "Full" },
  { feature: "Lead capture", starter: "Name, phone, email, service, time", growth: "✓ + custom fields", pro: "✓ + custom fields" },
  { feature: "Email notifications", starter: "1 staff email", growth: "3 staff emails", pro: "10 staff emails" },
  { feature: "Conversation history", starter: "—", growth: "Full history", pro: "Full history" },
  { feature: "Lead scoring and tagging", starter: "—", growth: "✓", pro: "✓" },
  { feature: "Calendar booking support", starter: "—", growth: "✓", pro: "Multi-location" },
  { feature: "Email reminders", starter: "—", growth: "Included", pro: "Included" },
  { feature: "Visitor intelligence", starter: "—", growth: "Location, device, referrer", pro: "Location, device, referrer" },
  { feature: "Custom widget colors", starter: "Standard", growth: "Custom", pro: "White-label" },
  { feature: "Slack and Teams notifications", starter: "—", growth: "✓", pro: "✓" },
  { feature: "Multi-language widget", starter: "—", growth: "12 languages", pro: "12 + custom locales" },
  { feature: "Custom domain", starter: "—", growth: "—", pro: "✓" },
  { feature: "Role-based access", starter: "—", growth: "—", pro: "Owner, manager, staff, receptionist" },
  { feature: "Audit log and HIPAA reports", starter: "—", growth: "—", pro: "✓" },
  { feature: "Dedicated account manager", starter: "—", growth: "—", pro: "✓" },
  { feature: "Setup", starter: "Done-for-you", growth: "Priority onboarding", pro: "White-glove" },
];

const trustSignals = [
  { value: "< 3s", label: "Avg. first response" },
  { value: "12%+", label: "Visitor → Lead rate" },
  { value: "30%+", label: "Leads captured after hours" },
  { value: "99.9%", label: "Widget uptime" },
] as const;

const faqItems: FaqItem[] = [
  {
    q: "Do I need technical knowledge?",
    a: "No. We set up the AI receptionist for you. Just paste one script tag on your website and we handle the rest — knowledge base, branding, and configuration included.",
  },
  {
    q: "Can I change my plan later?",
    a: "Yes. You can upgrade or downgrade anytime from your dashboard. Upgrades take effect immediately; downgrades apply at the start of the next billing cycle.",
  },
  {
    q: "What happens if I reach my conversation limit?",
    a: "The widget keeps safe fallback behavior so your visitors still get helpful responses. The dashboard will ask you to upgrade for more capacity.",
  },
  {
    q: "Is setup included?",
    a: "Yes. Done-for-you setup is included for early customers. We configure your AI receptionist with your services, FAQs, and branding so you can go live in under 24 hours.",
  },
  {
    q: "Can I use my own branding?",
    a: "White-label branding is available on the Pro plan. You can hide all AivaSpa branding, use your own logo and colors, and map a custom domain like chat.yourspa.com.",
  },
];

const footerColumns = [
  {
    title: "About",
    color: "#FF77E9",
    links: ["About", "Customers", "Pricing", "Contact"],
    hrefs: ["/about", "/customers", "/pricing", "/contact"],
  },
  {
    title: "Resources",
    color: "#22D3EE",
    links: ["Knowledge Base", "Changelog", "HIPAA Notice", "Privacy Policy", "Terms of Service"],
    hrefs: ["/knowledge-base", "/changelog", "/hipaa", "/privacy", "/terms"],
  },
  {
    title: "Product",
    color: "#E2E54B",
    links: ["Chat widget", "AI engine", "Lead dashboard", "Notifications", "Analytics", "Integrations"],
    hrefs: ["/#features", "/#features", "/#features", "/#features", "/#features", "/#features"],
  },
  {
    title: "Contact",
    color: "#34D399",
    links: ["hello@aivaspa.com", "(555) 014-8231", "Remote-first SaaS"],
    hrefs: ["mailto:hello@aivaspa.com", "tel:+15550148231", "#"],
  },
] as const;

const socials = [
  { label: "f", color: "#E2E54B" },
  { label: "in", color: "#22D3EE" },
  { label: "X", color: "#F7F8F8" },
  { label: "O", color: "#FF77E9" },
  { label: "P", color: "#EB5757" },
] as const;

function PriceNumber({ plan }: { plan: Plan }) {
  return (
    <p className="mt-5 flex items-baseline gap-1.5">
      <span className="text-5xl font-bold tracking-tight text-[#F7F8F8]">{plan.price}</span>
      <span className="text-base font-medium text-[#8A8F98]">{plan.period}</span>
    </p>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const isFeatured = !!plan.featured;
  return (
    <RevealItem
      className={`relative h-full ${isFeatured ? "lg:-mt-4 lg:mb-0" : ""}`}
      variants={{ hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } } }}
    >
      {isFeatured ? (
        <span
          className="absolute -top-3.5 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#E2E54B]/60 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
          style={{ backgroundColor: "#E2E54B", color: "#08090A" }}
        >
          <Star className="size-3 fill-current" />
          Most popular
        </span>
      ) : null}
      <article
        className={`relative flex h-full flex-col rounded-3xl border p-7 transition-colors ${
          isFeatured
            ? "border-[#E2E54B] bg-[#1A1B1E]"
            : "border-[#23252A] bg-[#121316] hover:border-[#3A3D44]"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-flex size-9 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: `${plan.accent}1A`,
              borderColor: `${plan.accent}40`,
              color: plan.accent,
            }}
          >
            <Sparkles className="size-4" />
          </span>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: plan.accent }}
          >
            {plan.label}
          </p>
        </div>

        <h3 className="mt-5 text-2xl font-bold tracking-tight text-[#F7F8F8]">{plan.name}</h3>
        <PriceNumber plan={plan} />
        <p className="mt-1 text-xs text-[#62666D]">Billed monthly. Cancel anytime.</p>

        <p className="mt-5 min-h-16 text-sm leading-6 text-[#8A8F98]">{plan.description}</p>

        <a
          href={plan.cta.href}
          className={`mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-5 py-3.5 text-sm font-semibold transition ${
            isFeatured
              ? "bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
              : "border border-[#23252A] bg-[#1A1B1E] text-[#F7F8F8] hover:border-[#E2E54B] hover:text-[#E2E54B]"
          }`}
        >
          {plan.cta.label}
          <ChevronRight className="size-4" />
        </a>

        <ul className="mt-7 grid grid-cols-3 gap-3 rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-3 text-center">
          {plan.highlights.map((h) => (
            <li key={h.label} className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-[#F7F8F8]">{h.value}</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#62666D]">
                {h.label}
              </span>
            </li>
          ))}
        </ul>

        <ul className="mt-7 space-y-3.5">
          {plan.features.map((feature, i) => (
            <li
              key={`${plan.name}-${i}`}
              className="flex items-start gap-3 text-sm text-[#C9CCD2]"
            >
              <span
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border bg-[#1A1B1E]"
                style={{
                  borderColor: isFeatured ? "#E2E54B66" : "#23252A",
                  color: isFeatured ? "#E2E54B" : "#8A8F98",
                }}
              >
                <Check className="size-3" />
              </span>
              <span className="leading-6">{feature}</span>
            </li>
          ))}
        </ul>
      </article>
    </RevealItem>
  );
}

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08090A] text-[#F7F8F8]">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-[#23252A]/60 bg-[#08090A]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="AivaSpa home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-[#8A8F98] md:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`transition hover:text-[#F7F8F8] ${link.label === "Pricing" ? "text-[#F7F8F8]" : ""}`}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-2.5 md:flex">
            <Link href="/demo" className="rounded-lg border border-[#3A3D2A] px-3 py-2 text-sm font-semibold text-[#E2E54B] hover:bg-[#1A1B1E]">Try live demo</Link>
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#E2E54B] px-4 py-2 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90"
              >
                Back to dashboard
                <ArrowRight className="size-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-[#F7F8F8] transition hover:bg-[#1A1B1E]"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#E2E54B] px-4 py-2 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90"
                >
                  Get started
                  <ArrowRight className="size-3.5" />
                </Link>
              </>
            )}
          </div>
          <MobileMenu
            links={navLinks}
            brand={<Logo className="size-8" />}
            rightSlot={
              user ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1 rounded-md bg-[#E2E54B] px-3 py-1.5 text-xs font-semibold text-[#08090A]"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1 rounded-md bg-[#E2E54B] px-3 py-1.5 text-xs font-semibold text-[#08090A]"
                >
                  Get started
                </Link>
              )
            }
          />
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <FloatingShapes variant="hero" />
        <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-20 lg:px-8 lg:pb-20 lg:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3.5 py-1.5 text-xs font-semibold text-[#E2E54B]">
                <Sparkles className="size-3.5" />
                Simple, fair pricing
              </div>
            </Reveal>
            <Reveal>
              <h1 className="mt-7 text-5xl font-bold leading-[1.05] tracking-tight text-[#F7F8F8] md:text-6xl lg:text-7xl">
                Your AI receptionist, <br />set up for you.
              </h1>
            </Reveal>
            <Reveal>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#8A8F98]">
                No technical setup required. We set up your AI receptionist for you within 24 hours.
              </p>
            </Reveal>
            <Reveal>
              <p className="mt-3 text-base font-semibold text-[#E2E54B]">
                Free done-for-you setup included for early customers.
              </p>
            </Reveal>
            <Reveal>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href="#plans"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-6 py-3.5 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90 sm:w-auto"
                >
                  See plans
                  <ArrowRight className="size-4" />
                </a>
                <a
                  href="mailto:sales@aivaspa.com"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#23252A] bg-[#121316] px-6 py-3.5 text-sm font-semibold text-[#F7F8F8] transition hover:bg-[#1A1B1E] sm:w-auto"
                >
                  Talk to sales
                </a>
              </div>
            </Reveal>
          </div>

          {/* Trust strip */}
          <RevealStagger
            amount={0.2}
            className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {trustSignals.map((signal) => (
              <RevealItem
                key={signal.label}
                className="rounded-2xl border border-[#23252A] bg-[#121316]/70 p-4 text-center"
              >
                <p className="text-2xl font-bold text-[#F7F8F8] md:text-3xl">{signal.value}</p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-[#62666D]">
                  {signal.label}
                </p>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Logo strip */}
      <section className="border-y border-[#23252A]/60 bg-[#0B0C0E] py-10">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#62666D]">
            Trusted by modern med spas
          </p>
          <div className="mt-6">
            <MarqueeLogos />
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="relative border-t border-[#23252A]/60 py-24 lg:py-32">
        <FloatingShapes variant="section" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-xs font-semibold text-[#E2E54B]">
                <span className="size-1.5 rounded-full bg-[#E2E54B]" />
                Plans
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Built for every med spa.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
                No technical setup required. We set up your AI receptionist for you within 24 hours.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <div className="mx-auto mt-10 flex max-w-3xl flex-col items-center justify-between gap-4 rounded-2xl border border-[#3B3E24] bg-[#17190F] p-5 text-center sm:flex-row sm:text-left">
              <div><p className="text-sm font-semibold text-[#F7F8F8]">Not ready to choose a plan? Experience AivaSpa first.</p><p className="mt-1 text-xs text-[#8A8F98]">Try the full visitor-to-dashboard journey without signing up.</p></div>
              <Link href="/demo" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#E2E54B] px-5 py-3 text-sm font-semibold text-[#08090A]">Try the interactive demo <ArrowRight className="size-4" /></Link>
            </div>
          </Reveal>

          <RevealStagger
            amount={0.1}
            className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {plans.map((plan) => (
              <PlanCard key={plan.name} plan={plan} />
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Comparison table */}
      <section className="relative border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-3 py-1 text-xs font-semibold text-[#22D3EE]">
                <Sparkles className="size-3" />
                Compare
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Every feature, side by side.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
                Pick the plan that fits your med spa today.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <div className="overflow-hidden rounded-3xl border border-[#23252A] bg-[#121316]">
              <div className="hidden grid-cols-[1.6fr_1fr_1fr_1fr] border-b border-[#23252A] bg-[#0B0C0E] px-6 py-5 text-sm font-semibold text-[#F7F8F8] md:grid">
                <span>Feature</span>
                {plans.map((plan) => (
                  <span
                    key={plan.name}
                    className="text-center"
                    style={{ color: plan.featured ? "#E2E54B" : "#F7F8F8" }}
                  >
                    {plan.name}
                  </span>
                ))}
              </div>
              {comparisonRows.map((row, i) => (
                <div
                  key={row.feature}
                  className={`grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-3 px-6 py-4 text-sm ${
                    i % 2 === 0 ? "bg-[#121316]" : "bg-[#0F1012]"
                  } ${i !== 0 ? "border-t border-[#23252A]/60" : ""}`}
                >
                  <span className="font-medium text-[#F7F8F8]">{row.feature}</span>
                  <span className="text-center text-[#8A8F98]">{row.starter}</span>
                  <span className="text-center text-[#E2E54B]">{row.growth}</span>
                  <span className="text-center text-[#8A8F98]">{row.pro}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Not sure which plan fits */}
      <section className="relative border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
              Not sure which plan fits?
            </h2>
          </Reveal>
          <Reveal>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#8A8F98]">
              Start with Growth if you want more bookings and follow-up automation. Choose Starter if you only need basic lead capture. Book a demo for multi-location teams.
            </p>
          </Reveal>
          <Reveal>
            <a
              href="mailto:sales@aivaspa.com?subject=Free%20setup%20call"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#E2E54B] px-6 py-3.5 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90"
            >
              Book a free setup call
              <ArrowRight className="size-4" />
            </a>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-xs font-semibold text-[#E2E54B]">
                <span className="size-1.5 rounded-full bg-[#E2E54B]" />
                FAQ
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Questions med spa owners ask.
              </h2>
            </div>
          </Reveal>
          <AnimatedFaq items={faqItems} />
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-[#23252A]/60 bg-[#08090A] py-16">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
            <div>
              <Link href="/" className="flex items-center gap-2.5" aria-label="AivaSpa home">
                <Logo />
              </Link>
              <p className="mt-5 max-w-sm text-sm leading-7 text-[#8A8F98]">
                The 24/7 AI receptionist for med spas. Capture every consultation lead, answer every treatment question, and notify your team the moment a lead comes in.
              </p>
              <div className="mt-6 flex items-center gap-3">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href="#"
                    className="flex size-9 items-center justify-center rounded-lg border border-[#23252A] bg-[#121316] text-sm font-semibold text-[#8A8F98] transition hover:border-[#E2E54B] hover:text-[#F7F8F8]"
                  >
                    <span style={{ color: s.color }}>{s.label}</span>
                  </a>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {footerColumns.map((col) => (
                <div key={col.title}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[#F7F8F8]">
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: col.color }} />
                    {col.title}
                  </h3>
                  <ul className="mt-4 space-y-2.5 text-sm text-[#8A8F98]">
                    {col.links.map((link, i) => (
                      <li key={link}>
                        <Link href={col.hrefs[i]} className="inline-block transition hover:translate-x-1 hover:text-[#F7F8F8]">
                          {link}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-[#23252A]/60 pt-6 text-xs text-[#62666D] md:flex-row md:items-center">
            <p>&copy; 2026 AivaSpa, Inc. All rights reserved.</p>
            <div className="flex items-center gap-5">
              <Link href="/privacy" className="hover:text-[#F7F8F8]">Privacy</Link>
              <Link href="/terms" className="hover:text-[#F7F8F8]">Terms</Link>
              <Link href="/hipaa" className="hover:text-[#F7F8F8]">HIPAA Notice</Link>
              <Link href="/status" className="hover:text-[#F7F8F8]">Status</Link>
            </div>
          </div>
          <p className="mt-4 text-xs text-[#62666D]">
            AivaSpa supports lead capture only. It does not provide medical advice, diagnoses, or guaranteed outcomes. A licensed provider confirms treatment suitability and pricing.
          </p>
        </div>
      </footer>
    </main>
  );
}
