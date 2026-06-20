"use client"

import { cn } from "@/lib/utils"

export type StatusPillProps = {
  status: "ok" | "warn" | "error" | "info" | "muted"
  label: string
  className?: string
}

const styles: Record<StatusPillProps["status"], string> = {
  ok: "border-[#4CB782]/30 bg-[#4CB782]/10 text-[#4CB782]",
  warn: "border-[#F2C94C]/30 bg-[#F2C94C]/10 text-[#F2C94C]",
  error: "border-[#EB5757]/30 bg-[#EB5757]/10 text-[#EB5757]",
  info: "border-[#5E6AD2]/30 bg-[#5E6AD2]/10 text-[#5E6AD2]",
  muted: "border-[#3A3D45] bg-[#1A1B1E] text-[#8A8F98]",
}

export function StatusPill({ status, label, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        styles[status],
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "ok" && "bg-[#4CB782]",
          status === "warn" && "bg-[#F2C94C]",
          status === "error" && "bg-[#EB5757]",
          status === "info" && "bg-[#5E6AD2]",
          status === "muted" && "bg-[#62666D]",
        )}
      />
      {label}
    </span>
  )
}
