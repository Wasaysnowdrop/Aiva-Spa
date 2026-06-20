"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Clock, TrendingUp, Zap } from "lucide-react";

const bars = [35, 50, 42, 65, 60, 78, 70, 90, 80, 95, 88, 100];

export function AnimatedAnalyticsVisual() {
  const reduce = useReducedMotion();
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-[#FF77E9]/12 blur-2xl" />
      <div className="grid gap-3">
        <div className="overflow-hidden rounded-3xl border border-[#23252A] bg-[#121316] p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8A8F98]">Visitor → Lead</p>
            <span className="rounded-md bg-[#34D399]/20 px-2 py-0.5 text-[10px] font-semibold text-[#34D399]">
              +18%
            </span>
          </div>
          <p className="mt-2 text-3xl font-semibold text-[#F7F8F8]">14.2%</p>
          <div className="mt-4 flex h-16 items-end gap-1">
            {bars.map((h, i) => (
              <motion.div
                key={i}
                initial={reduce ? false : { height: 0 }}
                whileInView={{ height: `${h}%` }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 rounded-sm bg-[#E2E54B]"
                style={{ originY: 1 }}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "After hours", value: "32%", Icon: Clock, color: "#E2E54B" },
            { label: "First reply", value: "1.4s", Icon: Zap, color: "#E2E54B" },
            { label: "Booked", value: "38%", Icon: TrendingUp, color: "#34D399" },
          ].map((m, i) => (
            <motion.div
              key={m.label}
              className="rounded-2xl border border-[#23252A] bg-[#121316] p-3"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
              whileHover={reduce ? undefined : { y: -3, borderColor: m.color }}
            >
              <m.Icon className="size-3.5" style={{ color: m.color }} />
              <p className="mt-2 text-lg font-semibold text-[#F7F8F8]">{m.value}</p>
              <p className="text-[10px] text-[#8A8F98]">{m.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
