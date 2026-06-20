import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

import { resolveCustomDomain } from "@/lib/widget/domains"

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/admin"]
const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/check-email",
]

function isAdminHost(host: string | null): boolean {
  if (!host) return false
  const hostname = host.split(":")[0].toLowerCase()
  return hostname.startsWith("admin.")
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host")
  const isAdminSubdomain = isAdminHost(host)

  let response = NextResponse.next({ request })

  // White-label: if the request came in on a known custom domain,
  // resolve the spaId and pass it to the request handlers as a header.
  // The embed page, loader script, and widget config endpoint all
  // read this header so the widget "just works" on the customer's
  // domain with no JS-side routing.
  if (host && !isAdminSubdomain) {
    try {
      const resolved = await resolveCustomDomain(host)
      if (resolved) {
        const requestHeaders = new Headers(request.headers)
        requestHeaders.set("x-resolved-spa-id", resolved.spaId)
        requestHeaders.set("x-resolved-domain", resolved.domain)
        response = NextResponse.next({ request: { headers: requestHeaders } })
      }
    } catch (e) {
      // Resolver failures must not block the response; we just fall
      // through to default routing.
      console.error("custom domain resolution failed", e)
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/login"
    redirectUrl.searchParams.set("redirectTo", `${pathname}${search}`)
    return NextResponse.redirect(redirectUrl)
  }

  if (isAuthRoute && user) {
    const redirectUrl = request.nextUrl.clone()
    // On the admin subdomain, send the user to the admin home rather
    // than the customer dashboard.
    redirectUrl.pathname = isAdminSubdomain ? "/admin" : "/dashboard"
    redirectUrl.search = ""
    return NextResponse.redirect(redirectUrl)
  }

  if (isAdminSubdomain) {
    // On the admin subdomain, transparently rewrite every page request
    // to the internal /admin/* routes. The browser stays on
    // admin.aivaspa.online (so the URL bar shows the subdomain), but
    // the response is rendered from the /admin pages. API and asset
    // paths pass through untouched.
    if (
      !pathname.startsWith("/admin") &&
      !pathname.startsWith("/api/") &&
      !pathname.startsWith("/_next/") &&
      !pathname.includes(".")
    ) {
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`
      return NextResponse.rewrite(rewriteUrl)
    }
    if (user) {
      const isAdmin = Boolean(
        (user.app_metadata as { is_admin?: boolean } | null)?.is_admin,
      )
      if (!isAdmin) {
        // Authenticated but not an admin — 403.
        return new NextResponse("Forbidden — admin access required", {
          status: 403,
          headers: { "content-type": "text/plain; charset=utf-8" },
        })
      }
    }
  } else {
    // On the main domain, hide /admin/* unless the visitor is an admin.
    if (pathname.startsWith("/admin") && user) {
      const isAdmin = Boolean(
        (user.app_metadata as { is_admin?: boolean } | null)?.is_admin,
      )
      if (!isAdmin) {
        return new NextResponse("Not Found", { status: 404 })
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
