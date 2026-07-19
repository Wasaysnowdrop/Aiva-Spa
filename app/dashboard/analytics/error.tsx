"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error("ANALYTICS_ROUTE_ERROR", {
      component: "AnalyticsError",
      message: error.message,
      digest: error.digest ?? null,
    })
  }, [error])

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-7xl items-center justify-center px-5 py-10 lg:px-8">
      <div className="w-full max-w-lg rounded-2xl border border-[#EB5757]/30 bg-[#121316] p-6 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-xl border border-[#EB5757]/30 bg-[#EB5757]/10 text-[#EB5757]">
          <AlertTriangle className="size-5" />
        </div>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#EB5757]">Analytics error</p>
        <h1 className="mt-2 text-xl font-semibold text-[#F7F8F8]">We couldn’t load analytics right now.</h1>
        <p className="mt-2 text-sm leading-6 text-[#8A8F98]">Try this Analytics route again, or return to the dashboard while the issue is investigated.</p>
        {error.digest ? <p className="mt-3 text-[11px] text-[#62666D]">Reference: {error.digest}</p> : null}
        {process.env.NODE_ENV !== "production" ? (
          <p className="mt-2 break-words font-mono text-[10px] text-[#EB8A8A]">Stage: route_render · Component: AnalyticsError · {error.message}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => reset()}>
            <RotateCw className="size-4" />
            Try again
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/dashboard">Return to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
