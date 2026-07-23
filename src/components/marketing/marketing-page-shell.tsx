import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { MobileMenu } from "@/components/landing/mobile-menu";

const navLinks = [
  { label: "Product", href: "/#product" },
  { label: "Features", href: "/#features" },
  { label: "Live demo", href: "/demo" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/#faq" },
] as const;

const aboutLinks = [
  ["About", "/about"],
  ["Customers", "/customers"],
  ["Pricing", "/pricing"],
  ["Contact", "/contact"],
  ["Careers", "/careers"],
  ["Press", "/press"],
] as const;

const docsLinks = [
  ["Knowledge Base", "/knowledge-base"],
  ["Changelog", "/changelog"],
  ["HIPAA Notice", "/legal/hipaa"],
  ["Privacy Policy", "/legal/privacy"],
  ["Terms of Service", "/legal/terms"],
] as const;

const socials = [
  { label: "f", color: "#E2E54B" },
  { label: "in", color: "#22D3EE" },
  { label: "X", color: "#F7F8F8" },
  { label: "O", color: "#FF77E9" },
  { label: "P", color: "#EB5757" },
] as const;

export type MarketingPageShellProps = {
  children: ReactNode;
  activePage?: string;
};

export function MarketingPageShell({ children, activePage }: MarketingPageShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08090A] text-[#F7F8F8]">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-[#23252A]/60 bg-[#08090A]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="AivaSpa home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-[#8A8F98] md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`transition hover:text-[#F7F8F8] ${
                  activePage === link.label ? "text-[#F7F8F8]" : ""
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-2.5 md:flex">
            <Link href="/demo" className="rounded-lg border border-[#3A3D2A] px-3 py-2 text-sm font-semibold text-[#E2E54B] hover:bg-[#1A1B1E]">
              Try live demo
            </Link>
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-[#F7F8F8] transition hover:bg-[#1A1B1E]">
              Login
            </Link>
            <Link href="/signup" className="inline-flex items-center gap-1.5 rounded-lg bg-[#E2E54B] px-4 py-2 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90">
              Get started
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <MobileMenu
            links={navLinks}
            brand={<Logo className="size-8" />}
            rightSlot={
              <Link href="/signup" className="inline-flex items-center gap-1 rounded-md bg-[#E2E54B] px-3 py-1.5 text-xs font-semibold text-[#08090A]">
                Get started
              </Link>
            }
          />
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer className="relative border-t border-[#23252A]/60 bg-[#08090A] py-16">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
            <div>
              <Link href="/" className="flex items-center gap-2.5" aria-label="AivaSpa home">
                <Logo />
              </Link>
              <p className="mt-5 max-w-sm text-sm leading-7 text-[#8A8F98]">
                The 24/7 AI receptionist for med spas. Capture every consultation lead, answer every treatment question, and notify your team the moment a lead comes in.
              </p>
              <div className="mt-6 flex items-center gap-3">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href="#"
                    className="flex size-9 items-center justify-center rounded-lg border border-[#23252A] bg-[#121316] text-sm font-semibold text-[#8A8F98] transition hover:border-[#E2E54B] hover:text-[#F7F8F8]"
                  >
                    <span style={{ color: s.color }}>{s.label}</span>
                  </a>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[#F7F8F8]">
                  <span className="size-1.5 rounded-full bg-[#FF77E9]" />
                  About
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm text-[#8A8F98]">
                  {aboutLinks.map(([label, href]) => (
                    <li key={label}>
                      <Link href={href} className="inline-block transition hover:translate-x-1 hover:text-[#F7F8F8]">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[#F7F8F8]">
                  <span className="size-1.5 rounded-full bg-[#22D3EE]" />
                  Resources
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm text-[#8A8F98]">
                  {docsLinks.map(([label, href]) => (
                    <li key={label}>
                      <Link href={href} className="inline-block transition hover:translate-x-1 hover:text-[#F7F8F8]">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[#F7F8F8]">
                  <span className="size-1.5 rounded-full bg-[#E2E54B]" />
                  Product
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm text-[#8A8F98]">
                  {["Chat widget", "AI engine", "Lead dashboard", "Notifications", "Analytics", "Integrations"].map((link) => (
                    <li key={link}>
                      <Link href="/#features" className="inline-block transition hover:translate-x-1 hover:text-[#F7F8F8]">
                        {link}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[#F7F8F8]">
                  <span className="size-1.5 rounded-full bg-[#E2E54B]" />
                  Contact
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm text-[#8A8F98]">
                  <li>
                    <a href="mailto:hello@aivaspa.com" className="inline-block transition hover:translate-x-1 hover:text-[#F7F8F8]">
                      hello@aivaspa.com
                    </a>
                  </li>
                  <li>
                    <a href="tel:+15550148231" className="inline-block transition hover:translate-x-1 hover:text-[#F7F8F8]">
                      (555) 014-8231
                    </a>
                  </li>
                  <li>
                    <span className="text-[#8A8F98]">Remote-first SaaS</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-[#23252A]/60 pt-6 text-xs text-[#62666D] md:flex-row md:items-center">
            <p>&copy; 2026 AivaSpa, Inc. All rights reserved.</p>
            <div className="flex items-center gap-5">
              <Link href="/legal/privacy" className="hover:text-[#F7F8F8]">Privacy</Link>
              <Link href="/legal/terms" className="hover:text-[#F7F8F8]">Terms</Link>
              <Link href="/legal/hipaa" className="hover:text-[#F7F8F8]">HIPAA Notice</Link>
              <Link href="/status" className="hover:text-[#F7F8F8]">Status</Link>
            </div>
          </div>
          <p className="mt-4 text-xs text-[#62666D]">
            AivaSpa supports lead capture only. It does not provide medical advice, diagnoses, or guaranteed outcomes. A licensed provider confirms treatment suitability and pricing.
          </p>
        </div>
      </footer>
    </main>
  );
}
