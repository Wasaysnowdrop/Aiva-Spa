import {
  ArrowRight,
  CalendarCheck,
  Check,
  Inbox,
  LineChart,
  Mail,
  MessageCircle,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { AnimatedAnalyticsVisual } from "@/components/landing/animated-analytics";
import { AnimatedChatWidget } from "@/components/landing/animated-chat-widget";
import { AnimatedClosingCta } from "@/components/landing/animated-closing-cta";
import { AnimatedDashboardPreview } from "@/components/landing/animated-dashboard";
import { AnimatedFaq } from "@/components/landing/animated-faq";
import { AnimatedKbVisual, AnimatedLeadVisual, AnimatedPipelineVisual } from "@/components/landing/feature-visuals";
import { AnimatedTestimonials } from "@/components/landing/animated-testimonials";
import { AnimatedSteps } from "@/components/landing/animated-steps";
import { ColorCard } from "@/components/landing/color-card";
import { FloatingShapes } from "@/components/landing/floating-shapes";
import { HeroNotifications } from "@/components/landing/hero-notifications";
import { MarqueeLogos } from "@/components/landing/marquee-logos";
import { MobileMenu } from "@/components/landing/mobile-menu";
import { Reveal, RevealItem, RevealStagger } from "@/components/landing/motion-primitives";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "AivaSpa | The 24/7 AI receptionist for med spas",
  description:
    "AivaSpa greets every med spa website visitor, answers treatment questions from your approved knowledge base, captures consultation leads, and pings your staff instantly by email.",
};

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

const valueProps = [
  {
    color: "indigo" as const,
    icon: ShieldCheck,
    title: "Built for med spas",
    body: "Trained around treatment flows, not generic support. Botox, fillers, laser, facials, body contouring — your services, your tone, your disclaimers.",
  },
  {
    color: "yellow" as const,
    icon: Wand2,
    title: "Powered by AI",
    body: "A retrieval-only conversation engine answers strictly from your approved knowledge base. No invented pricing, no medical claims, no off-brand replies.",
  },
  {
    color: "pink" as const,
    icon: CalendarCheck,
    title: "Designed for bookings",
    body: "Captures name, phone, email, service interest, and preferred time. Pushes structured leads to your dashboard and pings staff instantly.",
  },
];

const features = [
  {
    color: "indigo" as const,
    eyebrow: "Lead capture",
    title: "Make lead capture self-driving",
    body: "Stop losing visitors to slow replies and missed forms. AivaSpa detects buying intent mid-conversation, collects the right details, and drops a structured lead into your dashboard before the visitor closes the tab.",
    bullets: [
      "Name, phone, email, service interest, preferred time",
      "Validates phone & email format as you type",
      "Saves partial leads if a visitor drops off",
      "Tags source URL, after-hours flag, and service",
    ],
    visual: <AnimatedLeadVisual />,
  },
  {
    color: "yellow" as const,
    eyebrow: "Conversation engine",
    title: "Answer treatment questions instantly",
    body: "A 24/7 receptionist that knows your menu, your hours, and your voice. Every answer is grounded in your approved knowledge base so pricing and clinical claims never drift.",
    bullets: [
      "Multi-turn memory within a session",
      "Graceful fallback to staff handoff",
      "Configurable greeting & proactive prompt",
      "Branding matches your spa (logo, colors, tone)",
    ],
    visual: <AnimatedKbVisual />,
  },
  {
    color: "pink" as const,
    eyebrow: "Pipeline",
    title: "Move every lead into a booked consultation",
    body: "Leads land in a focused inbox with status, transcript, and source. Filter, assign, follow up, and mark Booked — without juggling DMs, voicemail, and spreadsheets.",
    bullets: [
      "Statuses: New → Contacted → Booked → Lost",
      "Full chat transcript on every lead",
      "Search & filter by service, date, status",
      "One-click contact: call, email, or text",
    ],
    visual: <AnimatedPipelineVisual />,
  },
  {
    color: "green" as const,
    eyebrow: "Analytics",
    title: "Understand your pipeline at a glance",
    body: "A minimal dashboard shows visitor-to-lead conversion, after-hours share, and time-to-first-response — so you know exactly where revenue is leaking and where to invest.",
    bullets: [
      "Visitor → Lead conversion rate",
      "After-hours leads captured",
      "Average first-response time",
      "Service interest breakdown",
    ],
    visual: <AnimatedAnalyticsVisual />,
  },
] as const;

