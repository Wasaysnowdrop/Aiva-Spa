import { ArrowRight, Bot, CalendarCheck, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";

const exploreLinks = [
    ["Homepage", "/"],
    ["How It Works?", "/#how-it-works"],
    ["Features", "/#features"],
    ["Frequently Asked Questions", "/#faq"],
    ["Contact", "/#contact"],
] as const;

const legalLinks = [
    ["Privacy Policy", "/legal/privacy"],
    ["Terms of Service", "/legal/terms"],
    ["HIPAA Notice", "/legal/hipaa"],
    ["System Status", "/status"],
] as const;

const stats = [
    ["24/7", "AI lead capture"],
    ["15+", "Med spa services"],
    ["Instant", "Staff alerts"],
    ["No-code", "Website widget"],
] as const;

const workflowCards = [
    [MessageCircle, "Visitor chat", "rotate-[-14deg] left-[4%] top-10 bg-white"],
    [Bot, "FAQ answer", "rotate-[10deg] left-[18%] top-20 bg-[#F5F5F5]"],
    [CalendarCheck, "Consult lead", "rotate-[-7deg] right-[18%] top-16 bg-white"],
    [ShieldCheck, "Safe guardrails", "rotate-[13deg] right-[4%] top-9 bg-[#F5F5F5]"],
] as const;

export function Footer() {
    return (
        <footer className="relative overflow-hidden bg-black text-white">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-0 top-10 h-72 w-72 rounded-full bg-[#0D5F91]/20 blur-3xl" />
                <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#8DB5D6]/15 blur-3xl" />
            </div>

            <div className="relative mx-auto max-w-[1200px] px-5 py-9 lg:px-8">
                <section className="relative flex min-h-[315px] w-full items-center justify-center overflow-hidden rounded-[24px] bg-gradient-to-r from-[#0D5F91] via-[#2F7EAB] to-[#8DB5D6] px-5 py-12 text-center shadow-2xl shadow-[#0D5F91]/25 backdrop-blur-lg">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,.22),transparent_45%)]" />
                    <div className="absolute -left-6 bottom-2 hidden h-[140px] w-[90px] rotate-[-25deg] rounded-[18px] bg-gradient-to-b from-black to-[#0D5F91] p-4 text-left shadow-2xl md:block">
                        <p className="[writing-mode:vertical-rl] text-xs font-bold uppercase tracking-[0.35em] text-white">Botox FAQ</p>
                    </div>
                    <div className="absolute left-16 top-8 hidden h-[140px] w-[90px] rotate-[-35deg] rounded-[18px] bg-gradient-to-b from-[#8DB5D6] to-white p-4 text-left shadow-2xl md:block">
                        <p className="[writing-mode:vertical-rl] text-xs font-bold uppercase tracking-[0.3em] text-black">Leads</p>
                    </div>

                    {workflowCards.map(([Icon, label, className]) => (
                        <div key={label} className={`absolute hidden h-[160px] w-[120px] overflow-hidden rounded-[20px] p-4 text-left opacity-90 shadow-[0_20px_40px_rgba(0,0,0,.25)] lg:block ${className}`}>
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-[#0D5F91] text-white">
                                <Icon className="size-5" />
                            </div>
                            <p className="mt-8 text-lg font-bold leading-tight text-black">{label}</p>
                            <div className="mt-4 h-2 w-14 rounded-full bg-[#8DB5D6]" />
                            <div className="mt-2 h-2 w-20 rounded-full bg-[#F5F5F5]" />
                        </div>
                    ))}

                    <div className="relative z-10 mx-auto max-w-3xl">
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur">
                            <Sparkles className="size-4" />
                            Built for med spa conversion
                        </div>
                        <h2 className="text-4xl font-bold leading-[1.1] text-white md:text-[54px]">Ready to Capture More Med Spa Leads?</h2>
                        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/90">Answer treatment questions, collect consultation requests, and notify staff instantly with your 24/7 AI receptionist.</p>
                        <div className="mt-7 flex flex-col justify-center gap-4 sm:flex-row">
                            <Link href="/#contact" className="inline-flex h-[42px] items-center justify-center rounded-lg bg-white px-5 text-sm font-bold text-black transition hover:-translate-y-0.5 hover:bg-[#F5F5F5]">
                                Book Demo <ArrowRight className="ml-2 size-4" />
                            </Link>
                            <a href="/login" className="inline-flex h-[42px] items-center justify-center rounded-lg border border-white/40 px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10">
                                Login
                            </a>
                            <a href="/signup" className="inline-flex h-[42px] items-center justify-center rounded-lg bg-white px-5 text-sm font-bold text-black transition hover:-translate-y-0.5 hover:bg-[#F5F5F5]">
                                Sign Up
                            </a>
                        </div>
                        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-[72px]">
                            {stats.map(([number, label]) => (
                                <div key={label}>
                                    <p className="text-4xl font-bold text-white md:text-[46px]">{number}</p>
                                    <p className="mt-2 text-sm text-white/85">{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <div className="grid gap-10 pt-[70px] lg:grid-cols-[1.15fr_0.7fr_0.8fr_1fr]">
                    <div>
                        <Link href="/" className="flex items-center gap-3" aria-label="AivaSpa home">
                            <Logo className="size-12" />
                        </Link>
                        <p className="mt-5 max-w-[260px] text-sm leading-[1.8] text-white/65">Utilize AI reception support to capture med spa leads, answer approved FAQs, and organize follow-up workflows around the clock.</p>
                        <div className="mt-6 flex items-center gap-[18px] text-white">
                            <a href="#facebook" aria-label="Facebook" className="text-sm font-bold transition hover:-translate-y-1 hover:text-[#8DB5D6]">f</a>
                            <a href="#instagram" aria-label="Instagram" className="text-sm font-bold transition hover:-translate-y-1 hover:text-[#8DB5D6]">◎</a>
                            <a href="#x" aria-label="X" className="text-lg font-bold leading-none transition hover:-translate-y-1 hover:text-[#8DB5D6]">𝕏</a>
                            <a href="#linkedin" aria-label="LinkedIn" className="text-sm font-bold transition hover:-translate-y-1 hover:text-[#8DB5D6]">in</a>
                            <a href="#youtube" aria-label="YouTube" className="text-sm font-bold transition hover:-translate-y-1 hover:text-[#8DB5D6]">▶</a>
                        </div>
                    </div>

                    <FooterColumn title="Explore" links={exploreLinks} />
                    <FooterColumn title="Legal" links={legalLinks} />

                    <div>
                        <h3 className="text-lg font-semibold text-white">Contact</h3>
                        <ul className="mt-5 space-y-4 text-sm leading-7 text-white/65">
                            <li className="flex gap-3">
                                <Mail className="mt-1 size-4 shrink-0 text-[#8DB5D6]" />
                                <a href="mailto:hello@aivaspa.com" className="transition hover:text-white">hello@aivaspa.com</a>
                            </li>
                            <li className="flex gap-3">
                                <Phone className="mt-1 size-4 shrink-0 text-[#8DB5D6]" />
                                <a href="tel:+15550148231" className="transition hover:text-white">(555) 014-8231</a>
                            </li>
                            <li className="flex gap-3">
                                <MapPin className="mt-1 size-4 shrink-0 text-[#8DB5D6]" />
                                <span>Remote-first SaaS for med spas across the U.S.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/[0.08] pt-5 text-sm text-white/60 md:flex-row md:items-center">
                    <p>© 2026 AivaSpa. All rights reserved.</p>
                    <p>AI Receptionist supports lead capture only and does not provide medical advice.</p>
                </div>
            </div>
        </footer>
    );
}

function FooterColumn({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
    return (
        <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <ul className="mt-5 space-y-2 text-sm leading-[2.2] text-white/65">
                {links.map(([label, href]) => (
                    <li key={label}>
                        <a href={href} className="inline-block transition duration-300 hover:translate-x-1 hover:text-white">{label}</a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
