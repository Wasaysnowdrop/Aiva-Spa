import type { Metadata } from "next";
import { ArrowRight, Star, Check } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { Reveal, RevealItem, RevealStagger } from "@/components/landing/motion-primitives";

export const metadata: Metadata = {
  title: "Customers",
  description:
    "See how med spas across the U.S. use AivaSpa to capture more leads, book more consultations, and grow revenue — 24/7.",
  alternates: { canonical: "/customers" },
  openGraph: {
    title: "Customers | AivaSpa",
    description: "See how med spas use AivaSpa to capture more leads and grow revenue.",
  },
};

const logos = [
  "Glow Aesthetics", "Luxe Med Spa", "Bella Clinic", "Clear Skin Co", "Aesthetic Arts",
  "DermaGlow", "VitaSkin", "Radiance Med", "SkinFirst", "Serenity Skin",
];

const testimonials = [
  {
    name: "Sarah Kim",
    role: "Founder — Glow Aesthetics, Beverly Hills",
    quote: "We were losing after-hours leads every weekend. AivaSpa pays for itself in the first week. The AI knows our full service menu better than most front desk staff.",
    rating: 5,
    result: "34% more bookings",
  },
  {
    name: "Michael Torres",
    role: "Director — Luxe Med Spa, Miami",
    quote: "Our consultation bookings went up 34% in the first month. Name, phone, service, preferred time — captured instantly. We get an email the second a lead comes in.",
    rating: 5,
    result: "34% more bookings",
  },
  {
    name: "Jennifer Walsh",
    role: "Owner — Serenity Skin Studio, Austin",
    quote: "I used to check forms at 6am and find overnight inquiries. Now AivaSpa handles them in real time. Response time went from 8 hours to under 3 seconds.",
    rating: 5,
    result: "8hrs → 3s response",
  },
  {
    name: "Amir Patel",
    role: "Founder — DermaGlow Clinics, Chicago",
    quote: "The knowledge base is exactly what we needed. It answers what we tell it — no pricing games, no medical claims. Just clean, approved responses that convert.",
    rating: 5,
    result: "12% lead conversion",
  },
  {
    name: "Lisa Nakamura",
    role: "Manager — Radiance Med Spa, Seattle",
    quote: "We run 3 locations and AivaSpa handles all of them. One dashboard, every lead, every transcript. It's the tool I wish existed when I started the practice.",
    rating: 5,
    result: "3 locations supported",
  },
  {
    name: "Carlos Mendez",
    role: "Owner — VitaSkin Aesthetics, Denver",
    quote: "The proactive greeting feature increased our chat engagement by 40%. Visitors who would never fill out a form now start a conversation and book a consultation.",
    rating: 5,
    result: "40% more engagement",
  },
] as const;

const metrics = [
  { before: "8 hrs", after: "< 3s", label: "First response time", color: "#34D399" },
  { before: "Lost", after: "Captured", label: "After-hours leads", color: "#E2E54B" },
  { before: "$0", after: "$12K+", label: "Monthly recovered revenue", color: "#FF77E9" },
  { before: "Manual", after: "Automatic", label: "Lead follow-up process", color: "#22D3EE" },
] as const;

const industries = [
  { name: "Medical Spas", percent: 45 },
  { name: "Aesthetics Clinics", percent: 25 },
  { name: "Dermatology", percent: 18 },
  { name: "Wellness Centers", percent: 12 },
] as const;

