"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CalendarCheck, Mail, MessageCircle } from "lucide-react";

const notifications = [
  {
    icon: Mail,
    title: "Email · Owner",
    body: "New lead: Sarah Chen — Botox consult, Sat 2–4pm",
    time: "just now",
    color: "#E2E54B",
  },
  {
    icon: MessageCircle,
    title: "Email · Front desk",
    body: "After-hours lead from /pricing captured",
    time: "11:42 PM",
    color: "#FF77E9",
  },
  {
    icon: CalendarCheck,
    title: "Calendar",
    body: "Consultation booked — auto-confirmed",
    time: "12:04 PM",
    color: "#34D399",
  },
];

export function HeroNotifications() {
  const reduce = useReducedMotion();
  return (
    <div className="space-y-3">
      {notifications.map((n, i) => (
        <motion.div
          key={n.title}
          className="group relative overflow-hidden rounded-2xl border border-[#23252A] bg-[#121316] p-4"
          initial={reduce ? false : { opacity: 0, x: 30, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ delay: 0.6 + i * 0.18, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          whileHover={reduce ? undefined : { y: -3, borderColor: n.color }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F7F8F8]">
              <motion.span
                className="flex size-6 items-center justify-center rounded-md"
                style={{ backgroundColor: `${n.color}26`, color: n.color }}
                animate={reduce ? undefined : { scale: [1, 1.1, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
              >
                <n.icon className="size-3.5" />
              </motion.span>
              {n.title}
            </div>
            <span className="text-[10px] text-[#62666D]">{n.time}</span>
          </div>
          <p className="mt-2.5 text-sm text-[#C9CCD2]">{n.body}</p>
          <motion.span
            className="absolute bottom-0 left-0 h-[2px]"
            style={{ backgroundColor: n.color }}
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ delay: 0.9 + i * 0.18, duration: 1.2, ease: "easeOut" }}
          />
        </motion.div>
      ))}
    </div>
  );
}
