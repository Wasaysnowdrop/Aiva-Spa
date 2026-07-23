import type { Metadata } from "next";
import { ArrowRight, Check, Plus, Zap } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { Reveal } from "@/components/landing/motion-primitives";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "See what's new in AivaSpa — product updates, features, fixes, and improvements.",
  alternates: { canonical: "/changelog" },
  openGraph: {
    title: "Changelog | AivaSpa",
    description: "Product updates, features, fixes, and improvements.",
  },
};

const versions = [
  {
    version: "v2.0",
    date: "June 2026",
    badge: "Latest",
    badgeColor: "#E2E54B",
    features: [
      "Multi-location support for Pro plan customers",
      "White-label widget with custom domain mapping",
      "Role-based access control (Owner, Manager, Staff, Receptionist)",
      "Audit log and HIPAA compliance reports",
      "Dedicated account manager for Pro customers",
    ],
    fixes: [
      "Fixed calendar slot overlap when two bookings happen simultaneously",
      "Fixed lead dedup edge case with international phone numbers",
    ],
    improvements: [
      "Dashboard loads 40% faster with optimized queries",
      "Widget initialization reduced to under 200ms",
      "Email notification delivery improved with retry logic",
    ],
  },
  {
    version: "v1.2",
    date: "May 2026",
    badge: null,
    badgeColor: "",
    features: [
      "Google Calendar integration — connect, check availability, and book consultations",
      "Email and SMS reminders for upcoming bookings",
      "Multi-language widget support (12 languages including RTL)",
      "Slack and Microsoft Teams notification channels",
    ],
    fixes: [
      "Fixed proactive greeting not triggering on mobile Safari",
      "Fixed knowledge base search partial-match issue",
      "Fixed webhook retry backoff timing",
    ],
    improvements: [
      "Conversation history now persisted across sessions",
      "Lead scoring algorithm improved for better prioritization",
      "Widget CSS isolation enhanced for complex site layouts",
    ],
  },
  {
    version: "v1.1",
    date: "April 2026",
    badge: null,
    badgeColor: "",
    features: [
      "Lead deduplication by phone and email",
      "Merge duplicate leads with transcript consolidation",
      "Custom widget colors and greeting messages",
      "Proactive prompt timing configuration",
    ],
    fixes: [
      "Fixed after-hours detection across time zones",
      "Fixed lead export CSV encoding for special characters",
      "Fixed dashboard real-time subscription reconnect",
    ],
    improvements: [
      "Knowledge base editor with live preview",
      "Service catalog now supports images",
      "Improved onboarding flow for new customers",
    ],
  },
  {
    version: "v1.0",
    date: "March 2026",
    badge: "Launch",
    badgeColor: "#34D399",
    features: [
      "AivaSpa public launch",
      "AI chat widget with retrieval-only conversation engine",
      "Lead capture (name, phone, email, service, preferred time)",
      "Email notifications for new leads",
      "Dashboard with leads inbox and conversation transcripts",
      "Knowledge base editor (services, FAQs, guardrails)",
      "Starter, Growth, and Pro plans",
      "Widget appearance customization (logo, colors, position)",
      "HIPAA-aware safeguards",
    ],
    fixes: [],
    improvements: [
      "Sub-50KB widget with lazy loading",
      "99.9% uptime SLA",
      "Done-for-you setup for early customers",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <MarketingPageShell activePage="Changelog">
      {/* Hero */}
      <section className="relative py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3.5 py-1.5 text-xs font-semibold text-[#E2E54B]">
                <Zap className="size-3.5" />
                Changelog
              </div>
            </Reveal>
            <Reveal>
              <h1 className="mt-7 text-5xl font-bold leading-[1.05] tracking-tight text-[#F7F8F8] md:text-6xl lg:text-7xl">
                What&apos;s new in AivaSpa.
              </h1>
            </Reveal>
            <Reveal>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#8A8F98]">
                Product updates, features, fixes, and improvements — all in one place.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <div className="space-y-12">
            {versions.map((v, vi) => (
              <Reveal key={v.version}>
                <article className="relative">
                  {/* Timeline line */}
                  {vi < versions.length - 1 && (
                    <div className="absolute left-5 top-12 bottom-0 w-px bg-[#23252A]" />
                  )}

                  <div className="flex gap-5">
                    {/* Timeline dot */}
                    <div className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-[#23252A] bg-[#121316]">
                      <span className="text-xs font-bold text-[#F7F8F8]">{v.version}</span>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-[#F7F8F8]">{v.version}</h2>
                        {v.badge && (
                          <span
                            className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
                            style={{
                              borderColor: `${v.badgeColor}40`,
                              backgroundColor: `${v.badgeColor}10`,
                              color: v.badgeColor,
                            }}
                          >
                            {v.badge}
                          </span>
                        )}
                        <span className="text-xs text-[#62666D]">{v.date}</span>
                      </div>

                      <div className="mt-6 space-y-6">
                        {v.features.length > 0 && (
                          <div>
                            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#E2E54B]">
                              <Plus className="size-3.5" />
                              Features
                            </h3>
                            <ul className="mt-3 space-y-2">
                              {v.features.map((f) => (
                                <li key={f} className="flex items-start gap-3 text-sm text-[#C9CCD2]">
                                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#E2E54B]" />
                                  {f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {v.fixes.length > 0 && (
                          <div>
                            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#34D399]">
                              <Check className="size-3.5" />
                              Fixes
                            </h3>
                            <ul className="mt-3 space-y-2">
                              {v.fixes.map((f) => (
                                <li key={f} className="flex items-start gap-3 text-sm text-[#C9CCD2]">
                                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#34D399]" />
                                  {f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {v.improvements.length > 0 && (
                          <div>
                            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#22D3EE]">
                              <Zap className="size-3.5" />
                              Improvements
                            </h3>
                            <ul className="mt-3 space-y-2">
                              {v.improvements.map((f) => (
                                <li key={f} className="flex items-start gap-3 text-sm text-[#C9CCD2]">
                                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#22D3EE]" />
                                  {f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
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
              Ready to try AivaSpa?
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
              Start with a free demo. No signup required.
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
