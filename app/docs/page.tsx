import type { Metadata } from "next";
import { ArrowRight, BookOpen, Code, CreditCard, Globe, HelpCircle, Key, MessageCircle, Settings, Webhook } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { Reveal, RevealItem, RevealStagger } from "@/components/landing/motion-primitives";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Documentation for AivaSpa — the 24/7 AI receptionist for med spas. Guides, API reference, webhooks, and integration docs.",
  alternates: { canonical: "/docs" },
  openGraph: {
    title: "Docs | AivaSpa",
    description: "Documentation for AivaSpa — guides, API reference, and integrations.",
  },
};

const docCategories = [
  {
    icon: BookOpen,
    title: "Getting Started",
    description: "Install the widget, configure your brand, and go live in under an hour.",
    color: "#E2E54B",
    articles: ["Quick start guide", "Widget installation", "Brand configuration", "Going live checklist"],
  },
  {
    icon: Key,
    title: "Authentication",
    description: "API keys, scopes, and secure access for server-to-server integrations.",
    color: "#FF77E9",
    articles: ["API key management", "Authentication scopes", "Bearer token usage", "Key rotation"],
  },
  {
    icon: Code,
    title: "API Reference",
    description: "REST endpoints for leads, widgets, calendar, and dashboard data.",
    color: "#22D3EE",
    articles: ["POST /api/v1/leads", "GET /api/widget/config", "GET /api/google-calendar/slots", "POST /api/chat"],
  },
  {
    icon: Webhook,
    title: "Webhooks",
    description: "Receive real-time notifications for leads, conversations, and system events.",
    color: "#34D399",
    articles: ["Webhook events", "HMAC signature verification", "Delivery & retry logic", "Managing webhook URLs"],
  },
  {
    icon: CreditCard,
    title: "Billing",
    description: "Plans, quotas, trials, upgrades, and cancellation policies.",
    color: "#E2E54B",
    articles: ["Plan comparison", "Conversation quotas", "Trial period", "Upgrades & downgrades"],
  },
  {
    icon: Globe,
    title: "Integrations",
    description: "Connect Google Calendar, email providers, and third-party tools.",
    color: "#FF77E9",
    articles: ["Google Calendar setup", "OAuth flow", "Slot configuration", "Booking settings"],
  },
  {
    icon: Settings,
    title: "AI Setup",
    description: "Configure the knowledge base, guardrails, greeting, and proactive prompts.",
    color: "#22D3EE",
    articles: ["Knowledge base editor", "Service catalog", "FAQ management", "Guardrails & disclaimers"],
  },
  {
    icon: HelpCircle,
    title: "FAQ",
    description: "Common questions about setup, pricing, data handling, and support.",
    color: "#34D399",
    articles: ["General FAQ", "Technical FAQ", "Billing FAQ", "Compliance FAQ"],
  },
  {
    icon: MessageCircle,
    title: "Widget Customization",
    description: "Colors, position, greeting, proactive prompts, and multi-language support.",
    color: "#E2E54B",
    articles: ["Color & branding", "Position & sizing", "Proactive greeting", "Multi-language setup"],
  },
];

export default function DocsPage() {
  return (
    <MarketingPageShell activePage="Docs">
      {/* Hero */}
      <section className="relative py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3.5 py-1.5 text-xs font-semibold text-[#E2E54B]">
                <BookOpen className="size-3.5" />
                Documentation
              </div>
            </Reveal>
            <Reveal>
              <h1 className="mt-7 text-5xl font-bold leading-[1.05] tracking-tight text-[#F7F8F8] md:text-6xl lg:text-7xl">
                AivaSpa documentation.
              </h1>
            </Reveal>
            <Reveal>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#8A8F98]">
                Everything you need to install, configure, and get the most out of your AI receptionist.
              </p>
            </Reveal>
            <Reveal>
              <div className="mx-auto mt-8 max-w-xl">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search documentation..."
                    className="w-full rounded-xl border border-[#23252A] bg-[#121316] px-5 py-3.5 pl-10 text-sm text-[#F7F8F8] placeholder-[#62666D] outline-none transition focus:border-[#E2E54B]"
                  />
                  <svg className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#62666D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="border-t border-[#23252A]/60 py-12">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <RevealStagger className="flex flex-wrap justify-center gap-3">
            {["Quick Start", "API Reference", "Webhooks", "Google Calendar", "Widget Setup", "Billing"].map((link) => (
              <RevealItem key={link}>
                <a href="#" className="inline-flex items-center gap-2 rounded-full border border-[#23252A] bg-[#121316] px-4 py-2 text-sm font-medium text-[#8A8F98] transition hover:border-[#E2E54B] hover:text-[#E2E54B]">
                  {link}
                </a>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* Documentation cards */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <RevealStagger className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {docCategories.map(({ icon: Icon, title, description, color, articles }) => (
              <RevealItem key={title}>
                <article className="flex h-full flex-col rounded-2xl border border-[#23252A] bg-[#121316] p-6 transition-colors hover:border-[#3A3D44]">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl border" style={{ borderColor: `${color}40`, backgroundColor: `${color}10`, color }}>
                      <Icon className="size-4" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#F7F8F8]">{title}</h3>
                  </div>
                  <p className="mt-3 text-sm text-[#8A8F98]">{description}</p>
                  <ul className="mt-4 flex-1 space-y-2">
                    {articles.map((article) => (
                      <li key={article}>
                        <a href="#" className="flex items-center gap-2 text-sm text-[#C9CCD2] transition hover:text-[#E2E54B]">
                          <span className="size-1 shrink-0 rounded-full bg-[#62666D]" />
                          {article}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <a href="#" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#E2E54B] hover:text-[#E2E54B]/80">
                    View all
                    <ArrowRight className="size-3.5" />
                  </a>
                </article>
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
              Can&apos;t find what you need?
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
              Contact our support team at{" "}
              <a href="mailto:support@aivaspa.com" className="text-[#E2E54B] hover:underline">support@aivaspa.com</a>{" "}
              or visit the{" "}
              <a href="/knowledge-base" className="text-[#E2E54B] hover:underline">Knowledge Base</a>.
            </p>
          </Reveal>
        </div>
      </section>
    </MarketingPageShell>
  );
}
