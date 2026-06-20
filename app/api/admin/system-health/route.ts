import { NextResponse } from "next/server"

import { requireAdminApi } from "@/lib/admin/auth"
import { getSystemHealth } from "@/lib/admin/queries"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAdminApi()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const health = await getSystemHealth()
  return NextResponse.json(health, {
    headers: {
      "cache-control": "no-store",
    },
  })
}
