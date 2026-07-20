"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

export function AdminPageHeader({ title, description, generatedAt, autoRefreshSeconds }: { title: string; description: string; generatedAt?: string; autoRefreshSeconds?: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [auto, setAuto] = useState(Boolean(autoRefreshSeconds))
  useEffect(() => {
    if (!auto || !autoRefreshSeconds) return
    const timer = window.setInterval(() => startTransition(() => router.refresh()), autoRefreshSeconds * 1000)
    return () => window.clearInterval(timer)
  }, [auto, autoRefreshSeconds, router])
  return (
    <header className="border-b border-[#202329] bg-[#090A0C] px-5 py-4 xl:px-7">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-xl font-semibold tracking-tight text-[#F7F8F8]">{title}</h1><p className="mt-1 text-sm text-[#858C96]">{description}</p></div>
        <div className="flex items-center gap-2">
          {generatedAt ? <span className="hidden text-[11px] text-[#666D77] sm:inline">Updated {new Date(generatedAt).toLocaleTimeString()}</span> : null}
          {autoRefreshSeconds ? <button type="button" onClick={() => setAuto((value) => !value)} className="rounded-lg border border-[#282C33] px-3 py-2 text-xs text-[#A1A7AF] hover:text-white">Auto-refresh {auto ? "on" : "off"}</button> : null}
          <button type="button" onClick={() => startTransition(() => router.refresh())} className="inline-flex items-center gap-2 rounded-lg border border-[#282C33] bg-[#121418] px-3 py-2 text-xs font-medium text-[#D5D8DC] hover:border-[#3A3F48] hover:text-white"><RefreshCw className={`size-3.5 ${pending ? "animate-spin" : ""}`} /> Refresh</button>
        </div>
      </div>
    </header>
  )
}

export function AdminPageBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <main className={`mx-auto w-full max-w-[1600px] space-y-6 p-5 xl:p-7 ${className}`}>{children}</main>
}
