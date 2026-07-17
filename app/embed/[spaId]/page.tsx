import { headers } from "next/headers"

import { notFound } from "next/navigation"

import { ChatFrame } from "@/components/embed/chat-frame"
import { EmbedLock } from "@/components/embed/embed-lock"
import { loadKnowledge } from "@/lib/ai/conversation"
import { checkEmbedAccess } from "@/lib/widget/access"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Params = { spaId: string }

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { spaId: routeSpaId } = await params
  const sp = await searchParams
  const parentUrl = typeof sp.parent === "string" ? sp.parent : undefined
  const explicitLang = typeof sp.lang === "string" ? sp.lang : undefined
  const environment = sp.environment === "preview" ? "preview" : "production"

  // When the proxy resolves a custom domain, the right spaId is in
  // x-resolved-spa-id. We always honor it, even if the path includes
  // a different value, because the customer set up the domain to
  // serve their widget.
  const h = await headers()
  const resolvedSpaId = h.get("x-resolved-spa-id")
  const spaId = resolvedSpaId || routeSpaId

  let access: Awaited<ReturnType<typeof checkEmbedAccess>>
  try {
    access = await checkEmbedAccess(spaId)
  } catch (error) {
    console.error("[embed] checkEmbedAccess threw", error)
    access = { ok: false, reason: "not_found" }
  }

  let kb: Awaited<ReturnType<typeof loadKnowledge>> | null = null
  if (access.ok) {
    try {
      kb = await loadKnowledge(access.userId)
    } catch (error) {
      console.error("[embed] loadKnowledge threw", error)
    }
  }

  if (!access.ok) {
    if (access.reason === "not_found") notFound()
    return (
      <EmbedLock
        widget={
          kb?.widget ?? {
            id: "default",
            brandName: "AivaSpa",
            logoInitial: "A",
            bubbleLogoUrl: null,
            primaryColor: "#E2E54B",
            position: "bottom-right",
            welcomeMessage:
              "Hi! Are you looking to book a consultation or ask about a treatment?",
            proactiveEnabled: false,
            proactiveDelaySeconds: 8,
            proactiveMessage: "",
            showBranding: true,
            collectEmail: true,
            collectPhone: true,
            consentText:
              "By chatting, you agree to our privacy policy. We'll only contact you about your inquiry.",
            workingHours: {
              enabled: false,
              tz: "America/Los_Angeles",
              schedule: [],
            },
            extendedKb: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        }
      />
    )
  }

  if (!kb?.widget) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-[#0B0C0E] p-4 text-center text-xs text-[#8A8F98]">
        Chat is temporarily unavailable. Please try again in a moment.
      </div>
    )
  }

  return (
    <ChatFrame
      spaId={spaId}
      initialConfig={kb.widget}
      parentUrl={parentUrl}
      initialLanguage={explicitLang}
      environment={environment}
    />
  )
}
