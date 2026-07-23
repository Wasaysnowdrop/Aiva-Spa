import type { Metadata } from "next";
import { ArrowRight, Code, Globe, Heart, Shield, Users, Zap } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { Reveal, RevealItem, RevealStagger } from "@/components/landing/motion-primitives";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about AivaSpa — the 24/7 AI receptionist built exclusively for med spas. Our mission, team, and the technology behind every captured lead.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About AivaSpa | 24/7 AI Receptionist for Med Spas",
    description: "Learn about AivaSpa — the 24/7 AI receptionist built exclusively for med spas.",
  },
};

const values = [
  {
    icon: Shield,
    title: "Compliance first",
    body: "Every feature is designed with HIPAA-aware safeguards, disclaimers, and guardrails. We never let the AI drift off-brand or make medical claims.",
  },
  {
    icon: Heart,
    title: "Built for med spas",
    body: "We're not a generic chatbot. Every conversation flow, every prompt, every integration is tailored to the way med spas sell treatments and book consultations.",
  },
  {
    icon: Zap,
    title: "Instant value",
    body: "No 6-month implementation. Most med spas are live the same day. Paste one script, upload your FAQs, and start capturing leads immediately.",
  },
  {
    icon: Users,
    title: "Owner-obsessed",
    body: "We build for the med spa owner who wears five hats. Every dashboard feature saves time, every notification drives action, every report shows ROI.",
  },
  {
    icon: Globe,
    title: "Remote-first",
    body: "Our distributed team spans the U.S. We ship fast, respond fast, and support med spa owners across every time zone.",
  },
  {
    icon: Code,
    title: "AI that stays in its lane",
    body: "Retrieval-only architecture means the AI never invents pricing, never makes clinical claims, and always defers to a licensed provider.",
  },
] as const;

const timeline = [
  { year: "2025", event: "AivaSpa founded with a single mission: stop med spas from losing leads after hours." },
  { year: "2025", event: "First pilot with 10 med spas across the U.S. 12%+ visitor-to-lead conversion rate validated." },
  { year: "2026", event: "Public launch. Starter, Growth, and Pro plans available. Google Calendar integration shipped." },
  { year: "2026", event: "Multi-location support, white-label widget, and API access for enterprise med spa groups." },
] as const;

const team = [
  { name: "Alex Rivera", role: "CEO & Co-founder", bio: "Former product lead at a top health-tech SaaS. Built AI tools used by 500+ clinics." },
  { name: "Jordan Patel", role: "CTO & Co-founder", bio: "Ex-cloud infrastructure engineer. Designed the retrieval-only conversation engine from scratch." },
  { name: "Morgan Lee", role: "Head of Design", bio: "10 years designing SaaS dashboards. Obsessed with making complex data feel simple." },
  { name: "Casey Chen", role: "Head of Customer Success", bio: "Helped 200+ med spas go live. Knows every onboarding workflow inside out." },
] as const;

const stats = [
  ["12%+", "Visitor-to-lead rate"],
  ["< 3s", "Average first response"],
  ["24/7", "AI reception coverage"],
  ["99.9%", "Widget uptime"],
] as const;

