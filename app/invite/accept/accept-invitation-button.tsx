"use client"

import * as React from "react"
import { CheckCircle2, Loader2 } from "lucide-react"

import { acceptTeamInvitationAction } from "@/app/actions/team"
import { Button } from "@/components/ui/button"

export function AcceptInvitationButton({ token }: { token: string }) {
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  return (
    <div className="space-y-3">
      {error ? <div className="rounded-lg border border-[#EB5757]/30 bg-[#EB5757]/10 px-3 py-2 text-sm text-[#EB5757]">{error}</div> : null}
      <Button
        className="h-11 w-full bg-[#E2E54B] font-semibold text-[#08090A] hover:bg-[#E2E54B]/90"
        disabled={pending}
        onClick={async () => {
          if (pending) return
          setPending(true)
          setError(null)
          const result = await acceptTeamInvitationAction(token)
          if (result.ok) window.location.assign(result.data.redirectTo)
          else {
            setError(result.error)
            setPending(false)
          }
        }}
      >
        {pending ? <><Loader2 className="size-4 animate-spin" /> Accepting invitation…</> : <><CheckCircle2 className="size-4" /> Accept invitation</>}
      </Button>
    </div>
  )
}

