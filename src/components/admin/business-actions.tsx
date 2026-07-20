"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { setBusinessPausedAction } from "@/app/actions/admin-control"

export function BusinessActions({ id, paused }: { id: string; paused: boolean }) {
  const router = useRouter(); const [pending, startTransition] = useTransition(); const [reason, setReason] = useState("")
  const submit = () => {
    if (!reason.trim()) return toast.error("Enter a reason first.")
    const nextPaused = !paused
    if (!window.confirm(`${nextPaused ? "Pause" : "Reactivate"} this business? This changes widget access and is audited.`)) return
    startTransition(async () => { const result = await setBusinessPausedAction(id, nextPaused, reason); if (result.ok) { toast.success(result.message); router.refresh() } else toast.error(result.error) })
  }
  return <div className="flex flex-wrap gap-2"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required action reason" className="min-w-64 flex-1 rounded-lg border border-[#2B3038] bg-[#111318] px-3 py-2 text-xs text-white outline-none" /><button disabled={pending} onClick={submit} className={`rounded-lg px-3 py-2 text-xs font-semibold ${paused ? "bg-[#E3E545] text-[#090A0C]" : "border border-[#71363A] text-[#F07A7F]"}`}>{pending ? "Working…" : paused ? "Reactivate business" : "Pause business"}</button></div>
}
