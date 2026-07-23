import type { Metadata } from "next";
import { ArrowRight, Shield, Zap, Target } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { Reveal, RevealItem, RevealStagger } from "@/components/landing/motion-primitives";

export const metadata: Metadata = {
  title: "About",
  description:
    "AivaSpa — the 24/7 AI receptionist built exclusively for med spas. Founded by Abdul Wasay and Tayyab Hamdan.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About AivaSpa | 24/7 AI Receptionist for Med Spas",
    description: "AivaSpa — the 24/7 AI receptionist built exclusively for med spas.",
  },
};

const stats = [
  { value: "12%+", label: "Visitor-to-lead rate" },
  { value: "< 3s", label: "First response time" },
  { value: "24/7", label: "AI reception" },
  { value: "99.9%", label: "Uptime" },
] as const;

const values = [
  { icon: Shield, title: "Compliance first", body: "HIPAA-aware safeguards, disclaimers, and guardrails on every plan." },
  { icon: Target, title: "Built for med spas", body: "Not a generic chatbot. Every flow is tailored to how med spas sell." },
  { icon: Zap, title: "Instant value", body: "Live the same day. Paste one script, upload your FAQs, start capturing." },
] as const;

const team = [
  {
    name: "Abdul Wasay",
    role: "CEO & Co-founder",
    initials: "AW",
    bio: "Drives product strategy, growth, and customer success. Built AivaSpa to solve the exact problem med spa owners face every day — losing leads when no one is around to answer.",
  },
  {
    name: "Tayyab Hamdan",
    role: "CTO & Co-founder",
    initials: "TH",
    bio: "Architect behind the retrieval-only conversation engine, infrastructure, and AI systems. Designed AivaSpa to be fast, secure, and never invent answers.",
  },
] as const;

export default function AboutPage() {
  return (
    <MarketingPageShell activePage="About">
      {/* Hero */}
      <section className="relative overflow-hidden py-24 lg:py-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#E2E54B]/5 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#E2E54B]">About AivaSpa</p>
            </Reveal>
            <Reveal>
              <h1 className="mt-6 text-5xl font-bold leading-[1.08] tracking-tight text-[#F7F8F8] md:text-6xl lg:text-[72px]">
                The AI receptionist{" "}
                <span className="bg-gradient-to-r from-[#E2E54B] to-[#34D399] bg-clip-text text-transparent">
                  med spas actually need.
                </span>
              </h1>
            </Reveal>
            <Reveal>
              <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-[#8A8F98]">
                We exist because med spas lose leads every night, every weekend, every holiday.
                No generic chatbot fixes that. AivaSpa does.
              </p>
            </Reveal>
          </div>

          {/* Stats */}
          <RevealStagger className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map(({ value, label }) => (
              <RevealItem key={label}>
                <div className="group rounded-2xl border border-[#23252A] bg-[#121316]/60 p-5 text-center transition-colors hover:border-[#E2E54B]/30">
                  <p className="text-3xl font-bold tracking-tight text-[#F7F8F8]">{value}</p>
                  <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-[#62666D] group-hover:text-[#8A8F98] transition-colors">{label}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Story */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid items-center gap-16 lg:grid-cols-[1fr_1.1fr]">
            <Reveal>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#FF77E9]">Our story</p>
                <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-[44px]">
                  Built after watching $5K in leads vanish overnight.
                </h2>
                <p className="mt-6 text-base leading-relaxed text-[#8A8F98]">
                  Abdul Wasay and Tayyab Hamdan saw the same pattern at every med spa:
                  consultation requests disappearing over holidays, voicemail boxes filling up,
                  and contact forms going unchecked for days. Each missed lead worth $800+ in
                  revenue.
                </p>
                <p className="mt-4 text-base leading-relaxed text-[#8A8F98]">
                  So they built AivaSpa — an AI receptionist designed exclusively for med spas.
                  One that knows your services, respects your brand, and never goes offline.
                </p>
              </div>
            </Reveal>
            <Reveal>
              <div className="relative rounded-3xl border border-[#23252A] bg-[#121316] p-8">
                <div className="absolute -right-3 -top-3 size-24 rounded-full bg-[#E2E54B]/10 blur-2xl" />
                <div className="relative space-y-3">
                  {[
                    { time: "11:00 PM", event: "Visitor asks about Botox pricing" },
                    { time: "11:00 PM", event: "AivaSpa answers from approved KB" },
                    { time: "11:01 PM", event: "Captures name, phone, service interest" },
                    { time: "11:01 PM", event: "Staff notified instantly by email" },
                    { time: "9:00 AM", event: "Consultation booked next morning" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-xl border border-[#23252A] bg-[#0B0C0E] p-4 transition-colors hover:border-[#E2E54B]/20">
                      <span className="w-16 shrink-0 text-[11px] font-semibold text-[#62666D]">{item.time}</span>
                      <p className="text-sm text-[#C9CCD2]">{item.event}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#E2E54B]">What we believe</p>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Built on three principles.
              </h2>
            </div>
          </Reveal>
          <RevealStagger className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
            {values.map(({ icon: Icon, title, body }) => (
              <RevealItem key={title}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-[#23252A] bg-[#121316] p-7 transition-all hover:border-[#E2E54B]/30 hover:bg-[#16171A]">
                  <div className="absolute -right-8 -top-8 size-32 rounded-full bg-[#E2E54B]/5 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
                  <div className="relative">
                    <div className="flex size-12 items-center justify-center rounded-2xl border border-[#E2E54B]/20 bg-[#E2E54B]/10 text-[#E2E54B]">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="mt-5 text-xl font-bold tracking-tight text-[#F7F8F8]">{title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#8A8F98]">{body}</p>
                  </div>
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
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#22D3EE]">Team</p>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Meet the founders.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-[#8A8F98]">
                Two builders obsessed with solving one problem: never losing a med spa lead again.
              </p>
            </div>
          </Reveal>
          <RevealStagger className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-2">
            {team.map(({ name, role, initials, bio }) => (
              <RevealItem key={name}>
                <div className="group relative h-full overflow-hidden rounded-3xl border border-[#23252A] bg-[#121316] p-8 transition-all hover:border-[#E2E54B]/30">
                  <div className="absolute -right-6 -top-6 size-28 rounded-full bg-[#E2E54B]/5 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
                  <div className="relative">
                    <div className="flex size-16 items-center justify-center rounded-2xl border border-[#23252A] bg-[#1A1B1E] text-xl font-bold tracking-tight text-[#E2E54B]">
                      {initials}
                    </div>
                    <h3 className="mt-5 text-2xl font-bold tracking-tight text-[#F7F8F8]">{name}</h3>
                    <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-[#E2E54B]">{role}</p>
                    <p className="mt-4 text-sm leading-relaxed text-[#8A8F98]">{bio}</p>
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-4xl px-5 text-center lg:px-8">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
              Ready to stop losing leads?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-[#8A8F98]">
              Join med spas across the U.S. that capture every consultation request with AivaSpa.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="/demo"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-7 py-4 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90 sm:w-auto"
              >
                Try live demo
                <ArrowRight className="size-4" />
              </a>
              <a
                href="/signup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#23252A] bg-[#121316] px-7 py-4 text-sm font-semibold text-[#F7F8F8] transition hover:bg-[#1A1B1E] sm:w-auto"
              >
                Get started free
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingPageShell>
  );
}
