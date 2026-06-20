"use client"

import dynamic from "next/dynamic"

/**
 * Code-split wrapper around the time-slot picker. The picker pulls
 * in icons, fetch logic, and slot rendering that isn't needed for
 * the first paint of the chat widget; deferring it shaves a few KB
 * off the initial bundle and avoids a layout shift by reserving a
 * skeleton block until it loads.
 */
const Inner = dynamic(
  () => import("@/components/embed/time-slot-picker").then((m) => m.TimeSlotPicker),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center gap-2 rounded-lg border border-[#23252A] bg-[#0B0C0E] p-3 text-[10px] text-[#8A8F98]">
        <span className="inline-block size-2.5 animate-pulse rounded-full bg-[#5E6AD2]" />
        Loading availability…
      </div>
    ),
  },
)

export const TimeSlotPicker = Inner

