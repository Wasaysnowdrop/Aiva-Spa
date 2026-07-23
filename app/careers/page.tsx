import type { Metadata } from "next";
import { ArrowRight, Heart, Globe, Zap, Users, Briefcase, Code, Palette, TrendingUp, Headphones } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { Reveal, RevealItem, RevealStagger } from "@/components/landing/motion-primitives";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Join AivaSpa — help us build the 24/7 AI receptionist that every med spa needs. We're hiring across engineering, design, marketing, and customer success.",
  alternates: { canonical: "/careers" },
  openGraph: {
    title: "Careers | AivaSpa",
    description: "Join AivaSpa and help build the future of med spa reception.",
  },
};

const benefits = [
  { icon: Heart, title: "Health & wellness", body: "Full medical, dental, and vision. Mental health support. Wellness stipend." },
  { icon: Globe, title: "Remote-first", body: "Work from anywhere in the U.S. Flexible hours, async-first culture." },
  { icon: Zap, title: "Equity", body: "Every full-time employee gets stock options. You build it, you own a piece." },
  { icon: Users, title: "Growth budget", body: "$2,000/year for courses, conferences, and professional development." },
  { icon: Briefcase, title: "Unlimited PTO", body: "We trust you to take the time you need. Minimum 3 weeks encouraged." },
  { icon: Heart, title: "Parental leave", body: "12 weeks paid parental leave for all new parents." },
] as const;

const positions = [
  {
    department: "Engineering",
    icon: Code,
    color: "#E2E54B",
    roles: [
      { title: "Senior Full-Stack Engineer", type: "Full-time", location: "Remote (U.S.)" },
      { title: "AI/ML Engineer", type: "Full-time", location: "Remote (U.S.)" },
      { title: "Backend Engineer", type: "Full-time", location: "Remote (U.S.)" },
    ],
  },
  {
    department: "Design",
    icon: Palette,
    color: "#FF77E9",
    roles: [
      { title: "Product Designer", type: "Full-time", location: "Remote (U.S.)" },
      { title: "UX Researcher", type: "Full-time", location: "Remote (U.S.)" },
    ],
  },
  {
    department: "Marketing",
    icon: TrendingUp,
    color: "#22D3EE",
    roles: [
      { title: "Growth Marketing Manager", type: "Full-time", location: "Remote (U.S.)" },
      { title: "Content Strategist", type: "Full-time", location: "Remote (U.S.)" },
    ],
  },
  {
    department: "Sales",
    icon: Briefcase,
    color: "#34D399",
    roles: [
      { title: "Account Executive", type: "Full-time", location: "Remote (U.S.)" },
      { title: "Sales Development Rep", type: "Full-time", location: "Remote (U.S.)" },
    ],
  },
  {
    department: "Customer Success",
    icon: Headphones,
    color: "#E2E54B",
    roles: [
      { title: "Customer Success Manager", type: "Full-time", location: "Remote (U.S.)" },
      { title: "Onboarding Specialist", type: "Full-time", location: "Remote (U.S.)" },
    ],
  },
] as const;

const process = [
  { step: "01", title: "Apply", body: "Submit your application and resume. We review every one." },
  { step: "02", title: "Intro call", body: "30-minute call with our team to learn about you and share our vision." },
  { step: "03", title: "Skills assessment", body: "A take-home project or technical conversation, depending on the role." },
  { step: "04", title: "Final interview", body: "Meet the team leads and founders. Culture and values alignment." },
  { step: "05", title: "Offer", body: "We move fast. Expect an offer within 1 week of your final interview." },
] as const;

const values = [
  "We ship fast and iterate. Perfect is the enemy of live.",
  "We build for med spa owners, not for ourselves.",
  "We default to transparency — with our team and our customers.",
  "We believe AI should stay in its lane. No medical claims, no invented data.",
  "We care about outcomes, not hours logged.",
  "We treat every customer interaction as a chance to learn.",
];

