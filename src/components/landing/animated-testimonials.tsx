"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Star, User } from "lucide-react";

type Testimonial = {
  quote: string;
  author: string;
  role: string;
  bg: string;
  textColor: string;
  starColor: string;
  avatarBg: string;
  avatarColor: string;
  confetti: string[];
};

const testimonials: Testimonial[] = [
  {
    quote:
      "AivaSpa booked three consultations from after-hours traffic in the first week. The dashboard tells us exactly which treatments people are asking about — it changed how we staff our front desk.",
    author: "Dr. Mara Vance",
    role: "Owner, Lume Aesthetics",
    bg: "#E2E54B",
    textColor: "#08090A",
    starColor: "#08090A",
    avatarBg: "#08090A",
    avatarColor: "#E2E54B",
    confetti: ["#E2E54B", "#FF77E9", "#22D3EE", "#08090A"],
  },
  {
    quote:
      "We used to lose leads between web forms, DMs, and missed calls. Now every visitor gets an instant answer, and my team gets a clean, prioritized inbox every morning.",
    author: "Priya Shah",
    role: "Manager, Glow Studio",
    bg: "#1A1B1E",
    textColor: "#F7F8F8",
    starColor: "#E2E54B",
    avatarBg: "#E2E54B",
    avatarColor: "#F7F8F8",
    confetti: ["#E2E54B", "#E2E54B", "#FF77E9", "#22D3EE"],
  },
];

export function AnimatedTestimonials() {
  const reduce = useReducedMotion();
  return (
    <div className="mt-14 grid gap-5 lg:grid-cols-2">
      {testimonials.map((t, i) => (
        <motion.figure
          key={t.author}
          className="relative overflow-hidden rounded-3xl p-8 lg:p-10"
          style={{ backgroundColor: t.bg, color: t.textColor, border: t.bg === "#1A1B1E" ? "1px solid #23252A" : "none" }}
          initial={reduce ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ delay: i * 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          whileHover={reduce ? undefined : { y: -4 }}
        >
          {/* floating confetti dots */}
          {t.confetti.map((c, j) => (
            <motion.span
              key={j}
              className="absolute size-2 rounded-full"
              style={{
                backgroundColor: c,
                top: `${15 + (j * 17) % 70}%`,
                left: `${8 + (j * 23) % 80}%`,
              }}
              animate={
                reduce
                  ? undefined
                  : { y: [0, -10, 0], opacity: [0.5, 1, 0.5], scale: [1, 1.3, 1] }
              }
              transition={{
                duration: 4 + (j % 3),
                delay: j * 0.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}

          <div className="relative flex gap-1" style={{ color: t.starColor }}>
            {Array.from({ length: 5 }).map((_, j) => (
              <motion.span
                key={j}
                initial={reduce ? false : { opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.15 + j * 0.06, duration: 0.3, ease: "easeOut" }}
              >
                <Star className="size-4 fill-current" />
              </motion.span>
            ))}
          </div>
          <blockquote className="relative mt-6 text-2xl font-semibold leading-snug tracking-tight lg:text-3xl">
            &ldquo;{t.quote}&rdquo;
          </blockquote>
          <figcaption className="relative mt-8 flex items-center gap-3 text-sm">
            <motion.div
              className="flex size-10 items-center justify-center rounded-full"
              style={{ backgroundColor: t.avatarBg, color: t.avatarColor }}
              animate={reduce ? undefined : { rotate: [0, 6, -6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              <User className="size-4" />
            </motion.div>
            <div>
              <p className="font-semibold">{t.author}</p>
              <p style={{ color: t.textColor, opacity: 0.7 }}>{t.role}</p>
            </div>
          </figcaption>
        </motion.figure>
      ))}
    </div>
  );
}
