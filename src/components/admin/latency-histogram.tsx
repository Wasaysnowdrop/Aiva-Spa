"use client"

import { cn } from "@/lib/utils"

export function LatencyHistogram({
  data,
  width = 360,
  height = 96,
  className,
}: {
  data: number[]
  width?: number
  height?: number
  className?: string
}) {
  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex h-24 items-center justify-center rounded-md border border-dashed border-[#23252A] text-[10px] text-[#62666D]",
          className,
        )}
      >
        No LLM activity in the last hour
      </div>
    )
  }
  const max = Math.max(...data, 1)
  const barWidth = data.length > 0 ? width / data.length : 0
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
    >
      {data.map((value, i) => {
        const h = (value / max) * (height - 6)
        return (
          <rect
            key={i}
            x={i * barWidth + 1}
            y={height - h}
            width={Math.max(0, barWidth - 2)}
            height={h}
            rx={2}
            fill="#22D3EE"
            opacity={0.55 + (value / max) * 0.45}
          />
        )
      })}
    </svg>
  )
}
