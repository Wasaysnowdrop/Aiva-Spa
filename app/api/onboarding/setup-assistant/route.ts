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
  getCompletedOnboardingFields,
  getNextIncompleteOnboardingField,
  isOnboardingFieldComplete,
  knowledgeBaseSchema,
  mergeOnboardingDrafts,
  SETUP_ASSISTANT_SECTIONS,
  syncOnboardingProgress,
  type KnowledgeBase,
  type SetupAssistantSection,
} from "@/lib/ai/setup-assistant-schema"
import { buildSetupAssistantSectionQuestion } from "@/lib/ai/setup-assistant-prompt"
import { logServicesDevelopment, validateServicesInput } from "@/lib/ai/services-input"
import { faqInputHash, logFaqDevelopment, validateFaqInput } from "@/lib/ai/faq-input"
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
  explicitEdit: z.boolean().optional().default(false),
  operation: z.enum(["turn", "persist", "reset"]).optional().default("turn"),
  submissionId: z.string().min(8).max(160).optional(),
  messageId: z.string().min(3).max(160).optional(),
})

function cors(request: Request) {
  return buildCorsHeaders(request)
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) })
}
async function persistOnboardingDraft(
  userId: string,
  userMetadata: Record<string, unknown>,
  draft: KnowledgeBase,
  section: SetupAssistantSection,
  submissionId?: string,
): Promise<string> {
  const savedAt = new Date().toISOString()
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...userMetadata,
      onboarding_kb_draft: draft,
      onboarding_setup_section: section,
      onboarding_completed_fields: getCompletedOnboardingFields(draft),
      onboarding_setup_updated_at: savedAt,
      ...(submissionId ? { onboarding_last_submission_id: submissionId } : {}),
    },
  })
  if (error) throw error
  return savedAt
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
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const storedResult = knowledgeBaseSchema.partial().safeParse(meta.onboarding_kb_draft)
  const incomingResult = knowledgeBaseSchema.partial().safeParse(body.draft)
  const storedDraft = storedResult.success
    ? makeInitialDraft(storedResult.data as Partial<KnowledgeBase>)
    : emptyKnowledgeBase()
  const incomingDraft = incomingResult.success
    ? makeInitialDraft(incomingResult.data as Partial<KnowledgeBase>)
    : emptyKnowledgeBase()
  let draft =
    body.operation === "reset"
      ? emptyKnowledgeBase()
      : mergeOnboardingDrafts(storedDraft, incomingDraft)
  draft = syncOnboardingProgress(draft)

  const section: SetupAssistantSection = body.currentSection
  if (
    body.operation === "turn" &&
    body.submissionId &&
    meta.onboarding_last_submission_id === body.submissionId
  ) {
    const stepCompleted = isOnboardingFieldComplete(draft, section)
    if ((section === "services" || section === "faqs") && !stepCompleted) {
      const attempts = draft.status.invalidAttempts[section] ?? 0
      const message = section === "services"
        ? attempts >= 3
          ? "Please enter service names, such as Botox, Dermal Fillers, HydraFacial, or Laser Hair Removal."
          : "Please enter at least one service your business offers."
        : attempts >= 3
          ? "Please provide one visitor question and its approved answer. Example: Question: Do you offer consultations? Answer: Yes, contact our team to schedule."
          : "Please provide one visitor question and its approved answer."
      return Response.json(
        {
          success: false,
          duplicate: true,
          errorType: "VALIDATION_ERROR",
          message,
          reply: message,
          stepCompleted: false,
          nextStep: section,
          section,
          nextSection: null,
          action: "ask",
          concerns: [],
          draft,
          pendingFields: draft.status.pendingFields,
          completedFields: getCompletedOnboardingFields(draft),
          selectionReason: "duplicate_invalid_submission_ignored",
          invalidAttemptCount: attempts,
        },
        { status: 422, headers: cors(request) },
      )
    }

    const nextSection = stepCompleted
      ? getNextIncompleteOnboardingField(draft, section)
      : section
    return Response.json(
      {
        success: true,
        duplicate: true,
        stepCompleted,
        nextStep: nextSection,
        reply: `Saved. ${buildSetupAssistantSectionQuestion(nextSection)}`,
        section,
        nextSection,
        action: stepCompleted ? "advance" : "ask",
        concerns: [],
        draft,
        pendingFields: draft.status.pendingFields,
        completedFields: getCompletedOnboardingFields(draft),
        selectionReason: "duplicate_submission_ignored",
        services: section === "services" ? draft.services : undefined,
        faqs: section === "faqs" ? draft.faqs : undefined,
      },
      { headers: cors(request) },
    )
  }

  if (body.operation !== "turn") {
    const selectedSection =
      body.operation === "reset"
        ? "business"
        : isOnboardingFieldComplete(draft, section)
          ? getNextIncompleteOnboardingField(draft, section)
          : section
    const selectionReason =
      body.operation === "reset"
        ? "onboarding_progress_explicitly_reset"
        : "progress_persisted_without_asking_question"

    try {
      const savedAt = await persistOnboardingDraft(user.id, meta, draft, selectedSection, body.submissionId)
      console.info("setup-assistant: question-selection", {
        currentOnboardingStep: section,
        completedFields: getCompletedOnboardingFields(draft),
        nextFieldSelected: selectedSection,
        reason: selectionReason,
      })
      return Response.json(
        {
          ok: true,
          draft,
          section: selectedSection,
          nextSection: selectedSection,
          completedFields: getCompletedOnboardingFields(draft),
          selectionReason,
          savedAt,
        },
        { headers: cors(request) },
      )
    } catch (error) {
      console.error("setup-assistant: failed to persist draft", error)
      return Response.json(
        { error: "Progress could not be saved. Your local copy is still available." },
        { status: 500, headers: cors(request) },
      )
    }
  }
  const ownerName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    ""
  const spaNameHint = (user.user_metadata?.spa_name as string | undefined) ?? ""

  let servicesSaveStarted = false
  let faqSaveStarted = false
  try {
    const result = await runSetupAssistantTurn({
      history: body.history,
      userMessage: body.userMessage,
      currentSection: section,
      draft,
      ownerName,
      spaName: spaNameHint,
      explicitEdit: body.explicitEdit,
      submissionId: body.submissionId,
      messageId: body.messageId,
    })
    if (section === "services") logServicesDevelopment("SERVICES_SAVE_STARTED", {
      userId: user.id,
      submissionId: body.submissionId ?? null,
      currentOnboardingStep: section,
      serviceCount: result.draft.services.length,
    })
    servicesSaveStarted = section === "services"
    if (section === "faqs") logFaqDevelopment("FAQ_SAVE_STARTED", {
      userId: user.id,
      submissionId: body.submissionId ?? null,
      messageId: body.messageId ?? null,
      complianceInputHash: faqInputHash(body.userMessage),
      currentOnboardingStep: section,
      faqCount: result.draft.faqs.length,
    })
    faqSaveStarted = section === "faqs"

    const savedAt = await persistOnboardingDraft(
      user.id,
      meta,
      result.draft,
      result.nextSection ?? result.section,
      body.submissionId,
    )
    if (section === "services") logServicesDevelopment("SERVICES_SAVE_SUCCESS", {
      userId: user.id,
      nextOnboardingStep: result.nextSection,
      serviceCount: result.draft.services.length,
    })
    if (section === "faqs") logFaqDevelopment("FAQ_SAVE_SUCCESS", {
      userId: user.id,
      submissionId: body.submissionId ?? null,
      messageId: body.messageId ?? null,
      complianceInputHash: faqInputHash(body.userMessage),
      nextOnboardingStep: result.nextSection,
      faqCount: result.draft.faqs.length,
    })

    void recordAuditForUser(user, `onboarding.setup_assistant_turn ${result.section} → ${result.action}`)

    const validationFailed = result.selectionReason === "services_validation_failed"
      || result.selectionReason === "faqs_validation_failed"
      || result.selectionReason === "faqs_parsing_failed"
    if (validationFailed) {
      const errorType = result.selectionReason === "faqs_parsing_failed"
        ? "PARSING_ERROR"
        : "VALIDATION_ERROR"
      return Response.json(
        {
          success: false,
          errorType,
          message: result.reply,
          reply: result.reply,
          stepCompleted: false,
          nextStep: section,
          section,
          nextSection: null,
          action: "ask",
          concerns: [],
          draft: result.draft,
          pendingFields: result.pendingFields,
          completedFields: result.completedFields,
          selectionReason: result.selectionReason,
          invalidAttemptCount: result.draft.status.invalidAttempts[section] ?? 0,
          savedAt,
        },
        { status: 422, headers: cors(request) },
      )
    }

    return Response.json(
      {
        reply: result.reply,
        success: true,
        stepCompleted: result.action === "advance" || result.action === "finish",
        nextStep: result.nextSection,
        services: result.section === "services" ? result.draft.services : undefined,
        faqs: result.section === "faqs" ? result.draft.faqs : undefined,
        section: result.section,
        nextSection: result.nextSection,
        action: result.action,
        concerns: result.concerns,
        draft: result.draft,
        pendingFields: result.pendingFields,
        completedFields: result.completedFields,
        selectionReason: result.selectionReason,
        savedAt,
        durationMs: result.durationMs,
        provider: result.provider,
        model: result.model,
      },
      { headers: cors(request) },
    )
  } catch (err) {
    console.error("setup-assistant error", err)
    const validServicesSaveFailed =
      servicesSaveStarted && validateServicesInput(body.userMessage).valid
    if (validServicesSaveFailed) {
      const dbError = err as { message?: string; code?: string; details?: string; hint?: string }
      console.error("SERVICES_SAVE_FAILED", {
        message: dbError?.message ?? "Unknown save error",
        code: dbError?.code ?? null,
        details: dbError?.details ?? null,
        hint: dbError?.hint ?? null,
        userId: user.id,
        submissionId: body.submissionId ?? null,
      })
      return Response.json(
        {
          success: false,
          errorType: "SAVE_ERROR",
          message: "Your services are valid, but we couldn't save them. Please try again.",
        },
        { status: 500, headers: cors(request) },
      )
    }
    const validFaqSaveFailed = faqSaveStarted && validateFaqInput(body.userMessage).valid
    if (validFaqSaveFailed) {
      const dbError = err as { message?: string; code?: string; details?: string; hint?: string }
      console.error("FAQ_SAVE_FAILED", {
        message: dbError?.message ?? "Unknown save error",
        code: dbError?.code ?? null,
        details: dbError?.details ?? null,
        hint: dbError?.hint ?? null,
        userId: user.id,
        submissionId: body.submissionId ?? null,
        messageId: body.messageId ?? null,
        complianceInputHash: faqInputHash(body.userMessage),
      })
      return Response.json(
        {
          success: false,
          errorType: "SAVE_ERROR",
          message: "Your FAQ is valid, but we couldn't save it. Please try again.",
        },
        { status: 500, headers: cors(request) },
      )
    }
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
