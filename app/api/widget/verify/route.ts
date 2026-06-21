import { headers } from "next/headers"

import { checkEmbedAccess } from "@/lib/widget/access"
import { buildCorsHeaders } from "@/lib/security/cors"
import { consumePublicRateLimit } from "@/lib/security/public-rate-limit"
import { LIMITS } from "@/lib/security/limits"
import { tooManyRequests } from "@/lib/security/limiter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cors(request: Request) {
  return buildCorsHeaders(request)
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) })
}

function normalizeUrl(input: string) {
  let v = input.trim()
  if (!v) return null
  if (!/^https?:\/\//i.test(v)) v = "https://" + v
  try {
    const u = new URL(v)
    if (!u.hostname.includes(".")) return null
    return u.toString()
  } catch {
    return null
  }
}

function isPrivateHost(hostname: string) {
  const h = hostname.toLowerCase()
  if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") return true
  if (h === "::1" || h === "::" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true
  if (/^10\./.test(h)) return true
  if (/^192\.168\./.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true
  if (/^169\.254\./.test(h)) return true
  if (h.endsWith(".local") || h.endsWith(".internal")) return true
  return false
}

export async function GET(request: Request) {
  const rl = consumePublicRateLimit(request, LIMITS.widgetVerify)
  if (rl.limited) return tooManyRequests(rl, cors(request))

  const url = new URL(request.url)
  const targetRaw = url.searchParams.get("url") ?? ""
  const spaId = url.searchParams.get("spaId") ?? ""

  const target = normalizeUrl(targetRaw)
  if (!target) {
    return Response.json(
      {
        ok: false,
        reason: "invalid_url",
        message: "That doesn't look like a valid website address.",
      },
      { status: 400, headers: cors(request) },
    )
  }

  const targetUrl = new URL(target)
  if (isPrivateHost(targetUrl.hostname)) {
    return Response.json(
      {
        ok: false,
        reason: "private_host",
        message: "We can only check public websites — not localhost or private networks.",
      },
      { status: 400, headers: cors(request) },
    )
  }

  if (spaId) {
    const access = await checkEmbedAccess(spaId)
    if (!access.ok) {
      return Response.json(
        {
          ok: false,
          reason: "install_locked",
          message: "This install is paused or expired on your account.",
        },
        { status: 200, headers: cors(request) },
      )
    }
  }

  const reqHeaders = await headers()
  const proto = reqHeaders.get("x-forwarded-proto") ?? "https"
  const host = reqHeaders.get("x-forwarded-host") ?? reqHeaders.get("host") ?? ""
  const origin = host ? `${proto}://${host}` : ""
  const fetchHeaders: Record<string, string> = {
    "user-agent":
      "AivaSpa-InstallVerifier/1.0 (+https://aivaspa.com) Mozilla/5.0 compatible",
    accept: "text/html,application/xhtml+xml",
  }
  if (origin) fetchHeaders["referer"] = origin

  let html = ""
  let fetchError: string | null = null
  let status = 0
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(target, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: fetchHeaders,
    })
    status = res.status
    const ct = res.headers.get("content-type") ?? ""
    if (ct.includes("text/html") || ct.includes("application/xhtml")) {
      html = (await res.text()).slice(0, 600_000)
    } else {
      fetchError = "We reached the site, but it didn't return HTML."
    }
    clearTimeout(timeout)
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Could not reach the website."
  }

  if (fetchError) {
    return Response.json(
      {
        ok: false,
        reason: "fetch_failed",
        message: fetchError,
        url: target,
        checkedAt: new Date().toISOString(),
      },
      { status: 200, headers: cors(request) },
    )
  }

  const lowered = html.toLowerCase()
  const hasSpaIdAttr = spaId ? lowered.includes(spaId.toLowerCase()) : false
  const hasLoaderPath = spaId
    ? lowered.includes(`/embed/${spaId.toLowerCase()}/loader`)
    : false
  const hasAnyAiva = lowered.includes("aivaspa") || lowered.includes("/embed/")
  const installed = Boolean(hasSpaIdAttr || hasLoaderPath || (spaId && hasAnyAiva && hasSpaIdAttr))

  return Response.json(
    {
      ok: true,
      url: target,
      checkedAt: new Date().toISOString(),
      status,
      installed,
      checks: {
        spaIdFound: hasSpaIdAttr,
        loaderPathFound: hasLoaderPath,
        aivaMentioned: hasAnyAiva,
      },
      message: installed
        ? "Looks like the widget is already installed. Open your site in a private window to see the chat bubble."
        : "We didn't find the widget on this page. Follow the steps below to add it.",
    },
    { headers: { ...cors(request), "cache-control": "no-store" } },
  )
}
