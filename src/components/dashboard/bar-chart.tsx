"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface BarChartProps {
  data: { day: string; value: number; label?: string }[];
  height?: number;
  accentColor?: string;
  className?: string;
  showValues?: boolean;
}

export function BarChart({
  data,
  height = 180,
  accentColor = "#E2E54B",
  className,
  showValues = false,
}: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <div className="flex h-full items-end justify-between gap-1.5">
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          const isLast = i === data.length - 1;
          return (
            <div
              key={`${d.day}-${d.label ?? i}-${i}`}
              className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
            >
              {showValues ? (
                <span className="text-[10px] font-semibold text-[#8A8F98] opacity-0 transition group-hover:opacity-100">
                  {d.value}
                </span>
              ) : null}
              <div
                className={cn(
                  "w-full rounded-md transition-all",
                  isLast ? "" : "bg-[#1A1B1E] group-hover:bg-[#23252A]",
                )}
                style={{
                  height: `${Math.max(pct, 4)}%`,
                  backgroundColor: isLast ? accentColor : undefined,
                  boxShadow: isLast ? `0 0 24px ${accentColor}40` : undefined,
                }}
                title={d.label ?? `${d.day}: ${d.value}`}
              />
              <span className="text-[10px] text-[#62666D]">{d.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
