"use client";

import { AlertTriangle, ArrowUpRight } from "lucide-react";
import Link from "next/link";

type QuotaBannerProps = {
  planName: string;
  used: number;
  quota: number;
};

export function QuotaBanner({ planName, used, quota }: QuotaBannerProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 pt-4 lg:px-8">
      <div className="flex items-start gap-3 rounded-2xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#F59E0B]" />
        <div className="flex-1">
          <p className="font-semibold text-[#F7F8F8]">
            You&apos;ve hit your {planName} monthly limit ({used.toLocaleString()} /{" "}
            {quota.toLocaleString()} conversations).
          </p>
          <p className="mt-0.5 text-xs leading-5 text-[#C9CCD2]">
            The dashboard stays unlocked until your billing period ends — you can
            still capture and review leads. Upgrade for a higher quota or wait for
            the next cycle to start.
          </p>
        </div>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-[#F59E0B]/20 px-3 py-1.5 text-xs font-semibold text-[#F59E0B] transition hover:bg-[#F59E0B]/30"
        >
          Upgrade
          <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
