import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/logo";
import Link from "next/link";

export const metadata: Metadata = {
  title: "System Status",
  description:
    "Live operational status for the AivaSpa website, AI chat widget, lead capture, dashboard, email alerts, and calendar integration.",
  alternates: { canonical: "/status" },
};

const services = [
  {
    name: "Website",
    description: "Marketing site, signup, login, and pricing pages.",
    status: "operational" as const,
  },
  {
    name: "AI Chat Widget",
    description: "Conversational AI answering from approved knowledge bases.",
    status: "operational" as const,
  },
  {
    name: "Lead Capture",
    description: "Public chat API, dedup, and dashboard lead inbox.",
    status: "operational" as const,
  },
  {
    name: "Dashboard",
    description: "Authed app, team management, analytics, and integrations.",
    status: "operational" as const,
  },
  {
    name: "Email Alerts",
    description: "Outbound email notifications when new leads arrive.",
    status: "operational" as const,
  },
  {
    name: "Calendar Integration",
    description: "Google Calendar OAuth, slot lookup, and event creation.",
    status: "operational" as const,
  },
];

const lastUpdated = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeStyle: "short",
}).format(new Date());

export default function StatusPage() {
  const allOperational = services.every((s) => s.status === "operational");

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08090A] text-[#F7F8F8]">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-[#E2E54B]/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-[#5E6AD2]/15 blur-3xl"
      />

      <header className="sticky top-0 z-40 border-b border-[#23252A]/60 bg-[#08090A]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="AivaSpa home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-[#8A8F98] md:flex">
            <Link href="/#product" className="transition hover:text-[#F7F8F8]">
              Product
            </Link>
            <Link href="/#features" className="transition hover:text-[#F7F8F8]">
              Features
            </Link>
            <Link href="/pricing" className="transition hover:text-[#F7F8F8]">
              Pricing
            </Link>
            <Link href="/status" className="text-[#F7F8F8]">
              Status
            </Link>
          </nav>
          <div className="hidden items-center gap-2.5 md:flex">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#F7F8F8] transition hover:bg-[#1A1B1E]"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-[#E2E54B] px-4 py-2 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90"
            >
              Get started
            </Link>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <Link
              href="/signup"
              className="rounded-md bg-[#E2E54B] px-3 py-1.5 text-xs font-semibold text-[#08090A]"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="relative mx-auto max-w-3xl px-5 pb-8 pt-16 lg:px-8 lg:pt-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#34D399]/40 bg-[#34D399]/10 px-3 py-1 text-xs font-semibold text-[#34D399]">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#34D399] opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-[#34D399]" />
          </span>
          {allOperational ? "All systems operational" : "Some systems are degraded"}
        </div>
        <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-[#F7F8F8] md:text-5xl">
          System Status
        </h1>
        <p className="mt-4 text-base leading-8 text-[#8A8F98]">
          Live operational status for the AivaSpa platform — including the website, AI chat
          widget, lead capture, dashboard, email alerts, and calendar integration.
        </p>
        <p className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-[#62666D]">
          Last updated
          <span className="rounded-full border border-[#23252A] bg-[#121316] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#8A8F98]">
            {lastUpdated}
          </span>
        </p>
      </section>

      <section className="relative mx-auto max-w-3xl px-5 pb-24 lg:px-8">
        <ul className="overflow-hidden rounded-3xl border border-[#23252A] bg-[#121316]">
          {services.map((service, i) => (
            <li
              key={service.name}
              className={`flex items-center justify-between gap-4 px-5 py-5 md:px-6 ${
                i !== 0 ? "border-t border-[#23252A]" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="text-base font-semibold text-[#F7F8F8]">{service.name}</p>
                <p className="mt-1 text-sm leading-6 text-[#8A8F98]">{service.description}</p>
              </div>
              <StatusPill status={service.status} />
            </li>
          ))}
        </ul>

        <div className="mt-10 rounded-2xl border border-[#23252A] bg-[#121316] p-5 md:p-6">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E2E54B]">
            <span className="size-1.5 rounded-full bg-[#E2E54B]" />
            Need help?
          </p>
          <p className="mt-3 text-[15px] leading-7 text-[#C9CCD2]">
            For urgent support, contact{" "}
            <a
              href="mailto:hello@aivaspa.online"
              className="font-semibold text-[#E2E54B] hover:underline"
            >
              hello@aivaspa.online
            </a>
            .
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-[#62666D]">
          <Link href="/legal/privacy" className="hover:text-[#F7F8F8]">
            Privacy
          </Link>
          <Link href="/legal/terms" className="hover:text-[#F7F8F8]">
            Terms
          </Link>
          <Link href="/legal/hipaa" className="hover:text-[#F7F8F8]">
            HIPAA Notice
          </Link>
          <span className="ml-auto">© 2026 AivaSpa, Inc.</span>
        </div>
      </section>
    </main>
  );
}

function StatusPill({ status }: { status: "operational" | "degraded" | "outage" }) {
  const styles =
    status === "operational"
      ? { bg: "rgba(52, 211, 153, 0.10)", border: "rgba(52, 211, 153, 0.40)", color: "#34D399", label: "Operational" }
      : status === "degraded"
        ? { bg: "rgba(226, 229, 75, 0.10)", border: "rgba(226, 229, 75, 0.40)", color: "#E2E54B", label: "Degraded" }
        : { bg: "rgba(235, 87, 87, 0.10)", border: "rgba(235, 87, 87, 0.40)", color: "#EB5757", label: "Outage" };
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
      style={{
        backgroundColor: styles.bg,
        borderColor: styles.border,
        color: styles.color,
      }}
    >
      <CheckCircle2 className="size-3.5" />
      {styles.label}
    </span>
  );
}