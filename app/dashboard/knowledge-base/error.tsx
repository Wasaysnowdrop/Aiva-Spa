"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, Home, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function KnowledgeBaseError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  React.useEffect(() => {
    console.error("KNOWLEDGE_BASE_PAGE_RENDER_FAILED", {
      route: "/dashboard/knowledge-base",
      digest: error.digest ?? null,
      errorName: error.name,
    })
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-[#EB5757]/30 bg-[#121316] p-6 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl border border-[#EB5757]/30 bg-[#EB5757]/10 text-[#EB5757]">
          <AlertTriangle className="size-5" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#EB5757]">
          Knowledge base unavailable
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#F7F8F8]">
          We couldn&apos;t load this page
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#8A8F98]">
          Your published content is safe. Retry the page, or return to the dashboard while the issue is investigated.
        </p>
        {error.digest ? (
          <p className="mt-3 text-[11px] text-[#62666D]">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button
            onClick={() => unstable_retry()}
            className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
          >
            <RotateCw className="size-4" />
            Try again
          </Button>
          <Button asChild variant="outline" className="border-[#2A2D32] bg-transparent text-[#F7F8F8]">
            <Link href="/dashboard">
              <Home className="size-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}