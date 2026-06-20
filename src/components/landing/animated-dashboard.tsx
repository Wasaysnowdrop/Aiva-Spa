"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, Command, Database, Inbox, MessageCircle, Settings } from "lucide-react";

const sideNav = [
  { icon: Inbox, label: "Leads", color: "#E2E54B" },
  { icon: MessageCircle, label: "Conversations" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Database, label: "Knowledge" },
  { icon: Settings, label: "Settings" },
];

const stats = [
  { label: "New leads", value: "12", delta: "+3", color: "#E2E54B" },
  { label: "Booked", value: "5", delta: "+2", color: "#34D399" },
  { label: "Reply time", value: "1.4s", delta: "−0.6s", color: "#E2E54B" },
];

const chartBars = [35, 50, 42, 65, 60, 78, 70, 90, 80, 95, 88, 100];

export function AnimatedDashboardPreview() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="relative"
      initial={reduce ? false : { opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute -inset-8 -z-10 rounded-[48px] bg-[#E2E54B]/10 blur-3xl" />
      <div className="overflow-hidden rounded-3xl border border-[#23252A] bg-[#121316] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#23252A] px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <motion.span
              className="size-2.5 rounded-full bg-[#EB5757]"
              animate={reduce ? undefined : { scale: [1, 1.15, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.span
              className="size-2.5 rounded-full bg-[#E2E54B]"
              animate={reduce ? undefined : { scale: [1, 1.15, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
            />
            <motion.span
              className="size-2.5 rounded-full bg-[#34D399]"
              animate={reduce ? undefined : { scale: [1, 1.15, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
            />
          </div>
          <p className="text-[10px] text-[#62666D]">aivaspa.com/dashboard</p>
          <Command className="size-3 text-[#62666D]" />
        </div>
        <div className="grid grid-cols-[160px_1fr]">
          <div className="space-y-1 border-r border-[#23252A] p-3 text-xs">
            {sideNav.map((item) => (
              <motion.div
                key={item.label}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[#8A8F98] transition-colors hover:bg-[#1A1B1E] hover:text-[#F7F8F8]"
                whileHover={reduce ? undefined : { x: 3 }}
              >
                <item.icon className="size-3.5" style={{ color: item.color ?? "currentColor" }} />
                {item.label}
              </motion.div>
            ))}
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#F7F8F8]">Today</p>
              <motion.span
                className="rounded-md bg-[#E2E54B]/20 px-2 py-0.5 text-[10px] font-semibold text-[#E2E54B]"
                animate={reduce ? undefined : { opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              >
                Live
              </motion.span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {stats.map((s, i) => (
                <motion.div
                  key={s.label}
                  className="rounded-xl border border-[#23252A] bg-[#1A1B1E] p-2.5"
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                  whileHover={reduce ? undefined : { y: -2, borderColor: s.color }}
                >
                  <p className="text-[10px] text-[#8A8F98]">{s.label}</p>
                  <p className="mt-1 text-lg font-semibold text-[#F7F8F8]">{s.value}</p>
                  <p className="text-[10px]" style={{ color: s.color }}>
                    {s.delta}
                  </p>
                </motion.div>
              ))}
            </div>
            <div className="mt-3 flex h-20 items-end gap-1 rounded-xl border border-[#23252A] bg-[#1A1B1E] p-3">
              {chartBars.map((h, i) => (
                <motion.div
                  key={i}
                  className="flex-1 rounded-sm bg-[#E2E54B]"
                  initial={reduce ? false : { height: 0 }}
                  whileInView={{ height: `${h}%` }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ delay: 0.6 + i * 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
