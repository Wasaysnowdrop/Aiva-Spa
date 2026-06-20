"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Bot, Send } from "lucide-react";

type Bubble = {
  from: "ai" | "user";
  text: string;
  delay: number;
};

const conversation: Bubble[] = [
  {
    from: "ai",
    text: "Hi! Are you looking to book a consultation or ask about a treatment?",
    delay: 0.2,
  },
  { from: "user", text: "Do you offer Botox and how much is it?", delay: 1.1 },
  {
    from: "ai",
    text: "Yes — we offer Botox consultations. Exact pricing depends on the units needed; a licensed provider confirms during your consultation. May I take your details to set it up?",
    delay: 2.1,
  },
];

const quickReplies = ["Book Botox consult", "Ask about fillers", "See pricing"];

export function AnimatedChatWidget() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="relative"
      initial={reduce ? false : { opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-[#E2E54B]/12 blur-2xl" />
      <div className="overflow-hidden rounded-3xl border border-[#23252A] bg-[#1A1B1E] shadow-[0_30px_80px_-20px_rgba(94,106,210,0.45)]">
        <motion.div
          className="flex items-center justify-between border-b border-[#23252A] px-5 py-3.5"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#E2E54B]">
              <Bot className="size-3.5 text-[#08090A]" />
            </span>
            <div className="leading-tight">
              <p className="text-xs font-semibold text-[#F7F8F8]">Aiva · Lume Aesthetics</p>
              <p className="text-[10px] text-[#8A8F98]">Online · responds in seconds</p>
            </div>
          </div>
          <motion.span
            className="flex size-2.5 rounded-full bg-[#34D399]"
            animate={reduce ? undefined : { scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        <div className="space-y-3 px-5 py-5">
          {conversation.map((bubble, i) => (
            <motion.div
              key={i}
              className={`flex items-end gap-2 ${bubble.from === "user" ? "justify-end" : ""}`}
              initial={reduce ? false : { opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: bubble.delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {bubble.from === "ai" && (
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#E2E54B]/20 text-[#E2E54B]">
                  <Bot className="size-3.5 text-[#E2E54B]" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  bubble.from === "user"
                    ? "rounded-br-sm bg-[#E2E54B] text-[#08090A]"
                    : "rounded-bl-sm border border-[#23252A] bg-[#121316] text-[#F7F8F8]"
                }`}
              >
                {bubble.text}
              </div>
            </motion.div>
          ))}

          <motion.div
            className="rounded-2xl border border-[#23252A] bg-[#121316] p-3"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 3.1, duration: 0.5 }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A8F98]">
              Quick reply
            </p>
            <p className="mt-1 text-sm text-[#F7F8F8]">Sure, here are my details</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickReplies.map((chip, i) => (
                <motion.span
                  key={chip}
                  className="rounded-full border border-[#23252A] bg-[#1A1B1E] px-2.5 py-1 text-[11px] text-[#F7F8F8]"
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 3.3 + i * 0.1, duration: 0.4 }}
                  whileHover={reduce ? undefined : { y: -2, borderColor: "#E2E54B" }}
                >
                  {chip}
                </motion.span>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="flex items-center gap-1.5 px-1"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3.7, duration: 0.4 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="size-1.5 rounded-full bg-[#8A8F98]"
                animate={reduce ? undefined : { y: [0, -3, 0] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
              />
            ))}
            <span className="ml-1 text-[10px] text-[#62666D]">Aiva is typing…</span>
          </motion.div>
        </div>

        <div className="border-t border-[#23252A] p-3">
          <div className="flex items-center gap-2 rounded-xl border border-[#23252A] bg-[#121316] px-3 py-2">
            <input
              readOnly
              defaultValue="Type your message…"
              className="flex-1 bg-transparent text-sm text-[#62666D] outline-none"
            />
            <motion.button
              className="flex size-7 items-center justify-center rounded-lg bg-[#E2E54B] text-[#08090A]"
              whileHover={reduce ? undefined : { scale: 1.08, rotate: -8 }}
              whileTap={reduce ? undefined : { scale: 0.95 }}
            >
              <Send className="size-3.5" />
            </motion.button>
          </div>
          <p className="mt-2 px-1 text-[10px] text-[#62666D]">
            Information is general; a licensed provider confirms treatment suitability and pricing.
          </p>
        </div>
      </div>

      <motion.div
        className="absolute -right-3 -top-3 hidden items-center gap-2 rounded-full border border-[#23252A] bg-[#1A1B1E] px-3 py-1.5 text-[11px] font-semibold text-[#F7F8F8] shadow-lg sm:flex"
        animate={reduce ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.span
          className="size-1.5 rounded-full bg-[#34D399]"
          animate={reduce ? undefined : { scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        24/7 live
      </motion.div>
    </motion.div>
  );
}
