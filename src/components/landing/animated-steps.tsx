"use client";

import { motion, useReducedMotion } from "framer-motion";

const stepColors = ["#E2E54B", "#E2E54B", "#FF77E9", "#34D399"];

type Step = {
  step: string;
  title: string;
  body: string;
};

export function AnimatedSteps({ steps }: { steps: Step[] }) {
  const reduce = useReducedMotion();
  return (
    <ol className="relative space-y-5">
      <motion.span
        aria-hidden
        className="absolute left-[39px] top-3 bottom-3 w-px"
        style={{ backgroundColor: "#23252A" }}
        initial={reduce ? false : { scaleY: 0, originY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      {steps.map((s, i) => {
        const c = stepColors[i % stepColors.length];
        return (
          <motion.li
            key={s.step}
            className="relative grid grid-cols-[auto_1fr] items-start gap-5 rounded-2xl border border-[#23252A] bg-[#121316] p-6"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            whileHover={reduce ? undefined : { x: 4, borderColor: c }}
          >
            <motion.span
              className="relative z-10 flex size-10 items-center justify-center rounded-xl text-sm font-semibold"
              style={{ backgroundColor: `${c}26`, color: c }}
              animate={reduce ? undefined : { scale: [1, 1.08, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
            >
              {s.step}
            </motion.span>
            <div>
              <h3 className="text-lg font-semibold text-[#F7F8F8]">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-7 text-[#8A8F98]">{s.body}</p>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
