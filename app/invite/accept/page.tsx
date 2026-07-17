import type { Metadata } from "next"
import Link from "next/link"
import { Clock3, Mail, ShieldCheck, Users } from "lucide-react"

import { AcceptInvitationButton } from "@/app/invite/accept/accept-invitation-button"
import { createClient } from "@/lib/supabase/server"
import { getTeamInvitationPreview } from "@/lib/team/server"

export const metadata: Metadata = { title: "Accept team invitation | AivaSpa" }

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? ""
  const preview = await getTeamInvitationPreview(token)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const redirectTo = "/invite/accept?token=" + encodeURIComponent(token)

  if (preview.state !== "valid" || !preview.invitation) {
    const message = preview.state === "expired"
      ? "This invitation has expired. Ask the owner to send a new one."
      : preview.state === "revoked"
        ? "This invitation has been revoked. Ask the workspace owner for a new invitation."
        : preview.state === "accepted"
          ? "This invitation has already been accepted."
          : "This invitation link is invalid."
    return <InviteShell><StateMessage title="Invitation unavailable" message={message} /></InviteShell>
  }

  const invite = preview.invitation
  const userEmail = user?.email?.trim().toLowerCase()
  const emailMatches = userEmail === invite.email.trim().toLowerCase()

  return (
    <InviteShell>
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-[#E2E54B]/30 bg-[#E2E54B]/10"><Users className="size-5 text-[#E2E54B]" /></div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95E0]">Team invitation</p>
        <h1 className="mt-2 text-2xl font-bold text-[#F7F8F8]">Join {invite.businessName}</h1>
        <p className="mt-3 text-sm leading-6 text-[#8A8F98]">You have been invited to AivaSpa as <strong className="text-[#F7F8F8]">{invite.role}</strong>.</p>
      </div>
      <div className="my-6 space-y-3 rounded-xl border border-[#23252A] bg-[#0B0C0E] p-4 text-sm">
        <div className="flex items-center gap-3 text-[#B5B8BE]"><Mail className="size-4 text-[#8B95E0]" /><span>{invite.email}</span></div>
        <div className="flex items-center gap-3 text-[#B5B8BE]"><Clock3 className="size-4 text-[#8B95E0]" /><span>Expires {new Date(invite.expiresAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</span></div>
        <div className="flex items-center gap-3 text-[#B5B8BE]"><ShieldCheck className="size-4 text-[#4CB782]" /><span>Your account email must match the invitation.</span></div>
      </div>
      {!user ? (
        <div className="space-y-3">
          <Link className="flex h-11 items-center justify-center rounded-lg bg-[#E2E54B] text-sm font-semibold text-[#08090A]" href={"/login?redirectTo=" + encodeURIComponent(redirectTo)}>Sign in to accept</Link>
          <Link className="flex h-11 items-center justify-center rounded-lg border border-[#23252A] text-sm font-semibold text-[#F7F8F8]" href={"/signup?redirectTo=" + encodeURIComponent(redirectTo) + "&email=" + encodeURIComponent(invite.email)}>Create an account</Link>
        </div>
      ) : !emailMatches ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-[#EB5757]/30 bg-[#EB5757]/10 px-3 py-3 text-sm leading-6 text-[#EB5757]">This invitation was sent to {invite.email}. Sign in with that email to continue.</div>
          <Link className="flex h-10 items-center justify-center rounded-lg border border-[#23252A] text-sm font-semibold text-[#F7F8F8]" href={"/login?redirectTo=" + encodeURIComponent(redirectTo)}>Use a different account</Link>
        </div>
      ) : <AcceptInvitationButton token={token} />}
      <p className="mt-5 text-center text-xs leading-5 text-[#62666D]">If you were not expecting this invitation, you can safely close this page.</p>
    </InviteShell>
  )
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#08090A] px-4 py-12"><section className="w-full max-w-md rounded-2xl border border-[#23252A] bg-[#121316] p-6 shadow-2xl"><Link href="/" className="mb-7 block text-center text-lg font-bold text-[#F7F8F8]"><span className="text-[#E2E54B]">A</span> AivaSpa</Link>{children}</section></main>
}

function StateMessage({ title, message }: { title: string; message: string }) {
  return <div className="py-6 text-center"><ShieldCheck className="mx-auto size-8 text-[#62666D]" /><h1 className="mt-4 text-xl font-bold text-[#F7F8F8]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#8A8F98]">{message}</p><Link href="/" className="mt-6 inline-flex text-sm font-semibold text-[#E2E54B]">Go to AivaSpa</Link></div>
}

