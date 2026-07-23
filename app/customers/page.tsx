import type { Metadata } from "next";
import { ArrowRight, Star, TrendingUp, Users, Quote } from "lucide-react";
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

const testimonials = [
  {
    name: "Dr. Sarah Kim",
    role: "Owner, Glow Aesthetics — Beverly Hills, CA",
    quote: "We were losing $5K+ per month in after-hours leads. AivaSpa pays for itself in the first week. The AI knows our services better than some of our front desk staff.",
    rating: 5,
  },
  {
    name: "Michael Torres",
    role: "Director, Luxe Med Spa — Miami, FL",
    quote: "Our consultation bookings went up 34% in the first month. The AI captures every detail — name, phone, service interest, preferred time — and we get an email the second it happens.",
    rating: 5,
  },
  {
    name: "Jennifer Walsh",
    role: "Owner, Serenity Skin Studio — Austin, TX",
    quote: "I used to check our website forms at 6am and find 3-4 overnight inquiries. Now AivaSpa handles them in real time. Our response time went from 8 hours to under 3 seconds.",
    rating: 5,
  },
  {
    name: "Dr. Amir Patel",
    role: "Founder, DermaGlow Clinics — Chicago, IL",
    quote: "The knowledge base is brilliant. It answers exactly what we tell it to — no pricing games, no medical claims. Just clean, brand-approved responses that convert.",
    rating: 5,
  },
  {
    name: "Lisa Nakamura",
    role: "Manager, Radiance Med Spa — Seattle, WA",
    quote: "We have 3 locations and AivaSpa handles all of them. The dashboard shows every lead, every transcript, every conversion. It's the tool I wish existed when I started.",
    rating: 5,
  },
  {
    name: "Carlos Mendez",
    role: "Owner, VitaSkin Aesthetics — Denver, CO",
    quote: "The proactive greeting feature alone increased our chat engagement by 40%. Visitors who wouldn't have filled out a form now start a conversation and book a consultation.",
    rating: 5,
  },
] as const;

const metrics = [
  { before: "8 hrs", after: "< 3s", label: "Average first response time", improvement: "99.9% faster" },
  { before: "23%", after: "41%", label: "After-hours lead capture rate", improvement: "+78% increase" },
  { before: "$0", after: "$18K/mo", label: "Revenue from captured leads", improvement: "Average per spa" },
  { before: "12%", after: "34%", label: "Visitor-to-lead conversion", improvement: "+183% increase" },
] as const;

const categories = [
  { name: "Medical Spas", count: "45+", color: "#E2E54B" },
  { name: "Aesthetics Clinics", count: "25+", color: "#FF77E9" },
  { name: "Dermatology Practices", count: "15+", color: "#22D3EE" },
  { name: "Wellness Centers", count: "10+", color: "#34D399" },
] as const;

const logos = [
  "Glow Aesthetics", "Luxe Med Spa", "Serenity Skin", "DermaGlow", "Radiance Med",
  "VitaSkin", "Bella Clinic", "Clear Skin Co", "Aesthetic Arts", "SkinFirst",
  "MedSpa Pro", "Beauty Bar", "GlowUp", "SkinScience", "Ava Derm",
];

