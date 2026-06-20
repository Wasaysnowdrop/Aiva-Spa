"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Clock, Plus, Search } from "lucide-react";

const faqs = [
  { tag: "Botox", q: "Pricing depends on units; provider confirms at consult.", source: "FAQ #3", color: "#E2E54B" },
  { tag: "Fillers", q: "Appointments: Tue–Sat, 10am–6pm. Last booking 1h before close.", source: "FAQ #7", color: "#E2E54B" },
  { tag: "Laser", q: "Avoid sun 2 weeks pre/post. Patch test required for new clients.", source: "FAQ #11", color: "#FF77E9" },
];

export function AnimatedKbVisual() {
  const reduce = useReducedMotion();
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-[#E2E54B]/10 blur-2xl" />
      <div className="overflow-hidden rounded-3xl border border-[#23252A] bg-[#121316]">
        <div className="flex items-center justify-between border-b border-[#23252A] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#22D3EE]" />
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8A8F98]">
              Approved knowledge base
            </p>
          </div>
          <span className="text-[10px] text-[#62666D]">3 services · 12 FAQs</span>
        </div>
        <div className="space-y-2 p-4">
          {faqs.map((row, i) => (
            <motion.div
              key={row.tag}
              className="flex items-start gap-3 rounded-xl border border-[#23252A] bg-[#1A1B1E] p-3"
              initial={reduce ? false : { opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: i * 0.12, duration: 0.5, ease: "easeOut" }}
              whileHover={reduce ? undefined : { y: -2, borderColor: row.color }}
            >
              <span
                className="mt-0.5 rounded-md px-2 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: `${row.color}26`, color: row.color }}
              >
                {row.tag}
              </span>
              <div className="flex-1">
                <p className="text-sm text-[#F7F8F8]">{row.q}</p>
                <p className="mt-1 text-[10px] text-[#62666D]">Source: {row.source}</p>
              </div>
            </motion.div>
          ))}
          <motion.div
            className="flex items-center gap-2 rounded-xl border border-dashed border-[#23252A] px-3 py-2.5 text-xs text-[#8A8F98]"
            whileHover={reduce ? undefined : { borderColor: "#E2E54B", color: "#F7F8F8" }}
          >
            <Plus className="size-3.5" /> Add FAQ
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export function AnimatedLeadVisual() {
  const reduce = useReducedMotion();
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-[#E2E54B]/15 blur-2xl" />
      <div className="overflow-hidden rounded-3xl border border-[#23252A] bg-[#121316]">
        <div className="flex items-center justify-between border-b border-[#23252A] px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8A8F98]">New lead captured</p>
          <motion.span
            className="rounded-full bg-[#34D399]/20 px-2 py-0.5 text-[10px] font-semibold text-[#34D399]"
            animate={reduce ? undefined : { scale: [1, 1.08, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            Hot
          </motion.span>
        </div>
        <div className="space-y-3 p-5">
          <div className="flex items-center gap-3">
            <motion.div
              className="flex size-10 items-center justify-center rounded-full bg-[#E2E54B]/20 text-sm font-semibold text-[#E2E54B]"
              animate={reduce ? undefined : { rotate: [0, 6, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              SC
            </motion.div>
            <div>
              <p className="text-sm font-semibold text-[#F7F8F8]">Sarah Chen</p>
              <p className="text-xs text-[#8A8F98]">sarah@example.com · (415) 555-0142</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <motion.div
              className="rounded-xl border border-[#23252A] bg-[#1A1B1E] px-3 py-2"
              whileHover={reduce ? undefined : { borderColor: "#E2E54B", y: -2 }}
            >
              <p className="text-[10px] uppercase tracking-wider text-[#62666D]">Service</p>
              <p className="mt-0.5 font-semibold text-[#F7F8F8]">Botox consult</p>
            </motion.div>
            <motion.div
              className="rounded-xl border border-[#23252A] bg-[#1A1B1E] px-3 py-2"
              whileHover={reduce ? undefined : { borderColor: "#E2E54B", y: -2 }}
            >
              <p className="text-[10px] uppercase tracking-wider text-[#62666D]">Preferred</p>
              <p className="mt-0.5 font-semibold text-[#F7F8F8]">Sat 2–4pm</p>
            </motion.div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[#23252A] bg-[#1A1B1E] px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs text-[#8A8F98]">
              <Clock className="size-3.5 text-[#E2E54B]" />
              <span>11:42 PM · After hours</span>
            </div>
            <span className="rounded-md bg-[#E2E54B]/20 px-2 py-0.5 text-[10px] font-semibold text-[#E2E54B]">
              /pricing
            </span>
          </div>
          <div className="flex gap-2">
            <motion.button
              className="flex-1 rounded-lg bg-[#E2E54B] px-3 py-2 text-xs font-semibold text-[#08090A]"
              whileHover={reduce ? undefined : { scale: 1.02 }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
            >
              Contact lead
            </motion.button>
            <motion.button
              className="rounded-lg border border-[#23252A] bg-[#1A1B1E] px-3 py-2 text-xs font-semibold text-[#F7F8F8]"
              whileHover={reduce ? undefined : { borderColor: "#E2E54B" }}
            >
              View transcript
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnimatedPipelineVisual() {
  const reduce = useReducedMotion();
  const stages = [
    { name: "New", count: 12, color: "#E2E54B" },
    { name: "Contacted", count: 8, color: "#E2E54B" },
    { name: "Booked", count: 14, color: "#34D399" },
    { name: "Lost", count: 3, color: "#62666D" },
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-[#34D399]/12 blur-2xl" />
      <div className="overflow-hidden rounded-3xl border border-[#23252A] bg-[#121316]">
        <div className="flex items-center justify-between border-b border-[#23252A] px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8A8F98]">Leads pipeline</p>
          <div className="flex items-center gap-1.5 text-[10px] text-[#62666D]">
            <Search className="size-3" /> Search
          </div>
        </div>
        <div className="grid grid-cols-4 gap-px border-b border-[#23252A] bg-[#23252A]">
          {stages.map((s) => (
            <div key={s.name} className="bg-[#121316] p-3">
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                <p className="text-[10px] uppercase tracking-wider text-[#8A8F98]">{s.name}</p>
              </div>
              <p className="mt-1 text-lg font-semibold text-[#F7F8F8]">{s.count}</p>
            </div>
          ))}
        </div>
        <div className="divide-y divide-[#23252A]">
          {[
            { name: "Sarah Chen", service: "Botox", time: "2m ago", initials: "SC", color: "#E2E54B" },
            { name: "J. Park", service: "Fillers", time: "14m ago", initials: "JP", color: "#FF77E9" },
            { name: "M. Alvarez", service: "Laser", time: "1h ago", initials: "MA", color: "#22D3EE" },
          ].map((row, i) => (
            <motion.div
              key={row.name}
              className="flex items-center justify-between px-5 py-3"
              initial={reduce ? false : { opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
              whileHover={reduce ? undefined : { x: 4, backgroundColor: "rgba(26,27,30,0.6)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex size-7 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{ backgroundColor: `${row.color}33`, color: row.color }}
                >
                  {row.initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#F7F8F8]">{row.name}</p>
                  <p className="text-[11px] text-[#8A8F98]">{row.service} · {row.time}</p>
                </div>
              </div>
              <span className="text-xs text-[#62666D]">→</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
