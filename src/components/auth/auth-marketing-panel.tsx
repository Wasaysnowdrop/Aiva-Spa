"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Bell, CalendarCheck, MessageCircle, Quote, Sparkles, Star } from "lucide-react";

import { AnimatedDashboardPreview } from "@/components/landing/animated-dashboard";

const notification = {
  icon: Bell,
  channel: "Email alerts",
  recipient: "Owner · Glow Medspa",
  body: "New lead: Sarah K. — Botox consult, Sat 2–4pm",
  time: "just now",
  color: "#E2E54B",
};

const floatingStat = {
  label: "Leads this week",
  value: "23",
  delta: "+38%",
  color: "#34D399",
};

const testimonials = {
  login: {
    quote:
      "I used to wake up to five missed DMs. Now I wake up to booked consultations. AivaSpa is the only staff member who never sleeps.",
    author: "Dr. Maya Patel",
    role: "Owner · Glow Medspa",
    locations: "3 locations · Austin, TX",
    accent: "#E2E54B",
  },
  signup: {
    quote:
      "We set AivaSpa up on a Friday and had 11 consultation requests by Monday morning — five of them after hours. It paid for itself in week one.",
    author: "Jordan Reyes",
    role: "Founder · Lumen Aesthetics",
    locations: "Single location · Brooklyn, NY",
    accent: "#FF77E9",
  },
} as const;

export function AuthMarketingPanel({ side }: { side: "login" | "signup" }) {
  const reduce = useReducedMotion();
  const t = testimonials[side];

  return (
    <aside className="relative hidden h-full lg:block">
      <div className="sticky top-12 space-y-6">
        {/* Headline */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E54B]/40 bg-[#E2E54B]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E2E54B]">
            <Sparkles className="size-3" />
            {side === "login" ? "Your dashboard is live" : "Built for med spa growth"}
          </div>
          <h2 className="text-3xl font-bold leading-[1.1] tracking-tight text-[#F7F8F8]">
            {side === "login" ? (
              <>
                Pick up where <br />
                you left off.
              </>
            ) : (
              <>
                Capture every lead, <br />
                around the clock.
              </>
            )}
          </h2>
          <p className="max-w-md text-sm leading-6 text-[#8A8F98]">
            {side === "login"
              ? "Your AI receptionist has been working while you were away. Review transcripts, follow up on leads, and update your knowledge base."
              : "A 24/7 AI receptionist that greets every visitor, answers from your approved knowledge base, and pings your staff the moment a lead comes in."}
          </p>
        </div>

        {/* Layered product composition */}
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-10 -z-10 rounded-[40px] bg-[#E2E54B]/8 blur-3xl"
          />

          <AnimatedDashboardPreview />

          {/* Floating notification */}
          <motion.div
            aria-hidden
            initial={reduce ? false : { opacity: 0, y: 16, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: 4 }}
            transition={{ delay: 1.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute -right-4 -top-6 hidden w-72 origin-bottom-left rounded-2xl border border-[#23252A] bg-[#121316] p-3.5 shadow-2xl shadow-black/40 sm:block"
            style={{ transformOrigin: "bottom left" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-[#F7F8F8]">
                <span
                  className="flex size-6 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${notification.color}26`, color: notification.color }}
                >
                  <notification.icon className="size-3.5" />
                </span>
                {notification.channel}
              </div>
              <span className="text-[10px] text-[#62666D]">{notification.time}</span>
            </div>
            <p className="mt-2 text-xs text-[#C9CCD2]">{notification.body}</p>
            <div className="mt-2.5 flex items-center justify-between border-t border-[#23252A] pt-2.5 text-[10px]">
              <span className="text-[#62666D]">{notification.recipient}</span>
              <span className="font-semibold text-[#34D399]">1.2s delivery</span>
            </div>
            <motion.span
              aria-hidden
              className="absolute bottom-0 left-0 h-[2px]"
              style={{ backgroundColor: notification.color }}
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ delay: 1.8, duration: 1.2, ease: "easeOut" }}
            />
          </motion.div>

          {/* Floating stat */}
          <motion.div
            aria-hidden
            initial={reduce ? false : { opacity: 0, y: 12, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: -5 }}
            transition={{ delay: 1.6, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute -bottom-5 -left-5 hidden origin-top-right rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-3 shadow-2xl shadow-black/40 sm:block"
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-[#62666D]">
              {floatingStat.label}
            </p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-[#F7F8F8]">{floatingStat.value}</span>
              <span className="text-xs font-semibold" style={{ color: floatingStat.color }}>
                {floatingStat.delta}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1 text-[10px]" style={{ color: floatingStat.color }}>
              <span className="size-1.5 rounded-full bg-[#34D399]" />
              vs last week
            </div>
          </motion.div>
        </div>

        {/* Testimonial */}
        <motion.figure
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative overflow-hidden rounded-2xl border border-[#23252A] bg-[#121316] p-5"
        >
          <Quote
            aria-hidden
            className="absolute -right-2 -top-2 size-12 opacity-10"
            style={{ color: t.accent }}
          />
          <div className="flex items-center gap-1" aria-label="5 out of 5 stars">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="size-3.5 fill-[#E2E54B] text-[#E2E54B]" />
            ))}
          </div>
          <blockquote className="mt-3 text-[15px] leading-6 text-[#F7F8F8]">
            &ldquo;{t.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-4 flex items-center gap-3">
            <div
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{
                background: `linear-gradient(135deg, ${t.accent} 0%, #5E6AD2 100%)`,
                color: "#08090A",
              }}
            >
              {t.author
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#F7F8F8]">{t.author}</p>
              <p className="truncate text-xs text-[#8A8F98]">{t.role}</p>
            </div>
            <span
              aria-hidden
              className="ml-auto size-2 shrink-0 rounded-full"
              style={{ backgroundColor: t.accent }}
            />
          </figcaption>
        </motion.figure>

        {/* Trust row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#62666D]">
          <span className="flex items-center gap-1.5">
            <CalendarCheck className="size-3.5 text-[#34D399]" />
            SOC 2 Type II in progress
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle className="size-3.5 text-[#22D3EE]" />
            HIPAA-aware · BAA available
          </span>
        </div>
      </div>
    </aside>
  );
}