export default function CustomersPage() {
  return (
    <MarketingPageShell activePage="Customers">
      {/* Hero */}
      <section className="relative py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3.5 py-1.5 text-xs font-semibold text-[#E2E54B]">
                <span className="size-1.5 rounded-full bg-[#E2E54B]" />
                Customers
              </div>
            </Reveal>
            <Reveal>
              <h1 className="mt-7 text-5xl font-bold leading-[1.05] tracking-tight text-[#F7F8F8] md:text-6xl lg:text-7xl">
                Trusted by med spas that refuse to lose leads.
              </h1>
            </Reveal>
            <Reveal>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#8A8F98]">
                From single-location practices to multi-site groups, AivaSpa captures consultation requests around the clock.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Logo strip */}
      <section className="border-y border-[#23252A]/60 bg-[#0B0C0E] py-10">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#62666D]">
            Trusted by modern med spas
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-5">
            {logos.map((name) => (
              <div key={name} className="flex h-12 items-center justify-center rounded-xl border border-[#23252A] bg-[#121316] px-3 text-xs font-medium text-[#62666D]">
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-xs font-semibold text-[#E2E54B]">
                <Quote className="size-3.5" />
                Testimonials
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                What med spa owners say.
              </h2>
            </div>
          </Reveal>
          <RevealStagger className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map(({ name, role, quote, rating }) => (
              <RevealItem key={name}>
                <div className="flex h-full flex-col rounded-2xl border border-[#23252A] bg-[#121316] p-6">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: rating }).map((_, i) => (
                      <Star key={i} className="size-4 fill-[#E2E54B] text-[#E2E54B]" />
                    ))}
                  </div>
                  <p className="mt-4 flex-1 text-sm leading-7 text-[#C9CCD2]">&ldquo;{quote}&rdquo;</p>
                  <div className="mt-5 border-t border-[#23252A] pt-4">
                    <p className="text-sm font-semibold text-[#F7F8F8]">{name}</p>
                    <p className="text-xs text-[#62666D]">{role}</p>
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Before vs After */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-3 py-1 text-xs font-semibold text-[#22D3EE]">
                <TrendingUp className="size-3.5" />
                Results
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Before vs After AivaSpa.
              </h2>
            </div>
          </Reveal>
          <RevealStagger className="mt-12 grid gap-5 md:grid-cols-2">
            {metrics.map(({ before, after, label, improvement }) => (
              <RevealItem key={label}>
                <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#62666D]">{label}</p>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[#EB5757]">{before}</p>
                      <p className="text-[10px] uppercase tracking-wider text-[#62666D]">Before</p>
                    </div>
                    <ArrowRight className="size-5 text-[#E2E54B]" />
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[#34D399]">{after}</p>
                      <p className="text-[10px] uppercase tracking-wider text-[#62666D]">After</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-[#E2E54B]">{improvement}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Industry categories */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#FF77E9]/40 bg-[#FF77E9]/10 px-3 py-1 text-xs font-semibold text-[#FF77E9]">
                <Users className="size-3.5" />
                Industries
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Built for every aesthetics practice.
              </h2>
            </div>
          </Reveal>
          <RevealStagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map(({ name, count, color }) => (
              <RevealItem key={name}>
                <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-6 text-center">
                  <p className="text-3xl font-bold" style={{ color }}>{count}</p>
                  <p className="mt-2 text-sm font-semibold text-[#F7F8F8]">{name}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Video testimonial placeholders */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                See it in action.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
                Watch how real med spas use AivaSpa to capture leads and grow their business.
              </p>
            </div>
          </Reveal>
          <RevealStagger className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { title: "Glow Aesthetics", location: "Beverly Hills, CA", metric: "34% more bookings" },
              { title: "Luxe Med Spa", location: "Miami, FL", metric: "$18K/mo in captured leads" },
              { title: "Serenity Skin", location: "Austin, TX", metric: "3s avg response time" },
            ].map(({ title, location, metric }) => (
              <RevealItem key={title}>
                <div className="overflow-hidden rounded-2xl border border-[#23252A] bg-[#121316]">
                  <div className="flex h-48 items-center justify-center bg-[#0B0C0E]">
                    <div className="flex size-14 items-center justify-center rounded-full border border-[#23252A] bg-[#1A1B1E]">
                      <span className="ml-1 text-xl text-[#E2E54B]">&#9654;</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-[#F7F8F8]">{title}</h3>
                    <p className="text-xs text-[#62666D]">{location}</p>
                    <p className="mt-2 text-sm font-semibold text-[#E2E54B]">{metric}</p>
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
              Join 95+ med spas capturing leads 24/7.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
              Start with a free demo. No signup required. See how AivaSpa works on your own website.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="/demo" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-6 py-3.5 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90 sm:w-auto">
                Try live demo
                <ArrowRight className="size-4" />
              </a>
              <a href="/pricing" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#23252A] bg-[#121316] px-6 py-3.5 text-sm font-semibold text-[#F7F8F8] transition hover:bg-[#1A1B1E] sm:w-auto">
                View pricing
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingPageShell>
  );
}
