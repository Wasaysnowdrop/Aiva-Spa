"use client"

import * as React from "react"
import { AlertTriangle, ArrowLeft, RotateCw } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function LeadsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  React.useEffect(() => {
    console.error("[aivaspa] /dashboard/leads error:", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-[#EB5757]/30 bg-[#121316] p-6 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl border border-[#EB5757]/30 bg-[#EB5757]/10 text-[#EB5757]">
          <AlertTriangle className="size-5" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#EB5757]">
          Error 500
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#F7F8F8]">
          Couldn&apos;t load your leads
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#8A8F98]">
          Something broke while fetching the leads inbox. Your data is safe —
          this is a rendering issue, not a data loss.
        </p>
        {error.digest ? (
          <p className="mt-3 text-[11px] text-[#62666D]">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button
            onClick={() => unstable_retry()}
            className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
          >
            <RotateCw className="size-4" />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Back to overview
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}