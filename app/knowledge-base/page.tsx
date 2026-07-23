"use client";

import { ArrowRight, Search, BookOpen, CreditCard, MessageCircle, Settings, Users, Zap, Calendar, AlertCircle, HelpCircle } from "lucide-react";
import { useState } from "react";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { Reveal, RevealItem, RevealStagger } from "@/components/landing/motion-primitives";

const categories = [
  {
    icon: BookOpen,
    title: "Getting Started",
    color: "#E2E54B",
    articles: [
      "How to install the AivaSpa widget",
      "Setting up your knowledge base",
      "Configuring your brand (logo, colors, greeting)",
      "Going live: step-by-step checklist",
      "Understanding the dashboard",
    ],
  },
  {
    icon: Users,
    title: "Accounts",
    color: "#FF77E9",
    articles: [
      "Creating your account",
      "Inviting team members",
      "Understanding roles and permissions",
      "Two-factor authentication",
      "Deleting your account",
    ],
  },
  {
    icon: CreditCard,
    title: "Billing",
    color: "#22D3EE",
    articles: [
      "Plans and pricing overview",
      "How conversation quotas work",
      "Upgrading or downgrading your plan",
      "Trial period details",
      "Cancellation and refund policy",
    ],
  },
  {
    icon: CreditCard,
    title: "Subscriptions",
    color: "#34D399",
    articles: [
      "Managing your subscription",
      "Payment methods",
      "Invoice history",
      "Annual vs monthly billing",
      "Adding conversation packs",
    ],
  },
  {
    icon: MessageCircle,
    title: "AI Receptionist",
    color: "#E2E54B",
    articles: [
      "How the AI conversation engine works",
      "Retrieval-only architecture explained",
      "Why the AI never invents pricing",
      "Configuring the greeting message",
      "Proactive prompt timing",
    ],
  },
  {
    icon: Zap,
    title: "Leads",
    color: "#FF77E9",
    articles: [
      "How leads are captured",
      "Lead statuses and workflow",
      "Lead deduplication",
      "Merging duplicate leads",
      "Exporting leads",
    ],
  },
  {
    icon: BookOpen,
    title: "Inbox",
    color: "#22D3EE",
    articles: [
      "Using the leads inbox",
      "Filtering and searching leads",
      "Viewing chat transcripts",
      "One-click contact (call or email)",
      "Assigning leads to team members",
    ],
  },
  {
    icon: Settings,
    title: "Automation",
    color: "#34D399",
    articles: [
      "Email notifications setup",
      "SMS notifications setup",
      "Webhook configuration",
      "Google Calendar integration",
      "Slack and Teams notifications",
    ],
  },
  {
    icon: Calendar,
    title: "Appointments",
    color: "#E2E54B",
    articles: [
      "Connecting Google Calendar",
      "Setting booking duration and buffer",
      "Configuring working hours",
      "Managing booked events",
      "Disconnecting Google Calendar",
    ],
  },
  {
    icon: AlertCircle,
    title: "Troubleshooting",
    color: "#FF77E9",
    articles: [
      "Widget not showing on my site",
      "AI giving wrong answers",
      "Not receiving email notifications",
      "Calendar not syncing",
      "Widget performance issues",
    ],
  },
  {
    icon: HelpCircle,
    title: "FAQ",
    color: "#22D3EE",
    articles: [
      "General frequently asked questions",
      "Technical frequently asked questions",
      "Billing frequently asked questions",
      "Compliance and HIPAA questions",
    ],
  },
];

export default function KnowledgeBasePage() {
  const [search, setSearch] = useState("");
  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      articles: cat.articles.filter(
        (a) =>
          a.toLowerCase().includes(search.toLowerCase()) ||
          cat.title.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((cat) => cat.articles.length > 0);

  return (
    <MarketingPageShell activePage="Knowledge Base">
      {/* Hero */}
      <section className="relative py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3.5 py-1.5 text-xs font-semibold text-[#E2E54B]">
                <HelpCircle className="size-3.5" />
                Knowledge Base
              </div>
            </Reveal>
            <Reveal>
              <h1 className="mt-7 text-5xl font-bold leading-[1.05] tracking-tight text-[#F7F8F8] md:text-6xl lg:text-7xl">
                How can we help?
              </h1>
            </Reveal>
            <Reveal>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#8A8F98]">
                Search our help center or browse by category.
              </p>
            </Reveal>
            <Reveal>
              <div className="mx-auto mt-8 max-w-xl">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#62666D]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search articles..."
                    className="w-full rounded-xl border border-[#23252A] bg-[#121316] px-5 py-3.5 pl-10 text-sm text-[#F7F8F8] placeholder-[#62666D] outline-none transition focus:border-[#E2E54B]"
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <RevealStagger className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredCategories.map(({ icon: Icon, title, color, articles }) => (
              <RevealItem key={title}>
                <article className="flex h-full flex-col rounded-2xl border border-[#23252A] bg-[#121316] p-6 transition-colors hover:border-[#3A3D44]">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl border" style={{ borderColor: `${color}40`, backgroundColor: `${color}10`, color }}>
                      <Icon className="size-4" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#F7F8F8]">{title}</h3>
                  </div>
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
              Still need help?
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#8A8F98]">
              Our support team is available Monday–Friday, 9am–6pm ET.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="/contact" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-6 py-3.5 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90 sm:w-auto">
                Contact support
                <ArrowRight className="size-4" />
              </a>
              <a href="mailto:support@aivaspa.com" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#23252A] bg-[#121316] px-6 py-3.5 text-sm font-semibold text-[#F7F8F8] transition hover:bg-[#1A1B1E] sm:w-auto">
                Email us
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingPageShell>
  );
}
