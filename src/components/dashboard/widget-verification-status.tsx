import Link from "next/link"
import { AlertTriangle, CheckCircle2, CircleHelp } from "lucide-react"

import type { StoredWidgetInstallCheck } from "@/lib/widget/installation-checks.server"

export function WidgetVerificationStatus({ check }: { check: StoredWidgetInstallCheck | null }) {
  const installed = check?.status === "installed"
  const warning = check?.status === "not_found" || check?.status === "mismatch" || check?.status === "incomplete"
  const Icon = installed ? CheckCircle2 : warning ? CircleHelp : AlertTriangle
  return (
    <div className="mb-6 flex min-w-0 flex-col gap-3 rounded-2xl border border-[#23252A] bg-[#121316] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <Icon className={installed ? "mt-0.5 size-5 shrink-0 text-[#4CB782]" : warning ? "mt-0.5 size-5 shrink-0 text-[#E2E54B]" : "mt-0.5 size-5 shrink-0 text-[#62666D]"} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#F7F8F8]">{installed ? "Widget installation verified" : check ? "Widget verification needs attention" : "Widget installation not checked yet"}</p>
          <p className="mt-1 break-words text-xs text-[#8A8F98]">{check ? `${check.checkedUrl} · ${new Date(check.checkedAt).toLocaleString()}` : "Run a secure website check from the Install Guide after publishing your snippet."}</p>
        </div>
      </div>
      <Link href="/dashboard/guide" className="shrink-0 text-xs font-semibold text-[#E2E54B] hover:underline">{check ? "Check again" : "Open Install Guide"}</Link>
    </div>
  )
}