export default function AboutPage() {
  return (
    <MarketingPageShell activePage="About">
      {/* Hero */}
      <section className="relative py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3.5 py-1.5 text-xs font-semibold text-[#E2E54B]">
                <span className="size-1.5 rounded-full bg-[#E2E54B]" />
                About AivaSpa
              </div>
            </Reveal>
            <Reveal>
              <h1 className="mt-7 text-5xl font-bold leading-[1.05] tracking-tight text-[#F7F8F8] md:text-6xl lg:text-7xl">
                The AI receptionist med spas actually need.
              </h1>
            </Reveal>
            <Reveal>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#8A8F98]">
                AivaSpa exists because med spas lose leads every night, every weekend, every holiday — and no generic chatbot fixes that. We built a purpose-driven AI that answers from your approved knowledge base, captures consultation requests, and pings your staff instantly.
              </p>
            </Reveal>
          </div>

          <RevealStagger className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map(([value, label]) => (
              <RevealItem key={label} className="rounded-2xl border border-[#23252A] bg-[#121316]/70 p-4 text-center">
                <p className="text-2xl font-bold text-[#F7F8F8] md:text-3xl">{value}</p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-[#62666D]">{label}</p>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Our Story */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#FF77E9]/40 bg-[#FF77E9]/10 px-3 py-1 text-xs font-semibold text-[#FF77E9]">
                  <span className="size-1.5 rounded-full bg-[#FF77E9]" />
                  Our story
                </div>
                <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                  Started with one frustrated med spa owner.
                </h2>
                <p className="mt-5 text-base leading-8 text-[#8A8F98]">
                  The founder watched three consultation requests disappear over a holiday weekend — each one worth $800+ in revenue. The generic website chatbot couldn&apos;t answer a single treatment question. The voicemail box was full. And the contact form went unchecked until Tuesday.
                </p>
                <p className="mt-4 text-base leading-8 text-[#8A8F98]">
                  That&apos;s when the idea was born: an AI receptionist built exclusively for med spas — one that knows your services, your hours, your tone, and never goes offline.
                </p>
              </div>
            </Reveal>
            <Reveal>
              <div className="rounded-3xl border border-[#23252A] bg-[#121316] p-8">
                <div className="space-y-4">
                  {[
                    { icon: "💬", text: "Visitor asks about Botox pricing at 11pm" },
                    { icon: "🤖", text: "AivaSpa answers from the approved KB" },
                    { icon: "📋", text: "Captures name, phone, service interest" },
                    { icon: "📧", text: "Staff notified instantly by email" },
                    { icon: "📅", text: "Consultation booked next morning" },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-xl border border-[#23252A] bg-[#0B0C0E] p-4">
                      <span className="text-xl">{step.icon}</span>
                      <p className="text-sm text-[#C9CCD2]">{step.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-xs font-semibold text-[#E2E54B]">
              <span className="size-1.5 rounded-full bg-[#E2E54B]" />
              Mission
            </div>
            <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
              Every med spa deserves a 24/7 receptionist.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
              Our mission is to eliminate missed leads for med spas. Not with a generic chatbot, but with a purpose-built AI that knows your treatments, respects your brand, and captures every consultation request — day or night.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Why AivaSpa Exists */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-3 py-1 text-xs font-semibold text-[#22D3EE]">
                <span className="size-1.5 rounded-full bg-[#22D3EE]" />
                Why we exist
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                The problem is real.
              </h2>
            </div>
          </Reveal>
          <RevealStagger className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { stat: "62%", label: "of med spa leads come after hours", color: "#FF77E9" },
              { stat: "$1,200+", label: "average lost revenue per missed lead", color: "#E2E54B" },
              { stat: "48 hrs", label: "average response time for web forms", color: "#22D3EE" },
            ].map(({ stat, label, color }) => (
              <RevealItem key={label}>
                <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-6 text-center">
                  <p className="text-3xl font-bold" style={{ color }}>{stat}</p>
                  <p className="mt-2 text-sm text-[#8A8F98]">{label}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-xs font-semibold text-[#E2E54B]">
                <span className="size-1.5 rounded-full bg-[#E2E54B]" />
                How it works
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Live in an afternoon.
              </h2>
            </div>
          </Reveal>
          <RevealStagger className="mt-12 grid gap-5 md:grid-cols-4">
            {[
              { step: "01", title: "Install the widget", body: "Paste one script tag. Under 50KB, loads lazily." },
              { step: "02", title: "Upload your KB", body: "Services, FAQs, hours, and guardrails." },
              { step: "03", title: "Match your brand", body: "Logo, colors, greeting, proactive prompts." },
              { step: "04", title: "Capture leads 24/7", body: "AI greets, qualifies, and notifies staff instantly." },
            ].map(({ step, title, body }) => (
              <RevealItem key={step}>
                <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-6">
                  <span className="text-3xl font-bold text-[#E2E54B]">{step}</span>
                  <h3 className="mt-3 text-lg font-semibold text-[#F7F8F8]">{title}</h3>
                  <p className="mt-2 text-sm text-[#8A8F98]">{body}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Timeline */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF77E9]/40 bg-[#FF77E9]/10 px-3 py-1 text-xs font-semibold text-[#FF77E9]">
              <span className="size-1.5 rounded-full bg-[#FF77E9]" />
              Timeline
            </div>
            <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
              Our journey.
            </h2>
          </Reveal>
          <div className="mt-10 space-y-6">
            {timeline.map((item, i) => (
              <Reveal key={i}>
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="flex size-10 items-center justify-center rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 text-sm font-bold text-[#E2E54B]">
                      {item.year}
                    </span>
                    {i < timeline.length - 1 && <div className="mt-2 w-px flex-1 bg-[#23252A]" />}
                  </div>
                  <p className="pb-6 text-sm leading-7 text-[#C9CCD2]">{item.event}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-xs font-semibold text-[#E2E54B]">
                <span className="size-1.5 rounded-full bg-[#E2E54B]" />
                Our values
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                What drives us.
              </h2>
            </div>
          </Reveal>
          <RevealStagger className="mt-12 grid gap-5 md:grid-cols-3">
            {values.map(({ icon: Icon, title, body }) => (
              <RevealItem key={title}>
                <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-6">
                  <div className="flex size-11 items-center justify-center rounded-2xl border border-[#E2E54B]/40 bg-[#E2E54B]/10 text-[#E2E54B]">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[#F7F8F8]">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#8A8F98]">{body}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Team */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-3 py-1 text-xs font-semibold text-[#22D3EE]">
                <span className="size-1.5 rounded-full bg-[#22D3EE]" />
                Team
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Meet the people behind AivaSpa.
              </h2>
            </div>
          </Reveal>
          <RevealStagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {team.map(({ name, role, bio }) => (
              <RevealItem key={name}>
                <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-6">
                  <div className="flex size-14 items-center justify-center rounded-full border border-[#23252A] bg-[#1A1B1E] text-lg font-bold text-[#E2E54B]">
                    {name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[#F7F8F8]">{name}</h3>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#E2E54B]">{role}</p>
                  <p className="mt-3 text-sm text-[#8A8F98]">{bio}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Technology */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-xs font-semibold text-[#E2E54B]">
                <span className="size-1.5 rounded-full bg-[#E2E54B]" />
                Technology
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Built on modern infrastructure.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
                Supabase for the database, Cloudflare Workers AI for the conversation engine, and a retrieval-only architecture that never invents answers.
              </p>
            </div>
          </Reveal>
          <RevealStagger className="mt-12 grid gap-5 sm:grid-cols-3">
            {[
              { title: "Retrieval-only AI", body: "The conversation engine answers strictly from your approved knowledge base. No invented pricing, no medical claims." },
              { title: "Encrypted end-to-end", body: "TLS 1.2+ in transit, AES-256 at rest. Role-based access and audit logs on every plan." },
              { title: "Sub-50KB widget", body: "Loads lazily without impacting page speed. Works on any website, any CMS, any hosting provider." },
            ].map(({ title, body }) => (
              <RevealItem key={title}>
                <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-6">
                  <h3 className="text-lg font-semibold text-[#F7F8F8]">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#8A8F98]">{body}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Security */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF77E9]/40 bg-[#FF77E9]/10 px-3 py-1 text-xs font-semibold text-[#FF77E9]">
              <Shield className="size-3.5" />
              Security
            </div>
            <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
              Your data, protected.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
              HIPAA-aware safeguards, encryption at rest and in transit, role-based access, audit logs, and configurable retention windows. Read our{" "}
              <a href="/legal/hipaa" className="text-[#E2E54B] hover:underline">HIPAA Notice</a>{" "}
              for full details.
            </p>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
              Ready to stop losing leads?
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
              Join med spas across the U.S. that capture every consultation request with AivaSpa.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="/demo" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-6 py-3.5 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90 sm:w-auto">
                Try live demo
                <ArrowRight className="size-4" />
              </a>
              <a href="/signup" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#23252A] bg-[#121316] px-6 py-3.5 text-sm font-semibold text-[#F7F8F8] transition hover:bg-[#1A1B1E] sm:w-auto">
                Get started free
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingPageShell>
  );
}
