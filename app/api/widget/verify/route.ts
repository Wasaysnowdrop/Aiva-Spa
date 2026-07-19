import { z } from "zod"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getOwnedWidgetInstall, saveWidgetVerification } from "@/lib/widget/installation-checks.server"
import { verifyWidgetInstallation } from "@/lib/widget/verify-installation"
import { roleCan } from "@/lib/team/permissions"
import type { TeamRole } from "@/lib/supabase/types"
import { consumePublicRateLimit } from "@/lib/security/public-rate-limit"
import { LIMITS } from "@/lib/security/limits"
import { tooManyRequests } from "@/lib/security/limiter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  spaId: z.string().trim().min(1).max(200),
  url: z.string().trim().min(1).max(2000),
})

function actorName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : ""
  return fullName || user.email?.split("@")[0] || "Team member"
}

async function canManageWidget(userId: string, businessId: string) {
  if (userId === businessId) return true
  const admin = createAdminClient()
  const { data } = await admin.from("team_members").select("role, status").eq("business_id", businessId).eq("member_user_id", userId).eq("status", "active").maybeSingle()
  if (!data) return false
  return roleCan((data as { role: TeamRole }).role, "widget:manage")
}

export async function POST(request: Request) {
  const rateLimit = consumePublicRateLimit(request, LIMITS.widgetVerify)
  if (rateLimit.limited) return tooManyRequests(rateLimit)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ success: false, status: "invalid", message: "Please sign in to check your website." }, { status: 401 })

  let input: z.infer<typeof bodySchema>
  try {
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) return Response.json({ success: false, status: "invalid", message: "Enter a valid website address." }, { status: 400 })
    input = parsed.data
  } catch {
    return Response.json({ success: false, status: "invalid", message: "Enter a valid website address." }, { status: 400 })
  }

  const install = await getOwnedWidgetInstall(input.spaId)
  if (!install || !(await canManageWidget(user.id, install.businessId))) {
    return Response.json({ success: false, status: "invalid", message: "This widget does not belong to your workspace." }, { status: 403 })
  }
  if (!install.active) return Response.json({ success: false, status: "incomplete", message: "This widget install is paused. Activate it before checking the website." }, { status: 409 })

  const result = await verifyWidgetInstallation({ url: input.url, widgetId: input.spaId })
  try {
    await saveWidgetVerification({ businessId: install.businessId, actorUserId: user.id, actorName: actorName(user), widgetId: input.spaId, result })
  } catch (error) {
    console.error("WIDGET_CHECK_PERSIST_FAILED", { status: result.status, error: error instanceof Error ? error.message : String(error) })
    return Response.json({ ...result, success: false, status: "incomplete", message: "The website was checked, but we couldn't save the result. Please try again." }, { status: 500 })
  }
  return Response.json(result, { headers: { "cache-control": "no-store" } })
}