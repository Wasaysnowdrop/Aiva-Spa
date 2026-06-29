import { redirect } from "next/navigation"
import type { Metadata } from "next"

import { SetupAssistantExperience } from "@/components/onboarding/setup-assistant-experience"
import { createClient } from "@/lib/supabase/server"
import {
  emptyKnowledgeBase,
  knowledgeBaseSchema,
  type KnowledgeBase,
  type SetupAssistantSection,
} from "@/lib/ai/setup-assistant-schema"
import { SETUP_ASSISTANT_SECTIONS } from "@/lib/ai/setup-assistant-schema"

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

  const sectionHint =
    typeof meta.onboarding_setup_section === "string" ? meta.onboarding_setup_section : null
  const initialSection: SetupAssistantSection = isSection(sectionHint)
    ? sectionHint
    : "business"

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    ""
  const spaName = (user.user_metadata?.spa_name as string | undefined) ?? ""

  const firstName = fullName.split(" ")[0] || ""
  const hasDraft = initialDraft && Object.keys(initialDraft).length > 1
  const greetingMessage = hasDraft
    ? `Welcome back${firstName ? `, ${firstName}` : ""}. Let's finish your spa setup. To start, tell me your business name, website, and location. I'll save everything automatically.`
    : `Welcome${firstName ? `, ${firstName}` : ""}. Let's set up your spa. To start, tell me your business name, website, and location. I'll save everything automatically.`

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
        email: user.email ?? "",
        fullName,
        spaName,
      }}
      initialDraft={initialDraft}
      initialSection={initialSection}
      initialHistory={initialHistory}
    />
  )
}
