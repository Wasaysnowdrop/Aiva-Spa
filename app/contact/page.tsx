"use client";

import { ArrowRight, Clock, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { useState } from "react";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { Reveal } from "@/components/landing/motion-primitives";

const faqs = [
  { q: "How quickly do you respond?", a: "We aim to respond to all inquiries within 2 business hours during operating hours." },
  { q: "Do you offer phone support?", a: "Phone support is available for Growth and Pro plan customers. Starter plan customers can reach us by email." },
  { q: "Can I schedule a demo?", a: "Absolutely. Book a live demo at /demo or email sales@aivaspa.com to schedule a personalized walkthrough." },
  { q: "Where are you located?", a: "We're a remote-first team based across the U.S. Our support covers all U.S. time zones." },
];

export default function ContactPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <MarketingPageShell activePage="Contact">
      {/* Hero */}
      <section className="relative py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3.5 py-1.5 text-xs font-semibold text-[#E2E54B]">
                <span className="size-1.5 rounded-full bg-[#E2E54B]" />
                Contact
              </div>
            </Reveal>
            <Reveal>
              <h1 className="mt-7 text-5xl font-bold leading-[1.05] tracking-tight text-[#F7F8F8] md:text-6xl lg:text-7xl">
                Get in touch.
              </h1>
            </Reveal>
            <Reveal>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#8A8F98]">
                Have a question about AivaSpa? Want a personalized demo? We&apos;re here to help.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Contact Form + Info */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
            {/* Form */}
            <Reveal>
              <div className="rounded-3xl border border-[#23252A] bg-[#121316] p-8">
                <h2 className="text-2xl font-bold text-[#F7F8F8]">Send us a message</h2>
                <p className="mt-2 text-sm text-[#8A8F98]">We&apos;ll get back to you within 2 business hours.</p>
                <form className="mt-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#62666D]">Name</label>
                      <input type="text" placeholder="Your name" className="w-full rounded-xl border border-[#23252A] bg-[#0B0C0E] px-4 py-3 text-sm text-[#F7F8F8] placeholder-[#62666D] outline-none transition focus:border-[#E2E54B]" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#62666D]">Email</label>
                      <input type="email" placeholder="you@company.com" className="w-full rounded-xl border border-[#23252A] bg-[#0B0C0E] px-4 py-3 text-sm text-[#F7F8F8] placeholder-[#62666D] outline-none transition focus:border-[#E2E54B]" />
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#62666D]">Business</label>
                      <input type="text" placeholder="Your med spa name" className="w-full rounded-xl border border-[#23252A] bg-[#0B0C0E] px-4 py-3 text-sm text-[#F7F8F8] placeholder-[#62666D] outline-none transition focus:border-[#E2E54B]" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#62666D]">Phone</label>
                      <input type="tel" placeholder="(555) 000-0000" className="w-full rounded-xl border border-[#23252A] bg-[#0B0C0E] px-4 py-3 text-sm text-[#F7F8F8] placeholder-[#62666D] outline-none transition focus:border-[#E2E54B]" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#62666D]">Reason</label>
                    <select className="w-full rounded-xl border border-[#23252A] bg-[#0B0C0E] px-4 py-3 text-sm text-[#F7F8F8] outline-none transition focus:border-[#E2E54B]">
                      <option value="">Select a reason</option>
                      <option value="demo">Request a demo</option>
                      <option value="sales">Sales inquiry</option>
                      <option value="support">Technical support</option>
                      <option value="partnership">Partnership</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#62666D]">Message</label>
                    <textarea rows={4} placeholder="How can we help?" className="w-full rounded-xl border border-[#23252A] bg-[#0B0C0E] px-4 py-3 text-sm text-[#F7F8F8] placeholder-[#62666D] outline-none transition focus:border-[#E2E54B] resize-none" />
                  </div>
                  <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-6 py-3.5 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90">
                    Send message
                    <Send className="size-4" />
                  </button>
                </form>
              </div>
            </Reveal>

            {/* Info sidebar */}
            <div className="space-y-6">
              <Reveal>
                <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl border border-[#E2E54B]/40 bg-[#E2E54B]/10 text-[#E2E54B]">
                      <Mail className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#62666D]">Support</p>
                      <a href="mailto:support@aivaspa.com" className="text-sm font-semibold text-[#F7F8F8] hover:text-[#E2E54B]">support@aivaspa.com</a>
                    </div>
                  </div>
                </div>
              </Reveal>
              <Reveal>
                <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl border border-[#FF77E9]/40 bg-[#FF77E9]/10 text-[#FF77E9]">
                      <Mail className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#62666D]">Sales</p>
                      <a href="mailto:sales@aivaspa.com" className="text-sm font-semibold text-[#F7F8F8] hover:text-[#E2E54B]">sales@aivaspa.com</a>
                    </div>
                  </div>
                </div>
              </Reveal>
              <Reveal>
                <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl border border-[#22D3EE]/40 bg-[#22D3EE]/10 text-[#22D3EE]">
                      <Phone className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#62666D]">Phone</p>
                      <a href="tel:+15550148231" className="text-sm font-semibold text-[#F7F8F8] hover:text-[#E2E54B]">(555) 014-8231</a>
                    </div>
                  </div>
                </div>
              </Reveal>
              <Reveal>
                <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl border border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]">
                      <Clock className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#62666D]">Business hours</p>
                      <p className="text-sm font-semibold text-[#F7F8F8]">Mon–Fri, 9am–6pm ET</p>
                    </div>
                  </div>
                </div>
              </Reveal>
              <Reveal>
                <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl border border-[#E2E54B]/40 bg-[#E2E54B]/10 text-[#E2E54B]">
                      <MapPin className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#62666D]">Location</p>
                      <p className="text-sm font-semibold text-[#F7F8F8]">Remote-first · U.S. based</p>
                    </div>
                  </div>
                </div>
              </Reveal>
              <Reveal>
                <div className="rounded-2xl border border-[#23252A] bg-[#121316] p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#62666D]">Response time</p>
                  <p className="mt-1 text-2xl font-bold text-[#E2E54B]">&lt; 2 hours</p>
                  <p className="text-xs text-[#8A8F98]">Average during business hours</p>
                </div>
              </Reveal>
              <Reveal>
                <div className="flex items-center gap-3">
                  {["f", "in", "X", "O", "P"].map((s) => (
                    <a key={s} href="#" className="flex size-9 items-center justify-center rounded-lg border border-[#23252A] bg-[#121316] text-sm font-semibold text-[#8A8F98] transition hover:border-[#E2E54B] hover:text-[#F7F8F8]">
                      {s}
                    </a>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <Reveal>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-xs font-semibold text-[#E2E54B]">
                <MessageCircle className="size-3.5" />
                FAQ
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
                Common questions.
              </h2>
            </div>
          </Reveal>
          <div className="mt-10 space-y-3">
            {faqs.map((faq, i) => (
              <Reveal key={i}>
                <div className="rounded-2xl border border-[#23252A] bg-[#121316]">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left"
                  >
                    <span className="text-sm font-semibold text-[#F7F8F8]">{faq.q}</span>
                    <span className={`shrink-0 text-[#62666D] transition-transform ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-5 text-sm leading-7 text-[#8A8F98]">
                      {faq.a}
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Map placeholder */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal>
            <div className="rounded-3xl border border-[#23252A] bg-[#121316] p-12 text-center">
              <MapPin className="mx-auto size-10 text-[#62666D]" />
              <p className="mt-4 text-lg font-semibold text-[#F7F8F8]">Remote-first, serving med spas across the U.S.</p>
              <p className="mt-2 text-sm text-[#8A8F98]">Our team operates from multiple locations to provide coverage across all U.S. time zones.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#23252A]/60 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl">
              Ready to see AivaSpa in action?
            </h2>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="/demo" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-6 py-3.5 text-sm font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90 sm:w-auto">
                Try live demo
                <ArrowRight className="size-4" />
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingPageShell>
  );
}
