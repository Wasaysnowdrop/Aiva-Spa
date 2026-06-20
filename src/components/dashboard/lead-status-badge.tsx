import * as React from "react";

import { Badge } from "@/components/ui/badge";
import type { LeadStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const styles: Record<LeadStatus, { label: string; className: string; dot: string }> = {
  new: {
    label: "New",
    className: "border-[#E2E54B]/40 bg-[#E2E54B]/10 text-[#E2E54B]",
    dot: "bg-[#E2E54B]",
  },
  contacted: {
    label: "Contacted",
    className: "border-[#5E6AD2]/40 bg-[#5E6AD2]/10 text-[#8B95E0]",
    dot: "bg-[#5E6AD2]",
  },
  booked: {
    label: "Booked",
    className: "border-[#4CB782]/40 bg-[#4CB782]/10 text-[#4CB782]",
    dot: "bg-[#4CB782]",
  },
  lost: {
    label: "Lost",
    className: "border-[#EB5757]/40 bg-[#EB5757]/10 text-[#EB5757]",
    dot: "bg-[#EB5757]",
  },
};

export function LeadStatusBadge({
  status,
  className,
}: {
  status: LeadStatus;
  className?: string;
}) {
  const s = styles[status];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 border font-medium", s.className, className)}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </Badge>
  );
}
