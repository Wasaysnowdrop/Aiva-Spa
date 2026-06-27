"use client"

import * as React from "react"
import { AlertTriangle, Home, RotateCw } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error("[aivaspa] dashboard error:", error)
  }, [error])

  const errorMessage =
    error.message?.includes("fetch") || error.message?.includes("network") || error.message?.includes("connect")
      ? "We couldn't reach our servers. This is usually a temporary network glitch."
      : error.message?.includes("permission") || error.message?.includes("policy")
        ? "There seems to be a permissions issue. Your session may have expired."
        : "Your account, knowledge base, and leads are safe. This was a rendering hiccup — please try again."

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-[#EB5757]/30 bg-[#121316] p-6 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl border border-[#EB5757]/30 bg-[#EB5757]/10 text-[#EB5757]">
          <AlertTriangle className="size-5" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#EB5757]">
          Dashboard error
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#F7F8F8]">
          Something went wrong loading this page
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#8A8F98]">
          {errorMessage}
        </p>
        {error.digest ? (
          <p className="mt-3 text-[11px] text-[#62666D]">
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button
            onClick={() => reset()}
            className="bg-[#E2E54B] text-[#08090A] hover:bg-[#E2E54B]/90"
          >
            <RotateCw className="size-4" />
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <Home className="size-4" />
              Go home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}