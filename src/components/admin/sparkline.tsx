"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export function Sparkline({
  data,
  width = 120,
  height = 32,
  stroke = "var(--accent-primary)",
  fill = "rgba(226, 229, 75, 0.12)",
  className,
}: {
  data: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: string
  className?: string
}) {
  if (!data || data.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        className={cn("opacity-30", className)}
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeDasharray="2 4"
        />
      </svg>
    )
  }
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const stepX = data.length > 1 ? width / (data.length - 1) : width
  const points = data.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * (height - 2) - 1
    return [x, y] as const
  })
  const path = points
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(" ")
  const areaPath = `${path} L ${(data.length - 1) * stepX} ${height} L 0 ${height} Z`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
    >
      <path d={areaPath} fill={fill} />
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.length > 0 ? (
        <circle
          cx={points[points.length - 1][0]}
          cy={points[points.length - 1][1]}
          r={2}
          fill={stroke}
        />
      ) : null}
    </svg>
  )
}
