import {
  ArrowRight,
  Check,
  ChevronRight,
  Layers,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AnimatedClosingCta } from "@/components/landing/animated-closing-cta";
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

export const metadata: Metadata = {
  title: "Pricing | AivaSpa",
  description:
    "Simple, fair pricing for the AivaSpa 24/7 AI receptionist. Plans for single-location med spas, growing practices, and multi-location groups — with a 14-day free trial.",
};

const navLinks = [
  { label: "Product", href: "/#product" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/#faq" },
] as const;

type Plan = {
  name: string;
  label: string;
  price: string;
  period: string;
  suffix?: string;
  description: string;
  cta: { label: string; href: string };
  featured?: boolean;
  accent: string;
  features: string[];
  highlights: { label: string; value: string }[];
};

const plans: Plan[] = [
  {
    name: "Starter",
    label: "For a single med spa",
    price: "$50",
    period: "/month",
    suffix: "billed monthly",
    description:
      "Everything a single-location med spa needs to greet visitors, answer FAQs, and capture consultation leads 24/7 — with AI analytics, lead scoring, and HIPAA-aware handling baked in. Upgrade to Growth to add the built-in calendar, URL-scraper onboarding, and multi-language widget.",
    cta: { label: "Start free trial", href: "/checkout/starter" },
    accent: "#22D3EE",
    features: [
      "1 website widget, 1 location",
      "AI answers from your approved knowledge base",
      "Lead capture (name, phone, email, service, time)",
      "Email notifications to staff",
      "Up to 600 conversations / month",
      "Basic lead dashboard with status",
      "Standard widget branding (logo + colors)",
      "AI conversation analytics & CSAT ratings",
      "Visitor intelligence (geo, device, referrer)",
      "Lead scoring, tagging & custom fields",
      "Daily summary email reports",
      "Auto-responder rules & quick replies",
      "Team activity log (30 days)",
      "HIPAA-aware PII handling",
    ],
    highlights: [
      { label: "Conversations", value: "600 / mo" },
      { label: "Locations", value: "1" },
      { label: "Calendar", value: "Add-on" },
    ],
  },
  {
    name: "Growth",
    label: "For active med spas",
    price: "$100",
    period: "/month",
    suffix: "billed monthly · save 20% yearly",
    description:
      "Built for med spas booking 40+ consultations a month. Unlock advanced widget customisation, service-specific routing, AI lead scoring, conversion funnels, and multi-language support.",
    cta: { label: "Start free trial", href: "/checkout/growth" },
    featured: true,
    accent: "#E2E54B",
    features: [
      "Everything in Starter",
      "Up to 3,000 conversations / month",
      "Full conversation history & transcripts",
      "Advanced widget customisation: position, greeting, tone, avatar, theme & per-page rules",
      "Service-specific routing & hot-lead alerts",
      "AI-powered lead scoring & smart reply suggestions",
      "Conversion funnel analytics",
      "A/B testing for greetings & CTAs",
      "Slack & Microsoft Teams notifications",
      "URL scraper for Knowledge Base (paste your site URL — services, FAQs, and hours auto-fill in seconds)",
      "Built-in calendar with live booking slots & SMS/email reminders (no Google OAuth required)",
      "Multi-language widget — 12 languages with auto-detect, RTL support & visitor language switcher",
      "Email template library & saved replies",
      "Priority onboarding (under 24h)",
    ],
    highlights: [
      { label: "Conversations", value: "3,000 / mo" },
      { label: "Locations", value: "1–2" },
      { label: "Languages", value: "12 incl. RTL" },
    ],
  },
  {
    name: "Pro",
    label: "For multi-location groups",
    price: "$210",
    period: "/month",
    suffix: "billed monthly · save 20% yearly",
    description:
      "For med spa groups that need multi-location routing, a white-label widget with a custom domain, role-based access, dedicated AI model fine-tuning, and 24/7 priority support.",
    cta: { label: "Start free trial", href: "/checkout/pro" },
    accent: "#FF77E9",
    features: [
      "Everything in Growth",
      "Up to 5 locations & unlimited widgets",
      "Up to 10,000 conversations / month",
      "Advanced analytics (conversion, after-hours, SLA, cohort)",
      "White-label widget (hide AivaSpa branding, your colors, your logo)",
      "Custom domain (e.g. chat.yourspa.com) — map up to 3 of your own domains with DNS verification",
      "Role-based access (owner / manager / staff / receptionist)",
      "Audit log & extended data retention (1 year)",
      "Custom data residency & retention policies",
      "Priority AI inference (faster first response)",
      "Dedicated AI model fine-tuning per brand",
      "All 12 languages + priority custom-locale requests",
      "Multi-location custom calendar with team routing",
      "Compliance & HIPAA audit reports",
      "24/7 priority support + dedicated account manager",
    ],
    highlights: [
      { label: "Conversations", value: "10,000 / mo" },
      { label: "Locations", value: "Up to 5" },
      { label: "White-label", value: "Custom domain" },
    ],
  },
];

const comparisonRows: { feature: string; starter: string; growth: string; pro: string }[] = [
  { feature: "Website widget", starter: "1", growth: "2", pro: "Unlimited" },
  { feature: "Locations", starter: "1", growth: "1–2", pro: "Up to 5" },
  { feature: "AI knowledge-base answers", starter: "✓", growth: "✓", pro: "✓" },
  { feature: "URL scraper for Knowledge Base", starter: "—", growth: "✓ (1-click KB autofill)", pro: "✓ (1-click KB autofill)" },
  { feature: "Built-in calendar & booking reminders", starter: "—", growth: "✓ (no Google OAuth)", pro: "✓ Multi-location" },
  { feature: "Multi-language widget", starter: "—", growth: "12 languages (auto-detect + RTL)", pro: "All 12 + custom locale requests" },
  { feature: "Custom domain (white-label)", starter: "—", growth: "—", pro: "Up to 3 (e.g. chat.yourspa.com)" },
  { feature: "Lead capture & dashboard", starter: "Basic", growth: "Standard", pro: "Advanced" },
  { feature: "Conversation history", starter: "Last 30 days", growth: "Full history", pro: "Full history + 1yr retention" },
  { feature: "Notifications", starter: "Email + daily summary", growth: "Email + Slack/Teams", pro: "Email + Slack/Teams + custom routing" },
  { feature: "Widget branding & customisation", starter: "Standard (logo + colors)", growth: "Advanced (position, greeting, tone, avatar, theme, per-page rules)", pro: "White-label (hide AivaSpa branding + your custom domain)" },
  { feature: "Lead scoring, tagging & custom fields", starter: "✓", growth: "✓ + AI-powered", pro: "✓ + AI-powered + custom models" },
  { feature: "A/B testing & funnels", starter: "—", growth: "✓", pro: "✓" },
  { feature: "Monthly conversations", starter: "600", growth: "3,000", pro: "10,000" },
  { feature: "Analytics dashboard", starter: "AI analytics + CSAT", growth: "Conversion funnels + cohorts", pro: "SLA, after-hours, cohort & custom reports" },
  { feature: "Role-based access", starter: "—", growth: "—", pro: "Owner / Manager / Staff / Receptionist" },
  { feature: "Audit log & data retention", starter: "30 days", growth: "90 days", pro: "1 year + custom retention" },
  { feature: "Compliance & HIPAA reports", starter: "—", growth: "—", pro: "✓" },
  { feature: "Dedicated account manager", starter: "—", growth: "—", pro: "✓" },
  { feature: "Uptime SLA", starter: "99.9%", growth: "99.9%", pro: "99.95%" },
  { feature: "Support", starter: "Email", growth: "Priority", pro: "24/7 priority + Slack" },
  { feature: "Onboarding", starter: "Self-guided", growth: "Priority setup", pro: "Guided rollout + AI fine-tuning" },
];

const trustSignals = [
  { value: "< 3s", label: "Avg. first response" },
  { value: "12%+", label: "Visitor → Lead rate" },
  { value: "30%+", label: "Leads captured after hours" },
  { value: "99.9%", label: "Widget uptime" },
] as const;

const faqItems: FaqItem[] = [
  {
    q: "How does AivaSpa's pricing work?",
    a: "Plans are flat monthly subscriptions based on conversation volume, locations, and team features. You can pay monthly or save 20% with annual billing. Every plan includes the core widget, AI Q&A, lead capture, and dashboard — you only pay more when you need higher conversation limits, SMS, or multi-location routing.",
  },
  {
    q: "What counts as a conversation?",
    a: "A conversation is a single visitor session with the chat widget, even if it has many back-and-forth messages. If the same visitor returns later, that's a new conversation. Internal staff messages and bot configuration tests are not counted.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. Every plan starts with a 14-day free trial — no credit card required. You can install the widget, upload your FAQs, and capture real leads before you decide. Cancel anytime in one click.",
  },
  {
    q: "Can I switch plans later?",
    a: "Of course. You can upgrade or downgrade from your dashboard at any time. Upgrades take effect immediately and are pro-rated; downgrades take effect at the start of the next billing cycle.",
  },
  {
    q: "Do you sign a HIPAA Business Associate Agreement?",
    a: "AivaSpa is HIPAA-aware by default on every plan and includes a signed Business Associate Agreement at no extra cost. Pro also includes compliance & HIPAA audit reports.",
  },
  {
    q: "What happens if I go over my conversation limit?",
    a: "We'll never cut off a live chat. If you exceed your monthly limit, we email you a heads-up and add 1,000-conversation packs at $29 each. You can also set a hard cap from your dashboard if you prefer.",
  },
  {
    q: "Do I need Google Calendar or any third-party to take bookings?",
    a: "No. AivaSpa includes its own built-in calendar with working hours, buffer time, and email/SMS reminders — no Google OAuth, no extra account, no extra cost. Available from the Growth plan and up.",
  },
  {
    q: "How does the URL scraper work?",
    a: "On Growth and Pro, paste your med spa's website URL and AivaSpa auto-extracts your services, prices, durations, FAQs, working hours, and brand voice into the knowledge base. You review, tweak, and save — onboarding takes minutes, not days.",
  },
  {
    q: "Can the widget speak my visitors' language?",
    a: "Yes — Growth includes 12 languages (English, Spanish, French, German, Italian, Portuguese, Dutch, Polish, Turkish, Arabic, Chinese, Japanese) with browser auto-detect, a manual switcher, and full RTL support for Arabic. The AI itself replies in the same language, and the entire UI (form labels, errors, consent text) is translated.",
  },
  {
    q: "What does \"white-label\" actually mean on Pro?",
    a: "Two things. First, the chat widget runs under your own brand — no \"Powered by AivaSpa\" footer, your logo, your colors. Second, you can map up to 3 of your own domains (e.g. chat.yourspa.com) so the chat loads from your infrastructure. Pro agencies use this to offer AivaSpa to their med spa clients as their own product.",
  },
  {
    q: "Will the AI invent pricing or make medical claims?",
    a: "No. AivaSpa answers strictly from your approved knowledge base, never invents pricing, and never makes medical or outcome guarantees. A disclaimer is shown to every visitor, and treatment suitability is always deferred to a licensed provider during consultation.",
  },
  {
    q: "Do you offer annual billing or discounts?",
    a: "Yes — annual billing saves you 20% on Growth and Pro. We also offer volume discounts for med spa groups with 3+ locations. Contact sales@aivaspa.com for a custom quote.",
  },
];

const footerColumns = [
  {
    title: "Product",
    color: "#E2E54B",
    links: ["Chat widget", "AI engine", "Lead dashboard", "Notifications", "Analytics", "Integrations"],
  },
  {
    title: "Features",
    color: "#E2E54B",
    links: ["24/7 receptionist", "Approved KB answers", "Lead capture", "Email + SMS alerts", "Custom branding", "Multi-location"],
  },
  {
    title: "Company",
    color: "#FF77E9",
    links: ["About", "Customers", "Pricing", "Contact", "Careers", "Press"],
  },
  {
    title: "Resources",
    color: "#22D3EE",
    links: ["Docs", "Knowledge base", "Changelog", "HIPAA notice", "Privacy", "Terms"],
  },
] as const;

const socials = [
  { label: "f", color: "#E2E54B" },
  { label: "in", color: "#22D3EE" },
  { label: "𝕏", color: "#F7F8F8" },
  { label: "◎", color: "#FF77E9" },
  { label: "▶", color: "#EB5757" },
] as const;

function PriceNumber({ plan }: { plan: Plan }) {
  if (plan.price === "Custom") {
    return (
      <p className="mt-5 flex items-baseline gap-2">
        <span className="text-5xl font-bold tracking-tight text-[#F7F8F8]">Custom</span>
      </p>
    );
  }
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
          className="absolute -top-3.5 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#E2E54B]/60 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider shadow-[0_4px_20px_-4px_rgba(226,229,75,0.45)]"
          style={{ backgroundColor: "#E2E54B", color: "#08090A" }}
        >
          <Star className="size-3 fill-current" />
          Most popular
        </span>
      ) : null}
      <article
        className={`relative flex h-full flex-col overflow-hidden rounded-3xl border p-7 transition-colors ${isFeatured
          ? "border-[#E2E54B]/50 bg-gradient-to-b from-[#1A1B1E] to-[#121316]"
          : "border-[#23252A] bg-[#121316] hover:border-[#3A3D44]"
          }`}
      >
        {isFeatured ? (
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-3xl"
            style={{
              background:
                "linear-gradient(180deg, rgba(226,229,75,0.18) 0%, rgba(226,229,75,0) 60%)",
              mask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
              WebkitMask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
              padding: 1,
            }}
          />
        ) : null}

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
        {plan.suffix ? <p className="mt-1 text-xs text-[#62666D]">{plan.suffix}</p> : null}

        <p className="mt-5 min-h-16 text-sm leading-6 text-[#8A8F98]">{plan.description}</p>

        <a
          href={plan.cta.href}
          className={`mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-5 py-3.5 text-sm font-semibold transition ${isFeatured
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
                className={`transition hover:text-[#F7F8F8] ${link.label === "Pricing" ? "text-[#F7F8F8]" : ""
                  }`}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-2.5 md:flex">
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
            brand={
              <Logo className="size-8" />
            }
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
                <Zap className="size-3.5" />
                Simple, fair pricing · 14-day free trial
              </div>
            </Reveal>
            <Reveal>
              <h1 className="mt-7 text-5xl font-bold leading-[1.05] tracking-tight text-[#F7F8F8] md:text-6xl lg:text-7xl">
                Pay for results, not seats.
              </h1>
            </Reveal>
            <Reveal>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#8A8F98]">
                One flat monthly price per med spa — based on conversation volume, locations, and team features. No per-lead fees, no surprise SMS charges, no developer required.
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
            <Reveal>
              <p className="mt-5 flex items-center justify-center gap-2 text-xs text-[#62666D]">
                <span className="flex gap-1">
                  <span className="size-1 rounded-full bg-[#E2E54B]" />
                  <span className="size-1 rounded-full bg-[#E2E54B]" />
                  <span className="size-1 rounded-full bg-[#FF77E9]" />
                </span>
                No credit card · Cancel anytime · Save 20% on annual plans
              </p>
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
                className="rounded-2xl border border-[#23252A] bg-[#121316]/70 p-4 text-center backdrop-blur"
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
                Three plans, built around your med spa.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
                Start with what you need today. Upgrade the moment you need more locations, SMS, or advanced analytics.
              </p>
            </div>
          </Reveal>

          <RevealStagger
            amount={0.1}
            className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {plans.map((plan) => (
              <PlanCard key={plan.name} plan={plan} />
            ))}
          </RevealStagger>

          <Reveal>
            <p className="mx-auto mt-10 max-w-3xl text-center text-sm leading-6 text-[#62666D]">
              All plans include a 14-day free trial, the AI receptionist widget, lead capture, dashboard, and TLS-encrypted data handling. Annual billing saves 20% on Growth and Pro.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Comparison table */}
      <section className="relative border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-3 py-1 text-xs font-semibold text-[#22D3EE]">
                <Layers className="size-3" />
                Compare
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Every feature, side by side.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
                No fine print. Pick the row that matches your med spa today and the column you want to grow into.
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
                  className={`grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-3 px-6 py-4 text-sm ${i % 2 === 0 ? "bg-[#121316]" : "bg-[#0F1012]"
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

      {/* FAQ */}
      <section className="relative border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-xs font-semibold text-[#E2E54B]">
                <span className="size-1.5 rounded-full bg-[#E2E54B]" />
                Pricing FAQ
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Questions med spa owners ask.
              </h2>
            </div>
          </Reveal>
          <AnimatedFaq items={faqItems} />
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative py-24 lg:py-32">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <AnimatedClosingCta />
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
                  <h3 className="text-sm font-semibold text-[#F7F8F8] flex items-center gap-2">
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: col.color }} />
                    {col.title}
                  </h3>
                  <ul className="mt-4 space-y-2.5 text-sm text-[#8A8F98]">
                    {col.links.map((link) => (
                      <li key={link}>
                        <a href="#" className="inline-block transition hover:translate-x-1 hover:text-[#F7F8F8]">
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-[#23252A]/60 pt-6 text-xs text-[#62666D] md:flex-row md:items-center">
            <p>© 2026 AivaSpa, Inc. All rights reserved.</p>
            <div className="flex items-center gap-5">
              <a href="#privacy" className="hover:text-[#F7F8F8]">Privacy</a>
              <a href="#terms" className="hover:text-[#F7F8F8]">Terms</a>
              <a href="#hipaa" className="hover:text-[#F7F8F8]">HIPAA Notice</a>
              <a href="#status" className="hover:text-[#F7F8F8]">Status</a>
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
