import { headers } from "next/headers"

import { loadKnowledge } from "@/lib/ai/conversation"
import { checkEmbedAccess } from "@/lib/widget/access"
import { buildCorsHeaders } from "@/lib/security/cors"
import { consumePublicRateLimit } from "@/lib/security/public-rate-limit"
import { LIMITS } from "@/lib/security/limits"
import { tooManyRequests } from "@/lib/security/limiter"
import {
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  getDictionary,
} from "@/lib/i18n"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cors(request: Request) {
  return buildCorsHeaders(request)
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) })
}

export async function GET(request: Request) {
  const rl = consumePublicRateLimit(request, LIMITS.widgetConfig)
  if (rl.limited) return tooManyRequests(rl, cors(request))

  const url = new URL(request.url)
  const querySpaId = url.searchParams.get("spaId")

  // Honor the white-label resolution done by proxy.ts. This lets the
  // loader script (running on a customer's custom domain) call
  // /api/widget/config without needing to know its own spaId.
  const h = await headers()
  const resolvedSpaId = h.get("x-resolved-spa-id")
  const spaId = resolvedSpaId || querySpaId

  if (!spaId) {
    return Response.json(
      { locked: true, reason: "missing_spa_id" },
      { status: 400, headers: cors(request) },
    )
  }

  const access = await checkEmbedAccess(spaId)
  if (!access.ok) {
    return Response.json(
      { locked: true, reason: access.reason },
      { status: 200, headers: cors(request) },
    )
  }

  const kb = await loadKnowledge(access.userId)
  const extendedKb = (kb.extendedKb ?? {}) as Record<string, unknown>
  const configuredDefault =
    typeof extendedKb.language === "string" && isSupportedLanguage(extendedKb.language)
      ? (extendedKb.language as (typeof SUPPORTED_LANGUAGES)[number])
      : "en"

  const translations: Record<string, ReturnType<typeof getDictionary>> = {}
  for (const code of SUPPORTED_LANGUAGES) {
    translations[code] = getDictionary(code)
  }

  return Response.json(
    {
      locked: false,
      brandName: kb.widget.brandName,
      logoInitial: kb.widget.logoInitial,
      bubbleLogoUrl: kb.widget.bubbleLogoUrl,
      primaryColor: kb.widget.primaryColor,
      position: kb.widget.position,
      welcomeMessage: kb.widget.welcomeMessage,
      proactiveEnabled: kb.widget.proactiveEnabled,
      proactiveDelaySeconds: kb.widget.proactiveDelaySeconds,
      proactiveMessage: kb.widget.proactiveMessage,
      showBranding: kb.widget.showBranding,
      collectEmail: kb.widget.collectEmail,
      collectPhone: kb.widget.collectPhone,
      consentText: kb.widget.consentText,
      workingHours: kb.widget.workingHours,
      faqCount: kb.faqs.length,
      serviceCount: kb.services.length,
      defaultLanguage: configuredDefault,
      supportedLanguages: [...SUPPORTED_LANGUAGES],
      translations,
    },
    {
      headers: {
        ...cors(request),
        // Public, identical across visitors for a given spa, and
        // changes infrequently (KB edits are rare). 5 minutes on the
        // browser, 10 minutes on the CDN — owner-side changes still
        // land within seconds thanks to the loader's `refresh()` API.
        "cache-control": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
        "x-content-type-options": "nosniff",
      },
    },
  )
}
