import Link from "next/link"
import { LockKeyhole } from "lucide-react"

import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import type { PlanId } from "@/lib/subscription/plans"

export function FeatureLocked({
  title,
  description,
  requiredPlan,
}: {
  title: string
  description: string
  requiredPlan: PlanId
}) {
  const planName = requiredPlan[0].toUpperCase() + requiredPlan.slice(1)
  return (
    <>
      <DashboardHeader />
      <div className="mx-auto flex min-h-[65vh] w-full max-w-3xl items-center px-5 py-12">
        <div className="w-full rounded-2xl border border-[#23252A] bg-[#121316] p-8 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl border border-[#E2E54B]/25 bg-[#E2E54B]/10 text-[#E2E54B]">
            <LockKeyhole className="size-5" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold text-[#F7F8F8]">{title}</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#8A8F98]">{description}</p>
          <Link
            href="/pricing"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-[#E2E54B] px-5 text-sm font-semibold text-[#0B0C0E] transition hover:bg-[#F0F268]"
          >
            View {planName} plan
          </Link>
        </div>
      </div>
    </>
  )
}