export default function CustomersPage() {
  return (
    <MarketingPageShell activePage="Customers">
      {/* Hero */}
      <section className="relative overflow-hidden py-24 lg:py-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#E2E54B]/5 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#E2E54B]">Customers</p>
            </Reveal>
            <Reveal>
              <h1 className="mt-6 text-5xl font-bold leading-[1.08] tracking-tight text-[#F7F8F8] md:text-6xl lg:text-[72px]">
                Med spas that{" "}
                <span className="bg-gradient-to-r from-[#E2E54B] to-[#34D399] bg-clip-text text-transparent">
                  never miss a lead.
                </span>
              </h1>
            </Reveal>
            <Reveal>
              <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-[#8A8F98]">
                From single-location practices to multi-site groups — AivaSpa captures every consultation request, day or night.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Trusted by — marquee style */}
      <section className="border-y border-[#23252A]/60 bg-[#0B0C0E] py-12">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-[#62666D]">
            Trusted by modern med spas across the U.S.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {logos.map((name) => (
              <div
                key={name}
                className="flex h-11 items-center rounded-full border border-[#23252A] bg-[#121316]/80 px-5 text-xs font-medium text-[#62666D] transition-colors hover:border-[#E2E54B]/30 hover:text-[#8A8F98]"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Metrics — before vs after */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#22D3EE]">Results</p>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                The numbers speak for themselves.
              </h2>
            </div>
          </Reveal>
          <RevealStagger className="mx-auto mt-14 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map(({ before, after, label, color }) => (
              <RevealItem key={label}>
                <div className="group rounded-2xl border border-[#23252A] bg-[#121316] p-6 text-center transition-all hover:border-[#E2E54B]/20">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#62666D]">{label}</p>
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <span className="text-xl font-bold text-[#EB5757]/70 line-through">{before}</span>
                    <ArrowRight className="size-4 text-[#62666D]" />
                    <span className="text-xl font-bold" style={{ color }}>{after}</span>
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#E2E54B]">Testimonials</p>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                What med spa owners say.
              </h2>
            </div>
          </Reveal>
          <RevealStagger className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map(({ name, role, quote, rating, result }) => (
              <RevealItem key={name}>
                <div className="group flex h-full flex-col rounded-3xl border border-[#23252A] bg-[#121316] p-7 transition-all hover:border-[#E2E54B]/20">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: rating }).map((_, i) => (
                      <Star key={i} className="size-3.5 fill-[#E2E54B] text-[#E2E54B]" />
                    ))}
                  </div>
                  <p className="mt-4 flex-1 text-[15px] leading-relaxed text-[#C9CCD2]">
                    &ldquo;{quote}&rdquo;
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-[#23252A] pt-4">
                    <div>
                      <p className="text-sm font-semibold text-[#F7F8F8]">{name}</p>
                      <p className="text-[11px] text-[#62666D]">{role}</p>
                    </div>
                    <span className="rounded-full border border-[#E2E54B]/30 bg-[#E2E54B]/10 px-3 py-1 text-[10px] font-semibold text-[#E2E54B]">
                      {result}
                    </span>
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Industry breakdown */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#FF77E9]">Industries</p>
                <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                  Built for every aesthetics practice.
                </h2>
                <p className="mt-5 text-base leading-relaxed text-[#8A8F98]">
                  Whether you run a solo med spa or a multi-location group, AivaSpa adapts to your services, your hours, and your brand.
                </p>
              </div>
            </Reveal>
            <Reveal>
              <div className="space-y-5">
                {industries.map(({ name, percent }) => (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[#F7F8F8]">{name}</span>
                      <span className="text-sm font-bold text-[#E2E54B]">{percent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#1A1B1E]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#E2E54B] to-[#34D399] transition-all duration-700"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Why they switched */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#22D3EE]">Why switch</p>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                What they were struggling with.
              </h2>
            </div>
          </Reveal>
          <RevealStagger className="mx-auto mt-14 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Missed leads after hours and on weekends",
              "Slow response times losing consultations",
              "Generic chatbots giving wrong answers",
              "No visibility into website visitor intent",
              "Manual follow-up eating up staff time",
              "Inconsistent brand voice across channels",
            ].map((problem) => (
              <RevealItem key={problem}>
                <div className="flex items-start gap-3 rounded-2xl border border-[#23252A] bg-[#121316] p-5 transition-all hover:border-[#34D399]/30">
                  <Check className="mt-0.5 size-4 shrink-0 text-[#34D399]" />
                  <span className="text-sm text-[#C9CCD2]">{problem}</span>
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
              Join med spas capturing leads 24/7.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-[#8A8F98]">
              Start with a free demo. No signup required. See how AivaSpa works on your own website.
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
                href="/pricing"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#23252A] bg-[#121316] px-7 py-4 text-sm font-semibold text-[#F7F8F8] transition hover:bg-[#1A1B1E] sm:w-auto"
              >
                View pricing
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingPageShell>
  );
}
