"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";

interface StatCardProps {
  label: string;
  value: string;
  delta?: { value: string; positive: boolean };
  icon?: React.ReactNode;
  accentColor?: string;
  series?: number[];
  helper?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  delta,
  icon,
  accentColor = "#E2E54B",
  series,
  helper,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-[#23252A] bg-[#121316] p-5",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full opacity-40 blur-3xl"
        style={{ backgroundColor: accentColor }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#62666D]">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#F7F8F8]">
            {value}
          </p>
          {helper ? (
            <p className="mt-1.5 text-xs text-[#8A8F98]">{helper}</p>
          ) : null}
        </div>
        {icon ? (
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: `${accentColor}1A`,
              borderColor: `${accentColor}40`,
              color: accentColor,
            }}
          >
            {icon}
          </div>
        ) : null}
      </div>
      <div className="relative mt-4 flex items-end justify-between gap-3">
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold",
              delta.positive
                ? "border-[#4CB782]/30 bg-[#4CB782]/10 text-[#4CB782]"
                : "border-[#EB5757]/30 bg-[#EB5757]/10 text-[#EB5757]",
            )}
          >
            {delta.positive ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {delta.value}
          </span>
        ) : (
          <span />
        )}
        {series && series.length ? (
          <Sparkline data={series} width={120} height={32} stroke={accentColor} fill={`${accentColor}1F`} />
        ) : null}
      </div>
    </div>
  );
}
