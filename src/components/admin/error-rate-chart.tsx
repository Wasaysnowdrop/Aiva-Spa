"use client"

import { cn } from "@/lib/utils"

export function ErrorRateChart({
  data,
  width = 360,
  height = 60,
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
          "flex h-14 items-center justify-center rounded-md border border-dashed border-[#23252A] text-[10px] text-[#62666D]",
          className,
        )}
      >
        No webhook activity in the last hour
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
        const tone = value > 5 ? "#EB5757" : value > 1 ? "#F2C94C" : "#4CB782"
        return (
          <rect
            key={i}
            x={i * barWidth + 1}
            y={height - h}
            width={Math.max(0, barWidth - 2)}
            height={h}
            rx={2}
            fill={tone}
            opacity={0.7}
          />
        )
      })}
    </svg>
  )
}
