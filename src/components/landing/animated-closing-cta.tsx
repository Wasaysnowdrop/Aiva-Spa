"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function AnimatedClosingCta() {
  const reduce = useReducedMotion();

  const confetti = [
    { color: "#E2E54B", top: "8%", left: "6%", size: 14, dur: 9 },
    { color: "#E2E54B", top: "20%", left: "88%", size: 10, dur: 11 },
    { color: "#FF77E9", top: "70%", left: "8%", size: 12, dur: 10 },
    { color: "#22D3EE", top: "78%", left: "92%", size: 10, dur: 12 },
    { color: "#A78BFA", top: "35%", left: "4%", size: 8, dur: 8 },
    { color: "#34D399", top: "45%", left: "95%", size: 9, dur: 13 },
    { color: "#FB923C", top: "85%", left: "48%", size: 8, dur: 10 },
  ];

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-[32px] border border-[#23252A] bg-[#121316] p-10 text-center lg:p-16">
        {confetti.map((c, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              backgroundColor: c.color,
              width: c.size,
              height: c.size,
              top: c.top,
              left: c.left,
            }}
            animate={
              reduce
                ? undefined
                : { y: [0, -16, 0, 12, 0], x: [0, 6, -4, 0], opacity: [0.6, 1, 0.7, 1, 0.6] }
            }
            transition={{ duration: c.dur, delay: i * 0.3, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}

        <div className="relative">
          <motion.p
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E2E54B]"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Ready when you are
          </motion.p>
          <motion.h2
            className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight text-[#F7F8F8] md:text-5xl lg:text-6xl"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            Built for growth.{" "}
            <span className="relative inline-block">
              <span className="relative z-10">Available today.</span>
              <motion.span
                aria-hidden
                className="absolute bottom-1 left-0 h-3 w-full bg-[#E2E54B]/40"
                initial={{ scaleX: 0, originX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.7, duration: 0.8, ease: "easeOut" }}
              />
            </span>
          </motion.h2>
          <motion.p
            className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#8A8F98]"
            initial={reduce ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            Start your 7-day free trial on Growth or talk to our team about a custom rollout for your med spa group.
          </motion.p>
          <motion.div
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.45, duration: 0.5 }}
          >
            <motion.a
              href="/demo"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E2E54B] px-6 py-3.5 text-sm font-semibold text-[#08090A] sm:w-auto"
              whileHover={reduce ? undefined : { y: -3, boxShadow: "0 14px 30px -10px rgba(226,229,75,0.55)" }}
              whileTap={reduce ? undefined : { scale: 0.97 }}
            >
              Try live demo
              <ArrowRight className="size-4" />
            </motion.a>
            <motion.a
              href="mailto:sales@aivaspa.com?subject=AivaSpa%20walkthrough"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#23252A] bg-[#1A1B1E] px-6 py-3.5 text-sm font-semibold text-[#F7F8F8] sm:w-auto"
              whileHover={reduce ? undefined : { y: -3, borderColor: "#E2E54B" }}
              whileTap={reduce ? undefined : { scale: 0.97 }}
            >
              Book a walkthrough
            </motion.a>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
