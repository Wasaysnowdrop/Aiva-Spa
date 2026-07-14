import { redirect } from "next/navigation"
import type { Metadata } from "next"

import { SetupAssistantExperience } from "@/components/onboarding/setup-assistant-experience"
import { createClient } from "@/lib/supabase/server"
import {
  emptyKnowledgeBase,
  getCompletedOnboardingFields,
  getNextIncompleteOnboardingField,
  isOnboardingFieldComplete,
  knowledgeBaseSchema,
  SETUP_ASSISTANT_SECTIONS,
  syncOnboardingProgress,
  type KnowledgeBase,
  type SetupAssistantSection,
} from "@/lib/ai/setup-assistant-schema"
import { buildSetupAssistantResumeMessage } from "@/lib/ai/setup-assistant-prompt"

export const metadata: Metadata = {
  title: "Setup Assistant — launch your AI receptionist | AivaSpa",
  description:
    "A 9-section guided interview that builds your med spa's approved knowledge base for AivaSpa's AI receptionist.",
}

function isSection(value: string | undefined | null): value is SetupAssistantSection {
  return Boolean(value) && (SETUP_ASSISTANT_SECTIONS as readonly string[]).includes(value as string)
}

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirectTo=/onboarding")
  }

  if (user.user_metadata?.onboarding_completed === true) {
    redirect("/dashboard")
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const storedDraft = meta.onboarding_kb_draft
  let initialDraft: KnowledgeBase = emptyKnowledgeBase()
  if (storedDraft && typeof storedDraft === "object") {
    const parsed = knowledgeBaseSchema.partial().safeParse(storedDraft)
    if (parsed.success) {
      initialDraft = { ...emptyKnowledgeBase(), ...(parsed.data as Partial<KnowledgeBase>) }
    }
  }

  initialDraft = syncOnboardingProgress(initialDraft)
  const sectionHint =
    typeof meta.onboarding_setup_section === "string" ? meta.onboarding_setup_section : null
  const savedSection: SetupAssistantSection = isSection(sectionHint)
    ? sectionHint
    : "business"
  const savedSectionComplete = isOnboardingFieldComplete(initialDraft, savedSection)
  const initialSection = savedSectionComplete
    ? getNextIncompleteOnboardingField(initialDraft, savedSection)
    : savedSection
  const initialSavedAt =
    typeof meta.onboarding_setup_updated_at === "string"
      ? meta.onboarding_setup_updated_at
      : null

  console.info("setup-assistant: question-selection", {
    currentOnboardingStep: savedSection,
    completedFields: getCompletedOnboardingFields(initialDraft),
    nextFieldSelected: initialSection,
    reason: savedSectionComplete
      ? "saved_field_already_completed_on_restore"
      : "saved_field_is_incomplete_on_restore",
  })

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    ""
  const spaName = (user.user_metadata?.spa_name as string | undefined) ?? ""

  const firstName = fullName.split(" ")[0] || ""
  const greetingMessage = buildSetupAssistantResumeMessage(initialSection, firstName)

  const welcomeAt = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  const initialHistory = [
    {
      id: "m_welcome_resume",
      role: "assistant" as const,
      content: greetingMessage,
      at: welcomeAt,
    },
  ]

  return (
    <SetupAssistantExperience
      user={{
        id: user.id,
        email: user.email ?? "",
        fullName,
        spaName,
      }}
      initialDraft={initialDraft}
      initialSection={initialSection}
      initialHistory={initialHistory}
      initialSavedAt={initialSavedAt}
    />
  )
}
