"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[admin] route error", error) }, [error])
  return <div className="flex min-h-[70vh] items-center justify-center p-6"><div className="w-full max-w-md rounded-xl border border-[#653236] bg-[#140E10] p-6 text-center"><AlertTriangle className="mx-auto size-7 text-[#EF777C]" /><h1 className="mt-4 text-lg font-semibold">This admin section is unavailable</h1><p className="mt-2 text-sm text-[#8C949E]">Other control-centre sections remain safe and usable. Retry this section or open diagnostics.</p><p className="mt-3 text-[10px] text-[#5F6771]">Reference: {error.digest ?? "admin-section"}</p><div className="mt-5 flex justify-center gap-2"><button onClick={reset} className="rounded-lg bg-[#E3E545] px-3 py-2 text-xs font-semibold text-[#090A0C]">Retry</button><a href="/admin/database" className="rounded-lg border border-[#30353D] px-3 py-2 text-xs text-[#CDD1D6]">View diagnostics</a></div></div></div>
}
