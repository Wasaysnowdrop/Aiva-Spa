import type { NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== "production"
  return request.headers.get("authorization") === `Bearer ${secret}` || new URL(request.url).searchParams.get("token") === secret
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("cleanup_expired_demo_data", {} as never)
  if (error) {
    console.error("[demo-cleanup] failed", error.message)
    return Response.json({ ok: false, error: "Cleanup failed" }, { status: 500 })
  }
  return Response.json({ ok: true, result: data }, { headers: { "cache-control": "no-store" } })
}

export async function POST(request: NextRequest) {
  return GET(request)
}

