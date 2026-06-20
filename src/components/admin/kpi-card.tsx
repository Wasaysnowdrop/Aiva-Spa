"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, Minus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Sparkline } from "./sparkline"

export type KpiCardProps = {
  label: string
  value: string | number
  hint?: string
  delta?: number
  deltaUnit?: "%" | "count"
  trend?: number[]
  tone?: "default" | "success" | "warn" | "danger"
  icon?: React.ReactNode
  loading?: boolean
  onClick?: () => void
}

const toneColor: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "var(--accent-primary)",
  success: "var(--success)",
  warn: "#F2C94C",
  danger: "var(--danger)",
}

export function KpiCard({
  label,
  value,
  hint,
  delta,
  deltaUnit = "%",
  trend = [],
  tone = "default",
  icon,
  loading = false,
  onClick,
}: KpiCardProps) {
  const formattedValue = React.useMemo(() => {
    if (loading) return "—"
    if (typeof value === "number") {
      return new Intl.NumberFormat("en-US", {
        notation: value >= 1_000_000 ? "compact" : "standard",
        maximumFractionDigits: 1,
      }).format(value)
    }
    return value
  }, [value, loading])

  const isPositive = delta !== undefined && delta > 0
  const isNegative = delta !== undefined && delta < 0

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group relative flex w-full flex-col items-start gap-2 overflow-hidden rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-5 text-left transition",
        onClick && "hover:border-[#3A3D45] hover:bg-[#101115]",
      )}
    >
      <div className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-[#62666D]">
        <span>{label}</span>
        {icon ? <span className="text-[#8A8F98]">{icon}</span> : null}
      </div>
      <div className="flex w-full items-end justify-between gap-3">
        <div className="flex flex-col">
          <span
            className="text-2xl font-bold tabular-nums text-[#F7F8F8] sm:text-3xl"
            style={{ color: toneColor[tone] }}
          >
            {formattedValue}
          </span>
          {hint ? (
            <span className="mt-0.5 text-[10px] text-[#8A8F98]">{hint}</span>
          ) : null}
        </div>
        {trend.length > 0 ? (
          <Sparkline
            data={trend}
            width={96}
            height={32}
            stroke={toneColor[tone]}
            fill={`${toneColor[tone]}20`}
          />
        ) : null}
      </div>
      {delta !== undefined ? (
        <div
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
            isPositive && "border-[#4CB782]/30 bg-[#4CB782]/10 text-[#4CB782]",
            isNegative && "border-[#EB5757]/30 bg-[#EB5757]/10 text-[#EB5757]",
            !isPositive && !isNegative && "border-[#3A3D45] bg-[#1A1B1E] text-[#8A8F98]",
          )}
        >
          {isPositive ? (
            <ArrowUp className="size-2.5" />
          ) : isNegative ? (
            <ArrowDown className="size-2.5" />
          ) : (
            <Minus className="size-2.5" />
          )}
          {Math.abs(delta).toFixed(1)}
          {deltaUnit}
        </div>
      ) : null}
    </button>
  )
}