const faqs = [
  {
    q: "Does the AI give medical advice or quote firm prices?",
    a: "No. AivaSpa is configured to answer only from your approved knowledge base, never invent pricing, and never make medical or outcome claims. It always defers treatment suitability and pricing to a licensed provider during consultation, and a disclaimer is shown to every visitor.",
  },
  {
    q: "How long does it take to go live?",
    a: "Most med spas are live in under a day. You paste one script tag onto your site, upload your FAQs and services, set your branding, and AivaSpa starts greeting visitors immediately.",
  },
  {
    q: "What happens to leads after they're captured?",
    a: "Leads are saved to your dashboard with full transcript, source URL, and after-hours flag. You and your staff receive an instant email, and the lead is queued for follow-up — no lead is ever lost.",
  },
  {
    q: "Can my team manage the knowledge base and branding?",
    a: "Yes. The dashboard includes an FAQ editor, a service catalog, branding controls (logo, colors, greeting, position), and team management with roles.",
  },
  {
    q: "Is visitor data handled safely?",
    a: "Data is encrypted in transit (TLS) and at rest, with role-based access. AivaSpa is HIPAA-aware in its handling of PII, supports data deletion requests, and offers configurable retention windows.",
  },
] as const;

const footerColumns = [
  {
    title: "Product",
    color: "#E2E54B",
    links: ["Chat widget", "AI engine", "Lead dashboard", "Notifications", "Analytics", "Integrations"],
  },
  {
    title: "Features",
    color: "#E2E54B",
    links: ["24/7 receptionist", "Approved KB answers", "Lead capture", "Email alerts", "Custom branding", "Multi-location"],
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

const stepList = [
  {
    step: "01",
    title: "Install the widget",
    body: "Paste one script tag into your website. The widget is < 50KB and loads lazily — no impact on page speed.",
  },
  {
    step: "02",
    title: "Upload your services & FAQs",
    body: "Add treatments, hours, and policies to your approved knowledge base. The AI answers strictly from these.",
  },
  {
    step: "03",
    title: "Match your brand",
    body: "Set your spa's logo, colors, greeting message, and proactive prompt timing.",
  },
  {
    step: "04",
    title: "Capture & notify",
    body: "AivaSpa greets visitors, captures leads, and sends email to your team the moment a lead comes in.",
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08090A] text-[#F7F8F8]">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-[#23252A]/60 bg-[#08090A]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 lg:px-8">
          <a href="#top" className="flex items-center gap-2.5" aria-label="AivaSpa home">
            <Logo />
          </a>
          <nav className="hidden items-center gap-8 text-sm text-[#8A8F98] md:flex">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} className="transition hover:text-[#F7F8F8]">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-2.5 md:flex">
            <a
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#F7F8F8] transition hover:bg-[#1A1B1E]"
            >
              Login
            </a>
            <a
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E2E54B] px-4 py-2 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90"
            >
              Get started
              <ArrowRight className="size-3.5" />
            </a>
          </div>
          <MobileMenu
            links={navLinks}
            brand={
              <Logo className="size-8" />
            }
            rightSlot={
              <a
                href="/signup"
                className="inline-flex items-center gap-1 rounded-md bg-[#E2E54B] px-3 py-1.5 text-xs font-semibold text-[#08090A]"
              >
                Get started
              </a>
            }
          />
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative">
        <FloatingShapes variant="hero" />
        <div className="relative mx-auto max-w-7xl px-5 pb-24 pt-20 lg:px-8 lg:pb-32 lg:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#23252A] bg-[#121316] px-3.5 py-1.5 text-xs font-medium text-[#8A8F98]">
                <span className="size-1.5 rounded-full bg-[#34D399]" />
                <span>Now live in beta · private preview</span>
              </div>
            </Reveal>
            <Reveal>
              <h1 className="mt-7 text-5xl font-bold leading-[1.05] tracking-tight text-[#F7F8F8] md:text-6xl lg:text-7xl">
                Stop Losing Med Spa Leads After Hours
              </h1>
            </Reveal>
            <Reveal>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#8A8F98]">
                Your AI Receptionist answers questions, captures leads, and books consultations 24/7.
              </p>
            </Reveal>
            <Reveal>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href="/signup"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-6 py-3.5 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90 sm:w-auto"
                >
                  Get More Consultations
                  <ArrowRight className="size-4" />
                </a>
                <a
                  href="#how-it-works"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#23252A] bg-[#121316] px-6 py-3.5 text-sm font-semibold text-[#F7F8F8] transition hover:bg-[#1A1B1E] sm:w-auto"
                >
                  Watch Demo
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
                Free 7-day Growth trial · No credit card · Cancel anytime
              </p>
            </Reveal>
          </div>

          <div className="relative mx-auto mt-16 grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_1fr]">
            <Reveal amount={0.1}>
              <AnimatedChatWidget />
            </Reveal>
            <div className="space-y-3">
              <HeroNotifications />
            </div>
          </div>
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

      {/* Value section */}
      <section id="product" className="relative py-24 lg:py-32">
        <FloatingShapes variant="section" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-xs font-semibold text-[#E2E54B]">
                <span className="size-1.5 rounded-full bg-[#E2E54B]" />
                Why AivaSpa
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                A receptionist that never sleeps, never drifts off-brand.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
                Built specifically for the way med spas sell — across services, treatments, and consultations.
              </p>
            </div>
          </Reveal>
          <RevealStagger className="mt-16 grid gap-5 md:grid-cols-3">
            {valueProps.map(({ color, icon: Icon, title, body }) => (
              <RevealItem key={title}>
                <ColorCard color={color}>
                  <div
                    className="flex size-11 items-center justify-center rounded-2xl border"
                    style={{
                      backgroundColor: `${color === "indigo" ? "#E2E54B" : color === "yellow" ? "#E2E54B" : "#FF77E9"}1A`,
                      borderColor: `${color === "indigo" ? "#E2E54B" : color === "yellow" ? "#E2E54B" : "#FF77E9"}40`,
                      color: color === "indigo" ? "#E2E54B" : color === "yellow" ? "#E2E54B" : "#FF77E9",
                    }}
                  >
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-[#F7F8F8]">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#8A8F98]">{body}</p>
                  <div className="mt-6 flex items-center gap-1.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span
                        key={i}
                        className="size-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            color === "indigo" ? "#E2E54B" : color === "yellow" ? "#E2E54B" : "#FF77E9",
                          opacity: 0.4 + i * 0.3,
                        }}
                      />
                    ))}
                  </div>
                </ColorCard>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Feature blocks */}
      <section id="features" className="relative border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-xs font-semibold text-[#E2E54B]">
                <span className="size-1.5 rounded-full bg-[#E2E54B]" />
                Features
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                From first hello to confirmed appointment.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
                Every step of the visitor-to-patient journey, automated and on-brand.
              </p>
            </div>
          </Reveal>

          <div className="mt-20 space-y-28 lg:space-y-40">
            {features.map((feature, i) => {
              const colorHex =
                feature.color === "indigo"
                  ? "#E2E54B"
                  : feature.color === "yellow"
                    ? "#E2E54B"
                    : feature.color === "pink"
                      ? "#FF77E9"
                      : "#34D399";
              return (
                <Reveal key={feature.title}>
                  <article
                    className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                      i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
                    }`}
                  >
                    <div>
                      <div
                        className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: `${colorHex}1A`,
                          borderColor: `${colorHex}40`,
                          color: colorHex,
                        }}
                      >
                        <span className="size-1.5 rounded-full" style={{ backgroundColor: colorHex }} />
                        {feature.eyebrow}
                      </div>
                      <h3 className="mt-4 text-3xl font-bold tracking-tight text-[#F7F8F8] md:text-4xl">
                        {feature.title}
                      </h3>
                      <p className="mt-5 text-base leading-8 text-[#8A8F98]">{feature.body}</p>
                      <ul className="mt-7 space-y-3">
                        {feature.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-3 text-sm text-[#F7F8F8]">
                            <span
                              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border bg-[#1A1B1E]"
                              style={{ borderColor: `${colorHex}40`, color: colorHex }}
                            >
                              <Check className="size-3" />
                            </span>
                            <span className="text-[#C9CCD2]">{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>{feature.visual}</div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
            <Reveal>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#FF77E9]/40 bg-[#FF77E9]/10 px-3 py-1 text-xs font-semibold text-[#FF77E9]">
                  <span className="size-1.5 rounded-full bg-[#FF77E9]" />
                  How it works
                </div>
                <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                  Up and running in an afternoon.
                </h2>
                <p className="mt-5 text-base leading-8 text-[#8A8F98]">
                  No code, no developers. Paste one snippet, upload your FAQs, and AivaSpa is greeting visitors the same day.
                </p>
                <a
                  href="/signup"
                  className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#E2E54B] hover:text-[#E2E54B]/80"
                >
                  Start your free trial
                  <ArrowRight className="size-3.5" />
                </a>
              </div>
            </Reveal>
            <AnimatedSteps steps={[...stepList]} />
          </div>
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="relative border-t border-[#23252A]/60 py-24 lg:py-32">
        <FloatingShapes variant="section" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-3 py-1 text-xs font-semibold text-[#22D3EE]">
                <span className="size-1.5 rounded-full bg-[#22D3EE]" />
                Dashboard
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Your leads, your dashboard.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
                A focused inbox and a clean analytics view — everything you need to follow up, in one place.
              </p>
            </div>
          </Reveal>
          <div className="mt-16">
            <AnimatedDashboardPreview />
          </div>
          <RevealStagger className="mt-12 grid gap-5 sm:grid-cols-3">
            {[
              { icon: Inbox, title: "Leads inbox", body: "Status, transcript, and source on every lead.", color: "#E2E54B" },
              { icon: LineChart, title: "Conversion analytics", body: "Visitor → Lead, after-hours, reply time.", color: "#34D399" },
              { icon: ShieldCheck, title: "Compliance-first", body: "Approved KB, disclaimers, audit log.", color: "#E2E54B" },
            ].map(({ icon: Icon, title, body, color }) => (
              <RevealItem key={title}>
                <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-6 transition-colors hover:border-[#23252A]/60">
                  <div
                    className="flex size-9 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${color}1A`, color }}
                  >
                    <Icon className="size-4" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[#F7F8F8]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#8A8F98]">{body}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-xs font-semibold text-[#E2E54B]">
                <span className="size-1.5 rounded-full bg-[#E2E54B]" />
                Loved by med spa teams
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Real teams. Real booked consultations.
              </h2>
            </div>
          </Reveal>
          <AnimatedTestimonials />
        </div>
      </section>

      {/* Sample conversation snippet */}
      <section className="border-t border-[#23252A]/60 bg-[#0B0C0E] py-20">
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <Reveal>
            <div className="rounded-3xl border border-[#23252A] bg-[#121316] p-6 sm:p-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#8A8F98]">
                  <span className="flex size-6 items-center justify-center rounded-md bg-[#E2E54B]/20 text-[#E2E54B]">
                    <MessageCircle className="size-3.5" />
                  </span>
                  Sample conversation
                </div>
                <span className="text-[10px] text-[#62666D]">Example transcript</span>
              </div>
              <div className="mt-6 space-y-3">
                {[
                  { who: "Visitor", text: "Do you offer Botox?", color: "#8A8F98" },
                  { who: "AivaSpa", text: "Yes, we offer Botox consultations. Would you like to book one?", color: "#E2E54B" },
                  { who: "Visitor", text: "How much?", color: "#8A8F98" },
                  { who: "AivaSpa", text: "Pricing depends on the units needed. A licensed provider can confirm exact pricing during your consultation. May I collect your details to set it up?", color: "#E2E54B" },
                  { who: "Visitor", text: "Sure.", color: "#8A8F98" },
                  { who: "AivaSpa", text: "Great! What's your name, phone, and a preferred time? (captures lead)", color: "#E2E54B" },
                ].map((row, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 rounded-xl border p-3 ${
                      row.who === "Visitor"
                        ? "border-[#23252A] bg-[#1A1B1E]"
                        : "border-[#E2E54B]/30 bg-[#E2E54B]/10"
                    }`}
                  >
                    <span
                      className="mt-0.5 w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: row.color }}
                    >
                      {row.who}
                    </span>
                    <p className="text-sm text-[#F7F8F8]">{row.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative border-t border-[#23252A]/60 py-24 lg:py-32">
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
          <AnimatedFaq items={[...faqs]} />
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
              <a href="#top" className="flex items-center gap-2.5" aria-label="AivaSpa home">
                <Logo />
              </a>
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
              <div className="mt-8 flex items-center gap-2 text-xs text-[#62666D]">
                <span className="flex size-7 items-center justify-center rounded-md bg-[#34D399]/20 text-[#34D399]">
                  <Mail className="size-3.5" />
                </span>
                hello@aivaspa.com
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
              <a href="/legal/privacy" className="hover:text-[#F7F8F8]">Privacy</a>
              <a href="/legal/terms" className="hover:text-[#F7F8F8]">Terms</a>
              <a href="/legal/hipaa" className="hover:text-[#F7F8F8]">HIPAA Notice</a>
              <a href="/status" className="hover:text-[#F7F8F8]">Status</a>
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
