import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-5 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-[#23252A] bg-[#121316] text-[#E2E54B]">
        404
      </span>
      <h1 className="text-2xl font-bold text-[#F7F8F8]">Page not found</h1>
      <p className="max-w-md text-sm text-[#8A8F98]">
        We couldn&apos;t find what you were looking for. It may have been moved or never
        existed.
      </p>
      <Button asChild size="sm" className="mt-2 bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
