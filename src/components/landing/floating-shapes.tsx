"use client";

import { motion, useReducedMotion } from "framer-motion";

type Shape = {
  color: string;
  size: number;
  top: string;
  left: string;
  delay: number;
  duration: number;
  type: "circle" | "square" | "ring" | "dot";
  rotate?: number;
};

const heroShapes: Shape[] = [
  { color: "#E2E54B", size: 14, top: "12%", left: "8%", delay: 0, duration: 9, type: "circle" },
  { color: "#E2E54B", size: 10, top: "22%", left: "78%", delay: 1.2, duration: 11, type: "circle" },
  { color: "#FF77E9", size: 8, top: "55%", left: "6%", delay: 0.6, duration: 10, type: "ring" },
  { color: "#22D3EE", size: 12, top: "70%", left: "88%", delay: 1.6, duration: 12, type: "square", rotate: 25 },
  { color: "#A78BFA", size: 6, top: "40%", left: "92%", delay: 0.3, duration: 8, type: "circle" },
  { color: "#FB923C", size: 10, top: "82%", left: "16%", delay: 0.9, duration: 13, type: "dot" },
  { color: "#34D399", size: 8, top: "30%", left: "48%", delay: 1.4, duration: 10, type: "ring" },
  { color: "#E2E54B", size: 5, top: "18%", left: "30%", delay: 0.4, duration: 9, type: "circle" },
  { color: "#E2E54B", size: 6, top: "64%", left: "70%", delay: 1.8, duration: 11, type: "circle" },
];

const sectionShapes: Shape[] = [
  { color: "#E2E54B", size: 10, top: "8%", left: "5%", delay: 0, duration: 10, type: "circle" },
  { color: "#FF77E9", size: 8, top: "70%", left: "92%", delay: 0.4, duration: 12, type: "ring" },
  { color: "#22D3EE", size: 7, top: "40%", left: "3%", delay: 0.8, duration: 11, type: "dot" },
  { color: "#E2E54B", size: 9, top: "20%", left: "95%", delay: 1.2, duration: 13, type: "circle" },
];

function ShapeVisual({ shape }: { shape: Shape }) {
  const base: React.CSSProperties = {
    width: shape.size,
    height: shape.size,
    backgroundColor: shape.type === "ring" || shape.type === "dot" ? "transparent" : shape.color,
    border: shape.type === "ring" || shape.type === "dot" ? `2px solid ${shape.color}` : undefined,
    borderRadius: shape.type === "square" ? 4 : 999,
    transform: `rotate(${shape.rotate ?? 0}deg)`,
  };
  if (shape.type === "dot") {
    base.boxShadow = `0 0 12px 2px ${shape.color}`;
  }
  return <span style={base} />;
}

export function FloatingShapes({
  variant = "hero",
  className,
}: {
  variant?: "hero" | "section";
  className?: string;
}) {
  const reduce = useReducedMotion();
  const shapes = variant === "hero" ? heroShapes : sectionShapes;

  if (reduce) {
    return <div aria-hidden className={className} />;
  }

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
    >
      {shapes.map((shape, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ top: shape.top, left: shape.left }}
          initial={{ y: 0, opacity: 0 }}
          animate={{
            y: [0, -18, 0, 14, 0],
            x: [0, 8, -6, 4, 0],
            opacity: [0.6, 1, 0.7, 1, 0.6],
            rotate: [shape.rotate ?? 0, (shape.rotate ?? 0) + 20, shape.rotate ?? 0],
          }}
          transition={{
            duration: shape.duration,
            delay: shape.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <ShapeVisual shape={shape} />
        </motion.span>
      ))}
    </div>
  );
}
