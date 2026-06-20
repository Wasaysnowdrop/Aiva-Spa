"use client";

import { motion, useReducedMotion } from "framer-motion";

const logos = [
  "Lume Aesthetics",
  "Glow Studio",
  "Skin Atelier",
  "Bare Medspa",
  "Halo & Co.",
  "Verve Clinic",
];

const dotColors = ["#E2E54B", "#E2E54B", "#FF77E9", "#22D3EE", "#A78BFA", "#34D399"];

export function MarqueeLogos() {
  const reduce = useReducedMotion();
  const items = [...logos, ...logos, ...logos];

  return (
    <div className="relative overflow-hidden">
      <motion.div
        className="flex w-max items-center gap-12"
        animate={reduce ? undefined : { x: ["0%", "-33.333%"] }}
        transition={{ duration: 28, ease: "linear", repeat: Infinity }}
      >
        {items.map((logo, i) => (
          <div
            key={`${logo}-${i}`}
            className="flex shrink-0 items-center gap-3 text-base font-semibold tracking-tight text-[#C9CCD2]"
          >
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: dotColors[i % dotColors.length] }}
            />
            {logo}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