export default function CareersPage() {
  return (
    <MarketingPageShell activePage="Careers">
      {/* Hero */}
      <section className="relative py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3.5 py-1.5 text-xs font-semibold text-[#E2E54B]">
                <span className="size-1.5 rounded-full bg-[#E2E54B]" />
                Careers
              </div>
            </Reveal>
            <Reveal>
              <h1 className="mt-7 text-5xl font-bold leading-[1.05] tracking-tight text-[#F7F8F8] md:text-6xl lg:text-7xl">
                Build the future of med spa reception.
              </h1>
            </Reveal>
            <Reveal>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#8A8F98]">
                We&apos;re a small, focused team solving a real problem for med spas across the U.S. If you want to build AI that stays in its lane and drives real revenue, we want to hear from you.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Mission & Culture */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#FF77E9]/40 bg-[#FF77E9]/10 px-3 py-1 text-xs font-semibold text-[#FF77E9]">
                  <span className="size-1.5 rounded-full bg-[#FF77E9]" />
                  Our mission
                </div>
                <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                  Eliminate missed leads for every med spa.
                </h2>
                <p className="mt-5 text-base leading-8 text-[#8A8F98]">
                  Every night, every weekend, every holiday — med spas lose consultation requests because no one is there to answer. We&apos;re fixing that with a purpose-built AI receptionist that never sleeps.
                </p>
              </div>
            </Reveal>
            <Reveal>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-3 py-1 text-xs font-semibold text-[#22D3EE]">
                  <span className="size-1.5 rounded-full bg-[#22D3EE]" />
                  Our culture
                </div>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#F7F8F8]">
                  Small team, big impact.
                </h2>
                <ul className="mt-5 space-y-3">
                  {values.map((v, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-[#C9CCD2]">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#22D3EE]" />
                      {v}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-xs font-semibold text-[#E2E54B]">
                <span className="size-1.5 rounded-full bg-[#E2E54B]" />
                Benefits
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                We take care of our team.
              </h2>
            </div>
          </Reveal>
          <RevealStagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map(({ icon: Icon, title, body }) => (
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

      {/* Hiring process */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <Reveal>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-3 py-1 text-xs font-semibold text-[#22D3EE]">
                <span className="size-1.5 rounded-full bg-[#22D3EE]" />
                Process
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                How we hire.
              </h2>
            </div>
          </Reveal>
          <div className="mt-10 space-y-6">
            {process.map(({ step, title, body }) => (
              <Reveal key={step}>
                <div className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 text-sm font-bold text-[#E2E54B]">
                    {step}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-[#F7F8F8]">{title}</h3>
                    <p className="mt-1 text-sm text-[#8A8F98]">{body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Open positions */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-xs font-semibold text-[#E2E54B]">
                <Briefcase className="size-3.5" />
                Open positions
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Find your role.
              </h2>
            </div>
          </Reveal>
          <div className="mt-12 space-y-8">
            {positions.map(({ department, icon: Icon, color, roles }) => (
              <Reveal key={department}>
                <div className="rounded-3xl border border-[#23252A] bg-[#121316] p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl border" style={{ borderColor: `${color}40`, backgroundColor: `${color}10`, color }}>
                      <Icon className="size-4" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#F7F8F8]">{department}</h3>
                  </div>
                  <div className="mt-5 space-y-3">
                    {roles.map(({ title, type, location }) => (
                      <div key={title} className="flex items-center justify-between rounded-xl border border-[#23252A] bg-[#0B0C0E] p-4">
                        <div>
                          <p className="text-sm font-semibold text-[#F7F8F8]">{title}</p>
                          <p className="text-xs text-[#62666D]">{type} · {location}</p>
                        </div>
                        <a href="/contact" className="inline-flex items-center gap-1.5 rounded-lg border border-[#23252A] px-4 py-2 text-xs font-semibold text-[#F7F8F8] transition hover:border-[#E2E54B] hover:text-[#E2E54B]">
                          Apply
                          <ArrowRight className="size-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <Reveal>
            <div className="text-center">
              <h2 className="text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Questions about working here.
              </h2>
            </div>
          </Reveal>
          <div className="mt-10 space-y-4">
            {[
              { q: "Is the team fully remote?", a: "Yes. We're remote-first across the U.S. Some roles may require overlap with specific time zones." },
              { q: "Do you sponsor visas?", a: "We're currently only hiring U.S.-based candidates. We don't sponsor work visas at this time." },
              { q: "What's the interview timeline?", a: "Typically 2-3 weeks from application to offer. We respect your time and keep the process efficient." },
              { q: "Can I work part-time?", a: "Some roles are available as part-time or contract. Check the specific listing for details." },
            ].map((faq, i) => (
              <Reveal key={i}>
                <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-5">
                  <p className="text-sm font-semibold text-[#F7F8F8]">{faq.q}</p>
                  <p className="mt-2 text-sm text-[#8A8F98]">{faq.a}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
              Don&apos;t see your role?
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
              Send us your resume at{" "}
              <a href="mailto:careers@aivaspa.com" className="text-[#E2E54B] hover:underline">careers@aivaspa.com</a>.
              We&apos;re always looking for exceptional people.
            </p>
          </Reveal>
        </div>
      </section>
    </MarketingPageShell>
  );
}
