import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { buildCorsHeaders } from "@/lib/security/cors"
import { consume, getRequestIp, tooManyRequests } from "@/lib/security/limiter"
import { LIMITS } from "@/lib/security/limits"

export const runtime = "nodejs"

function cors(request: Request) {
  return buildCorsHeaders(request)
}

export async function POST(request: Request) {
  const rl = consume(LIMITS.adminLogout, { ip: getRequestIp(request) })
  if (rl.limited) return tooManyRequests(rl, cors(request))

  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(
    new URL("/login?redirectTo=/admin", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  )
}
