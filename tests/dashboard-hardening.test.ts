import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  classificationIsBillable,
  isBillableConversation,
  isCustomerConversation,
} from "@/lib/conversations/eligibility"
import {
  clearLeadSelection,
  pruneLeadSelection,
  toggleAllLeadSelection,
} from "@/lib/leads/selection"
import type { ChatSession } from "@/lib/supabase/types"

function session(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: "session-row",
    userId: "owner-1",
    sessionId: "visitor-session",
    spaId: "spa-1",
    transcript: [{
      id: "message-1",
      role: "visitor",
      content: "What services do you offer?",
      timestamp: "2026-07-17T00:00:00Z",
    }],
    messageCount: 1,
    lastMessage: "What services do you offer?",
    lastRole: "visitor",
    lastMessageAt: "2026-07-17T00:00:00Z",
    sourceUrl: "https://spa.example",
    afterHours: false,
    visitorName: null,
    leadCaptured: false,
    leadId: null,
    consentGiven: false,
    status: "active",
    metadata: {},
    conversationType: "visitor",
    channel: "website_widget",
    environment: "production",
    isBillable: true,
    deletedAt: null,
    createdAt: "2026-07-17T00:00:00Z",
    updatedAt: "2026-07-17T00:00:00Z",
    ...overrides,
  }
}

describe("conversation eligibility", () => {
  it("shows and bills only a genuine production website visitor chat", () => {
    const visitor = session()
    expect(isCustomerConversation(visitor)).toBe(true)
    expect(isBillableConversation(visitor)).toBe(true)
    expect(classificationIsBillable({
      conversationType: "visitor",
      channel: "website_widget",
      environment: "production",
    })).toBe(true)
  })

  it.each([
    { conversationType: "onboarding" as const },
    { conversationType: "internal" as const },
    { conversationType: "test" as const },
    { channel: "dashboard_internal" as const },
    { environment: "preview" as const },
    { environment: "test" as const },
    { isBillable: false },
    { deletedAt: "2026-07-17T00:00:00Z" },
    { transcript: [] },
  ])("excludes non-customer/non-billable sessions: %o", (override) => {
    const candidate = session(override)
    if (
      candidate.conversationType !== "visitor" ||
      candidate.channel !== "website_widget" ||
      candidate.deletedAt
    ) {
      expect(isCustomerConversation(candidate)).toBe(false)
    }
    expect(isBillableConversation(candidate)).toBe(false)
  })
})

describe("lead selection state", () => {
  it("Clear always returns a new empty selection", () => {
    const first = clearLeadSelection()
    const second = clearLeadSelection()
    expect(first).toEqual([])
    expect(second).toEqual([])
    expect(first).not.toBe(second)
  })

  it("selects all visible IDs, toggles them off, and prunes disappeared rows", () => {
    const selected = toggleAllLeadSelection([], ["a", "b"])
    expect(selected).toEqual(["a", "b"])
    expect(toggleAllLeadSelection(selected, ["a", "b"])).toEqual([])
    expect(pruneLeadSelection(["a", "b"], ["b", "c"])).toEqual(["b"])
  })
})

describe("dashboard hardening migration", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/00031_dashboard_conversation_notification_hardening.sql"),
    "utf8",
  )

  it("defines explicit classification, owner RLS, and idempotent usage events", () => {
    expect(sql).toContain("conversation_type")
    expect(sql).toContain("conversation_usage_events")
    expect(sql).toContain("unique (user_id, session_id, period_start)")
    expect(sql).toContain('create policy "Users can read own visitor chats"')
    expect(sql).toContain("reconcile_conversation_usage")
  })

  it("soft-deletes linked sessions and persists only the email alert channel", () => {
    expect(sql).toContain("soft_delete_lead")
    expect(sql).toContain("reopen_lead_chat")
    expect(sql).toContain("upsert_notification_email")
    expect(sql).toContain("'email', 'Email'")
    expect(sql).not.toContain("'daily_summary', 'Daily summary'")
  })
})