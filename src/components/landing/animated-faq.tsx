"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export type FaqItem = { q: string; a: string };

const colorRing = ["#E2E54B", "#E2E54B", "#FF77E9", "#22D3EE", "#34D399"];

export function AnimatedFaq({ items }: { items: FaqItem[] }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mt-12 divide-y divide-[#23252A] overflow-hidden rounded-3xl border border-[#23252A] bg-[#121316]">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <motion.div
            key={item.q}
            className="p-6 lg:p-7"
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ delay: i * 0.06, duration: 0.5 }}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full cursor-pointer items-center justify-between gap-6 text-left text-lg font-semibold text-[#F7F8F8]"
            >
              <span className="flex items-center gap-3">
                <span
                  className="size-2.5 rounded-full transition-colors"
                  style={{ backgroundColor: isOpen ? colorRing[i % colorRing.length] : "#62666D" }}
                />
                {item.q}
              </span>
              <motion.span
                animate={reduce ? undefined : { rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                style={{ color: isOpen ? colorRing[i % colorRing.length] : "#8A8F98" }}
              >
                <ChevronDown className="size-4 shrink-0" />
              </motion.span>
            </button>
            <motion.div
              initial={false}
              animate={{
                height: isOpen ? "auto" : 0,
                opacity: isOpen ? 1 : 0,
                marginTop: isOpen ? 16 : 0,
              }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <p className="text-sm leading-7 text-[#8A8F98]">{item.a}</p>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
