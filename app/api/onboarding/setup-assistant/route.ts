import type { NextRequest } from "next/server"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  makeInitialDraft,
  runSetupAssistantTurn,
  SetupAssistantAiError,
} from "@/lib/ai/setup-assistant"
import {
  emptyKnowledgeBase,
  SETUP_ASSISTANT_SECTIONS,
  knowledgeBaseSchema,
  type KnowledgeBase,
  type SetupAssistantSection,
} from "@/lib/ai/setup-assistant-schema"
import { recordAuditForUser } from "@/lib/audit"
import { buildCorsHeaders } from "@/lib/security/cors"
import { consume, getRequestIp, tooManyRequests } from "@/lib/security/limiter"
import { LIMITS } from "@/lib/security/limits"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const historyItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
})

const requestSchema = z.object({
  history: z.array(historyItemSchema).max(80).default([]),
  userMessage: z.string().min(1).max(2000),
  currentSection: z.enum(SETUP_ASSISTANT_SECTIONS),
  draft: z.record(z.string(), z.unknown()).optional(),
  resume: z.boolean().optional().default(false),
})

function cors(request: Request) {
  return buildCorsHeaders(request)
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) })
}

export async function POST(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return Response.json(
      { error: "Body must be valid JSON" },
      { status: 400, headers: cors(request) },
    )
  }

  const parsed = requestSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400, headers: cors(request) },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json(
      { error: "Not authenticated" },
      { status: 401, headers: cors(request) },
    )
  }

  // Per-user limit so a single owner can't blow up the LLM bill.
  const rl = consume(LIMITS.onboardingAssistant, {
    ip: getRequestIp(request),
    identity: user.id,
  })
  if (rl.limited) return tooManyRequests(rl, cors(request))

  const body = parsed.data

  let draft: KnowledgeBase = makeInitialDraft({
    ...(body.draft ?? {}),
    ...(body.resume ? emptyKnowledgeBase() : {}),
  })

  if (body.resume) {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    const stored = meta.onboarding_kb_draft
    if (stored && typeof stored === "object") {
      const merged = knowledgeBaseSchema.partial().safeParse(stored)
      if (merged.success) {
        draft = makeInitialDraft(merged.data as Partial<KnowledgeBase>)
      }
    }
  } else if (body.draft) {
    const result = knowledgeBaseSchema.partial().safeParse(body.draft)
    if (result.success) {
      draft = makeInitialDraft(result.data as Partial<KnowledgeBase>)
    }
  }

  const section: SetupAssistantSection = body.currentSection
  const ownerName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    ""
  const spaNameHint = (user.user_metadata?.spa_name as string | undefined) ?? ""

  try {
    const result = await runSetupAssistantTurn({
      history: body.history,
      userMessage: body.userMessage,
      currentSection: section,
      draft,
      ownerName,
      spaName: spaNameHint,
    })

    try {
      const admin = createAdminClient()
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          onboarding_kb_draft: result.draft,
          onboarding_setup_section: result.nextSection ?? result.section,
        },
      })
    } catch (e) {
      console.warn("setup-assistant: failed to persist draft", e)
    }

    void recordAuditForUser(user, `onboarding.setup_assistant_turn ${result.section} → ${result.action}`)

    return Response.json(
      {
        reply: result.reply,
        section: result.section,
        nextSection: result.nextSection,
        action: result.action,
        concerns: result.concerns,
        draft: result.draft,
        pendingFields: result.pendingFields,
        durationMs: result.durationMs,
        provider: result.provider,
        model: result.model,
      },
      { headers: cors(request) },
    )
  } catch (err) {
    console.error("setup-assistant error", err)
    const aiUnavailable = err instanceof SetupAssistantAiError
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Setup assistant error",
        ...(aiUnavailable ? { code: err.code } : {}),
      },
      { status: aiUnavailable ? 503 : 500, headers: cors(request) },
    )
  }
}
