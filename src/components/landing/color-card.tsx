"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

type ColorScheme = "indigo" | "yellow" | "pink" | "cyan" | "green" | "purple";

const colorMap: Record<ColorScheme, { ring: string; accent: string; glow: string }> = {
  indigo: { ring: "#E2E54B", accent: "#E2E54B", glow: "#E2E54B" },
  yellow: { ring: "#E2E54B", accent: "#E2E54B", glow: "#E2E54B" },
  pink: { ring: "#FF77E9", accent: "#FF77E9", glow: "#FF77E9" },
  cyan: { ring: "#22D3EE", accent: "#22D3EE", glow: "#22D3EE" },
  green: { ring: "#34D399", accent: "#34D399", glow: "#34D399" },
  purple: { ring: "#A78BFA", accent: "#A78BFA", glow: "#A78BFA" },
};

export function ColorCard({
  children,
  color = "indigo",
  className = "",
}: {
  children: React.ReactNode;
  color?: ColorScheme;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const c = colorMap[color];
  return (
    <motion.div
      className={`group relative overflow-hidden rounded-3xl border border-[#23252A] bg-[#121316] p-7 transition-colors hover:border-transparent ${className}`}
      style={{}}
      initial={reduce ? false : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      whileHover={reduce ? undefined : { y: -6 }}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-3xl"
        style={{ border: `1px solid ${c.ring}` }}
        initial={{ opacity: 0 }}
        whileHover={reduce ? undefined : { opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-1 -z-10 rounded-[28px] opacity-0 blur-2xl"
        style={{ backgroundColor: c.glow }}
        whileHover={reduce ? undefined : { opacity: 0.18 }}
        transition={{ duration: 0.3 }}
      />
      {children}
    </motion.div>
  );
}

export function ParallaxSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  if (reduce) {
    return <div ref={ref} className={className}>{children}</div>;
  }
  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}
