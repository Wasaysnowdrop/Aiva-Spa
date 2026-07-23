import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

const navLinks = [
  { label: "Product", href: "/#product" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Status", href: "/status" },
] as const;

export type LegalPageShellProps = {
  eyebrow: string;
  title: string;
  description?: string;
  updated: string;
  children: ReactNode;
};

export function LegalPageShell({
  eyebrow,
  title,
  description,
  updated,
  children,
}: LegalPageShellProps) {
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
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="transition hover:text-[#F7F8F8]"
              >
                {link.label}
              </Link>
            ))}
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E2E54B] px-4 py-2 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90"
            >
              Get started
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <Link
              href="/signup"
              className="inline-flex items-center gap-1 rounded-md bg-[#E2E54B] px-3 py-1.5 text-xs font-semibold text-[#08090A]"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="relative mx-auto max-w-3xl px-5 pb-10 pt-16 lg:px-8 lg:pb-14 lg:pt-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-xs font-semibold text-[#E2E54B]">
          <span className="size-1.5 rounded-full bg-[#E2E54B]" />
          {eyebrow}
        </div>
        <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-[#F7F8F8] md:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 text-base leading-8 text-[#8A8F98]">{description}</p>
        ) : null}
        <p className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-[#62666D]">
          Last updated
          <span className="rounded-full border border-[#23252A] bg-[#121316] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#8A8F98]">
            {updated}
          </span>
        </p>
      </section>

      <article className="relative mx-auto max-w-3xl px-5 pb-24 lg:px-8">
        <div className="space-y-10 text-[15px] leading-8 text-[#C9CCD2]">{children}</div>
      </article>

      <LegalFooter />
    </main>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-2xl font-bold tracking-tight text-[#F7F8F8] md:text-3xl">
      {children}
    </h2>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-lg font-semibold text-[#F7F8F8]">{children}</h3>
  );
}

export function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#E2E54B]" />
          <span className="text-[15px] leading-7 text-[#C9CCD2]">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Callout({
  tone = "warning",
  title,
  children,
}: {
  tone?: "warning" | "info";
  title: string;
  children: ReactNode;
}) {
  const accent = tone === "warning" ? "#EB5757" : "#22D3EE";
  return (
    <aside
      className="rounded-2xl border bg-[#121316] p-5 md:p-6"
      style={{ borderColor: `${accent}40`, backgroundColor: `${accent}08` }}
    >
      <p
        className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: accent }}
      >
        <span className="size-1.5 rounded-full" style={{ backgroundColor: accent }} />
        {title}
      </p>
      <div className="mt-3 text-[15px] leading-7 text-[#C9CCD2]">{children}</div>
    </aside>
  );
}

function LegalFooter() {
  const columns = [
    {
      title: "Product",
      links: [
        { label: "Chat widget", href: "/#features" },
        { label: "AI engine", href: "/#product" },
        { label: "Lead dashboard", href: "/#features" },
        { label: "Pricing", href: "/pricing" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
        { label: "HIPAA Notice", href: "/hipaa" },
        { label: "System Status", href: "/status" },
      ],
    },
    {
      title: "Contact",
      links: [
        { label: "hello@aivaspa.online", href: "mailto:hello@aivaspa.online" },
        { label: "Sales", href: "mailto:sales@aivaspa.online" },
      ],
    },
  ];

  return (
    <footer className="relative border-t border-[#23252A]/60 bg-[#08090A] py-14">
      <div className="mx-auto max-w-5xl px-5 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-3">
          <div>
            <Link href="/" className="flex items-center gap-2.5" aria-label="AivaSpa home">
              <Logo />
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-7 text-[#8A8F98]">
              The 24/7 AI receptionist built for med spas. Capture every consultation lead,
              answer every treatment question, and notify your team in real time.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-[#F7F8F8]">{col.title}</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-[#8A8F98]">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="inline-block transition hover:translate-x-0.5 hover:text-[#F7F8F8]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[#23252A]/60 pt-6 text-xs text-[#62666D] md:flex-row md:items-center">
          <p>© 2026 AivaSpa, Inc. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy" className="hover:text-[#F7F8F8]">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[#F7F8F8]">
              Terms
            </Link>
            <Link href="/hipaa" className="hover:text-[#F7F8F8]">
              HIPAA Notice
            </Link>
            <Link href="/status" className="hover:text-[#F7F8F8]">
              Status
            </Link>
          </div>
        </div>
        <p className="mt-4 text-xs leading-6 text-[#62666D]">
          AivaSpa supports lead capture only. It does not provide medical advice, diagnoses,
          or guaranteed outcomes. A licensed provider confirms treatment suitability and pricing.
        </p>
      </div>
    </footer>
  );
}