"use client"

import * as React from "react"

import { useAdminFeed } from "./admin-realtime-provider"
import { cn } from "@/lib/utils"

export function LiveTicker() {
  const { totalCount, lastEventAt, isPaused } = useAdminFeed()
  const [tick, setTick] = React.useState(0)
  const lastEventAtRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (lastEventAt && lastEventAt !== lastEventAtRef.current) {
      lastEventAtRef.current = lastEventAt
      setTick((k) => k + 1)
    }
  }, [lastEventAt, totalCount])

  return (
    <div className="flex items-center gap-2 rounded-full border border-[#23252A] bg-[#0B0C0E] px-3 py-1.5">
      <span className="relative flex size-2">
        <span
          key={tick}
          className={cn(
            "absolute inline-flex size-full rounded-full",
            isPaused ? "bg-[#F2C94C]" : "bg-[#4CB782] opacity-75 animate-ping",
          )}
        />
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            isPaused ? "bg-[#F2C94C]" : "bg-[#4CB782]",
          )}
        />
      </span>
      <span className="font-mono text-[11px] font-semibold tabular-nums text-[#F7F8F8]">
        {totalCount.toString().padStart(4, "0")}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#62666D]">
        events
      </span>
    </div>
  )
}
