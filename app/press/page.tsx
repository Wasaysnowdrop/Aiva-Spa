import type { Metadata } from "next";
import { Award, Download, FileText, Mail } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { Reveal, RevealItem, RevealStagger } from "@/components/landing/motion-primitives";

export const metadata: Metadata = {
  title: "Press",
  description:
    "Press kit, brand assets, and latest announcements from AivaSpa — the 24/7 AI receptionist for med spas.",
  alternates: { canonical: "/press" },
  openGraph: {
    title: "Press | AivaSpa",
    description: "Press kit, brand assets, and latest announcements from AivaSpa.",
  },
};

const announcements = [
  {
    date: "June 2026",
    title: "AivaSpa launches Pro plan with multi-location support",
    body: "Enterprise med spa groups can now route leads across locations, use white-label branding, and access dedicated account management.",
    tag: "Product",
  },
  {
    date: "May 2026",
    title: "Google Calendar integration now available",
    body: "Med spas can connect Google Calendar to let the AI receptionist check availability and book consultations directly.",
    tag: "Integration",
  },
  {
    date: "April 2026",
    title: "AivaSpa reaches 95 med spa customers",
    body: "Over 95 med spas across the U.S. now use AivaSpa to capture leads 24/7, with a combined 12%+ visitor-to-lead conversion rate.",
    tag: "Milestone",
  },
  {
    date: "March 2026",
    title: "Public launch of AivaSpa",
    body: "After a successful pilot with 10 med spas, AivaSpa is now available to all med spas with Starter, Growth, and Pro plans.",
    tag: "Launch",
  },
] as const;

const assets = [
  { name: "AivaSpa Logo (SVG)", description: "Primary logo for web and print", format: "SVG" },
  { name: "AivaSpa Logo (PNG)", description: "High-resolution PNG at 2x", format: "PNG" },
  { name: "AivaSpa Wordmark", description: "Text-only wordmark", format: "SVG" },
  { name: "Brand Color Guide", description: "HEX, RGB, and Tailwind values", format: "PDF" },
  { name: "Press Release Template", description: "Official announcement template", format: "DOCX" },
  { name: "Product Screenshots", description: "Dashboard, widget, and analytics", format: "ZIP" },
] as const;

const awards = [
  { year: "2026", name: "Best AI SaaS for Healthcare", org: "SaaS Awards" },
  { year: "2026", name: "Top 50 Health Tech Startup", org: "Health Tech Magazine" },
  { year: "2026", name: "Innovation Award — AI Reception", org: "MedSpa Business Conference" },
];

export default function PressPage() {
  return (
    <MarketingPageShell activePage="Press">
      {/* Hero */}
      <section className="relative py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3.5 py-1.5 text-xs font-semibold text-[#E2E54B]">
                <span className="size-1.5 rounded-full bg-[#E2E54B]" />
                Press
              </div>
            </Reveal>
            <Reveal>
              <h1 className="mt-7 text-5xl font-bold leading-[1.05] tracking-tight text-[#F7F8F8] md:text-6xl lg:text-7xl">
                AivaSpa in the news.
              </h1>
            </Reveal>
            <Reveal>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#8A8F98]">
                Press kit, brand assets, and the latest announcements from AivaSpa.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Company overview */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#FF77E9]/40 bg-[#FF77E9]/10 px-3 py-1 text-xs font-semibold text-[#FF77E9]">
                  <span className="size-1.5 rounded-full bg-[#FF77E9]" />
                  Company
                </div>
                <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                  About AivaSpa.
                </h2>
                <p className="mt-5 text-base leading-8 text-[#8A8F98]">
                  AivaSpa is a 24/7 AI receptionist built exclusively for med spas. It answers treatment questions from an approved knowledge base, captures consultation leads, and notifies staff instantly — day or night.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  {[
                    ["Founded", "2025"],
                    ["Headquarters", "Remote-first, U.S."],
                    ["Customers", "95+ med spas"],
                    ["Plan", "From $49/mo"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-[#23252A] bg-[#121316] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#62666D]">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-[#F7F8F8]">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal>
              <div className="rounded-3xl border border-[#23252A] bg-[#121316] p-8">
                <h3 className="text-lg font-semibold text-[#F7F8F8]">Quick facts</h3>
                <ul className="mt-4 space-y-3 text-sm text-[#C9CCD2]">
                  {[
                    "AI receptionist for med spa websites",
                    "Captures name, phone, email, service interest, preferred time",
                    "Answers from approved knowledge base only",
                    "No medical claims, no invented pricing",
                    "Sub-50KB widget, loads lazily",
                    "Email and SMS notifications for new leads",
                    "Google Calendar integration for booking",
                    "HIPAA-aware safeguards",
                    "Plans: Starter ($49), Growth ($149), Pro (custom)",
                  ].map((fact) => (
                    <li key={fact} className="flex items-start gap-3">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#E2E54B]" />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Latest announcements */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-3 py-1 text-xs font-semibold text-[#22D3EE]">
                <FileText className="size-3.5" />
                Announcements
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Latest news.
              </h2>
            </div>
          </Reveal>
          <div className="mt-12 space-y-5">
            {announcements.map((item, i) => (
              <Reveal key={i}>
                <article className="rounded-2xl border border-[#23252A] bg-[#121316] p-6">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-[#23252A] bg-[#0B0C0E] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#62666D]">
                      {item.date}
                    </span>
                    <span className="rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#E2E54B]">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[#F7F8F8]">{item.title}</h3>
                  <p className="mt-2 text-sm text-[#8A8F98]">{item.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Brand assets */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-xs font-semibold text-[#E2E54B]">
                <Download className="size-3.5" />
                Brand assets
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Download our press kit.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
                Logos, color guides, product screenshots, and more.
              </p>
            </div>
          </Reveal>
          <RevealStagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map(({ name, description, format }) => (
              <RevealItem key={name}>
                <div className="flex items-center justify-between rounded-2xl border border-[#23252A] bg-[#121316] p-5">
                  <div>
                    <p className="text-sm font-semibold text-[#F7F8F8]">{name}</p>
                    <p className="text-xs text-[#62666D]">{description}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[#23252A] bg-[#0B0C0E] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8A8F98]">
                    {format}
                  </span>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
          <Reveal>
            <div className="mt-8 text-center">
              <a href="mailto:press@aivaspa.com" className="inline-flex items-center gap-2 rounded-xl border border-[#23252A] bg-[#121316] px-5 py-3 text-sm font-semibold text-[#F7F8F8] transition hover:border-[#E2E54B] hover:text-[#E2E54B]">
                <Download className="size-4" />
                Download full press kit
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Awards */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#FF77E9]/40 bg-[#FF77E9]/10 px-3 py-1 text-xs font-semibold text-[#FF77E9]">
                <Award className="size-3.5" />
                Awards
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Recognition.
              </h2>
            </div>
          </Reveal>
          <RevealStagger className="mt-12 grid gap-5 sm:grid-cols-3">
            {awards.map(({ year, name, org }) => (
              <RevealItem key={name}>
                <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-6 text-center">
                  <Award className="mx-auto size-8 text-[#E2E54B]" />
                  <p className="mt-4 text-lg font-semibold text-[#F7F8F8]">{name}</p>
                  <p className="mt-1 text-xs text-[#62666D]">{org} · {year}</p>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Media contact */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
              Media contact.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
              For press inquiries, interviews, or media kit requests, contact us at{" "}
              <a href="mailto:press@aivaspa.com" className="text-[#E2E54B] hover:underline">press@aivaspa.com</a>.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="mailto:press@aivaspa.com" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-6 py-3.5 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90 sm:w-auto">
                <Mail className="size-4" />
                Contact press team
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingPageShell>
  );
}
