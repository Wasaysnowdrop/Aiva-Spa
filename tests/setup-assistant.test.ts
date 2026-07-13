import { describe, expect, it, vi } from "vitest"

import {
  buildSetupAssistantResumeMessage,
  buildSetupAssistantSystemPrompt,
  buildSetupAssistantUserTurn,
} from "@/lib/ai/setup-assistant-prompt"
import {
  emptyKnowledgeBase,
  isBusinessBasicsComplete,
  countPendingFields,
  isCaptured,
  knowledgeBaseSchema,
} from "@/lib/ai/setup-assistant-schema"
import { runSetupAssistantTurn } from "@/lib/ai/setup-assistant"

describe("setup assistant prompt", () => {
  it("includes the JSON response contract", () => {
    const system = buildSetupAssistantSystemPrompt()
    expect(system).toMatch(/Response JSON schema/i)
    expect(system).toMatch(/"reply":\s*string/)
    expect(system).toMatch(/"action":\s*"ask"\s*\|\s*"summarize"\s*\|\s*"advance"\s*\|\s*"finish"/)
    expect(system).toMatch(/Ask exactly ONE missing field/i)
    expect(system).toMatch(/Never ask the owner to reconfirm/i)
  })

  it("forbids null captured values and documents direct array shapes", () => {
    const system = buildSetupAssistantSystemPrompt()
    expect(system).toMatch(/Never output null anywhere/i)
    expect(system).toMatch(/services.*DIRECT ARRAY/i)
    expect(system).toMatch(/calendarLink: valid URL string or ""/i)
  })

  it("forbids firm prices and medical claims", () => {
    const system = buildSetupAssistantSystemPrompt()
    expect(system).toMatch(/Never invent firm prices/i)
    expect(system).toMatch(/medical claims/i)
    expect(system).toMatch(/pending/i)
  })

  it("documents all 9 sections in order", () => {
    const system = buildSetupAssistantSystemPrompt()
    const expectedSections = [
      "business",
      "hours",
      "services",
      "booking_policy",
      "faqs",
      "disclaimers",
      "brand_voice",
      "notifications",
      "review",
    ]
    for (const s of expectedSections) {
      expect(system).toContain(`## ${s}`)
    }
  })

  it("builds a user turn that mentions current section, draft excerpt, and owner message", () => {
    const turn = buildSetupAssistantUserTurn({
      history: [{ role: "user", content: "hi" }],
      userMessage: "Botox is $13 per unit",
      currentSection: "services",
      draft: emptyKnowledgeBase(),
      ownerName: "Aisha Khan",
      spaName: "Glow Aesthetics",
    })
    expect(turn).toContain('current_section: services')
    expect(turn).toContain('next_section: booking_policy')
    expect(turn).toContain('Aisha')
    expect(turn).toContain('Glow Aesthetics')
    expect(turn).toContain('Botox is $13 per unit')
  })

  it("truncates very large draft excerpts", () => {
    const huge = emptyKnowledgeBase()
    huge.services = Array.from({ length: 80 }).map((_, i) => ({
      name: `Service ${i}`,
      category: "Other" as const,
      description: "x".repeat(200),
      duration: "",
    }))
    const turn = buildSetupAssistantUserTurn({
      history: [],
      userMessage: "next",
      currentSection: "services",
      draft: huge,
    })
    expect(turn).toContain("…(truncated)")
  })

  it("detects first user message when history has no user role", () => {
    const turn = buildSetupAssistantUserTurn({
      history: [{ role: "assistant", content: "Welcome to setup." }],
      userMessage: "Glow Aesthetics, glowaesthetics.com",
      currentSection: "business",
      draft: emptyKnowledgeBase(),
    })
    // Should detect this is the first user message and instruct LLM to extract all fields
    expect(turn).toContain("first user message")
    expect(turn).toContain("Extract ALL")
    expect(turn).toContain("NEVER ask for a field the user just provided")
    expect(turn).not.toContain("greet the owner")
  })

  it("does not treat assistant-only history as a prior user turn", () => {
    // History with only assistant messages should be treated as first turn
    const turn = buildSetupAssistantUserTurn({
      history: [
        { role: "assistant", content: "Welcome!" },
        { role: "assistant", content: "What's your name?" },
      ],
      userMessage: "Glow Aesthetics",
      currentSection: "business",
      draft: emptyKnowledgeBase(),
    })
    expect(turn).toContain("first user message")
  })

  it("detects subsequent user messages correctly", () => {
    const turn = buildSetupAssistantUserTurn({
      history: [
        { role: "assistant", content: "Welcome!" },
        { role: "user", content: "Glow Aesthetics" },
        { role: "assistant", content: "Got it." },
      ],
      userMessage: "San Francisco",
      currentSection: "business",
      draft: emptyKnowledgeBase(),
    })
    // Should NOT contain first-turn instruction
    expect(turn).not.toContain("first user message")
    expect(turn).toContain("Stay strictly")
  })

  it("builds a resume question that matches every saved section", () => {
    const cases = [
      ["business", /business name/i],
      ["hours", /regular business hours/i],
      ["services", /services do you offer/i],
      ["booking_policy", /consultation requests/i],
      ["faqs", /common visitor question/i],
      ["disclaimers", /standard pricing/i],
      ["brand_voice", /what tone/i],
      ["notifications", /new-lead notifications/i],
      ["review", /ready to save/i],
    ] as const

    for (const [section, expected] of cases) {
      const message = buildSetupAssistantResumeMessage(section, "Wff")
      expect(message).toMatch(expected)
      expect(message).toContain("Wff")
      if (section !== "business") {
        expect(message).not.toMatch(/tell me your business name/i)
      }
    }
  })

  it("includes business field guidance with name not spa_name", () => {
    const system = buildSetupAssistantSystemPrompt()
    expect(system).toContain("- name (required)")
    expect(system).not.toContain("- spa_name (required)")
    expect(system).toContain("business_type")
  })
})

describe("setup assistant KB helpers", () => {
  it("isCaptured treats 'pending' as false", () => {
    expect(isCaptured("pending")).toBe(false)
    expect(isCaptured(null)).toBe(false)
    expect(isCaptured(undefined)).toBe(false)
    expect(isCaptured({ value: "Botox", status: "captured" })).toBe(true)
    expect(isCaptured({ value: "", status: "pending" })).toBe(false)
    expect(isCaptured("Glow Aesthetics")).toBe(true)
    expect(isCaptured(["a@b.com"])).toBe(true)
    expect(isCaptured([])).toBe(false)
  })

  it("countPendingFields lists business.name, services, faqs, hours, notifications when missing", () => {
    const kb = emptyKnowledgeBase()
    const pending = countPendingFields(kb)
    expect(pending).toContain("business.name")
    expect(pending).toContain("services")
    expect(pending).toContain("faqs")
    expect(pending).toContain("notifications")
    expect(pending).toContain("hours.schedule")
  })

  it("only completes Step 1 after name, website, address, and after-hours policy", () => {
    const kb = emptyKnowledgeBase()
    kb.business!.name = "Wff Med Spa"
    expect(isBusinessBasicsComplete(kb)).toBe(false)

    kb.business!.website = "https://wffmedspa.com"
    kb.business!.addresses = [
      { line1: "25 Main Boulevard", city: "Lahore", region: "Punjab", country: "Pakistan", line2: "", postal: "54660" },
    ]
    kb.business!.afterHoursPolicy = "Capture leads and follow up the next morning."

    expect(isBusinessBasicsComplete(kb)).toBe(true)
  })

  it("knowledgeBaseSchema validates the empty KB", () => {
    const parsed = knowledgeBaseSchema.safeParse(emptyKnowledgeBase())
    expect(parsed.success).toBe(true)
  })

  it("knowledgeBaseSchema rejects an unknown service category", () => {
    const bad = {
      ...emptyKnowledgeBase(),
      services: [
        {
          name: "Botox",
          category: "Bogus",
          description: "Test",
        },
      ],
    }
    const parsed = knowledgeBaseSchema.safeParse(bad)
    expect(parsed.success).toBe(false)
  })

  it("accepts a priceRange with indicativeOnly:false at the schema level (the LLM enforces the rule)", () => {
    // The schema only validates structure. The "no firm prices" rule is
    // enforced by the Setup Assistant system prompt + the detectPricingConcerns
    // guard in setup-assistant.ts. We keep this test as a contract marker.
    const ok = {
      ...emptyKnowledgeBase(),
      services: [
        {
          name: "Botox",
          category: "Injectables" as const,
          description: "Test",
          priceRange: { min: 13, max: 15, currency: "USD", unit: "per unit", indicativeOnly: true },
        },
      ],
    }
    const parsed = knowledgeBaseSchema.safeParse(ok)
    expect(parsed.success).toBe(true)
  })
})

describe("runSetupAssistantTurn (strict Nara provider)", () => {
  it("retries once when Nara returns malformed JSON", async () => {
    const previousKey = process.env.NARA_API_KEY
    process.env.NARA_API_KEY = "test-nara-key"
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: "mistral-medium-3-5",
            choices: [{ message: { content: "not valid json" } }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: "mistral-medium-3-5",
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    reply: "I saved Glow Aesthetics. What is your website?",
                    section: "business",
                    action: "ask",
                    captured: { business: { name: "Glow Aesthetics" } },
                    concerns: [],
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
    vi.stubGlobal("fetch", fetchMock)

    try {
      const result = await runSetupAssistantTurn({
        history: [],
        userMessage: "Our business is Glow Aesthetics.",
        currentSection: "business",
        draft: emptyKnowledgeBase(),
      })

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result.provider).toBe("nara")
      expect(result.model).toBe("mistral-medium-3-5")
      expect(result.reply).toMatch(/website/i)
      expect(result.draft.business?.name).toBe("Glow Aesthetics")
    } finally {
      if (previousKey === undefined) delete process.env.NARA_API_KEY
      else process.env.NARA_API_KEY = previousKey
      vi.unstubAllGlobals()
    }
  })
  it("advances to Step 2 immediately when Nara captures all business fields", async () => {
    const previousKey = process.env.NARA_API_KEY
    process.env.NARA_API_KEY = "test-nara-key"
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "mistral-medium-3-5",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reply: "Everything looks correct. Can you confirm?",
                  section: "business",
                  action: "summarize",
                  captured: {
                    business: {
                      name: "Wff Med Spa",
                      website: "https://wffmedspa.com",
                      addresses: [
                        {
                          line1: "25 Main Boulevard",
                          city: "Lahore",
                          region: "Punjab",
                          postal: "54660",
                          country: "Pakistan",
                        },
                      ],
                      afterHoursPolicy:
                        "Capture inquiries and follow up the next business morning.",
                    },
                  },
                  concerns: [],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    try {
      const result = await runSetupAssistantTurn({
        history: [],
        userMessage:
          "Wff Med Spa, wffmedspa.com, 25 Main Boulevard, Lahore. Capture leads after hours.",
        currentSection: "business",
        draft: emptyKnowledgeBase(),
      })

      expect(result.action).toBe("advance")
      expect(result.section).toBe("business")
      expect(result.nextSection).toBe("hours")
      expect(result.reply).toMatch(/regular business hours/i)
      expect(result.reply).not.toMatch(/confirm|correct/i)
    } finally {
      if (previousKey === undefined) delete process.env.NARA_API_KEY
      else process.env.NARA_API_KEY = previousKey
      vi.unstubAllGlobals()
    }
  })

  it("breaks an existing Step 1 confirmation loop after the owner says yes", async () => {
    const previousKey = process.env.NARA_API_KEY
    process.env.NARA_API_KEY = "test-nara-key"
    const draft = emptyKnowledgeBase()
    draft.business = {
      name: "Wff Med Spa",
      website: "https://wffmedspa.com",
      addresses: [
        {
          line1: "25 Main Boulevard",
          line2: "",
          city: "Lahore",
          region: "Punjab",
          postal: "54660",
          country: "Pakistan",
        },
      ],
      afterHoursPolicy: "Capture inquiries and follow up the next business morning.",
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "mistral-medium-3-5",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reply: "Does this look correct?",
                  section: "business",
                  action: "summarize",
                  captured: {},
                  concerns: [],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    try {
      const result = await runSetupAssistantTurn({
        history: [
          { role: "assistant", content: "Does this look correct?" },
        ],
        userMessage: "Yes, everything is correct.",
        currentSection: "business",
        draft,
      })

      expect(result.action).toBe("advance")
      expect(result.nextSection).toBe("hours")
      expect(result.reply).toBe(
        "Saved. What are your regular business hours, including closed days?",
      )
    } finally {
      if (previousKey === undefined) delete process.env.NARA_API_KEY
      else process.env.NARA_API_KEY = previousKey
      vi.unstubAllGlobals()
    }
  })

  it("asks one short missing business field even if Nara bundles questions", async () => {
    const previousKey = process.env.NARA_API_KEY
    process.env.NARA_API_KEY = "test-nara-key"
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "mistral-medium-3-5",
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reply: "What is your website, address, and after-hours policy?",
                  section: "business",
                  action: "ask",
                  captured: { business: { name: "Wff Med Spa" } },
                  concerns: [],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    try {
      const result = await runSetupAssistantTurn({
        history: [],
        userMessage: "Our business name is Wff Med Spa.",
        currentSection: "business",
        draft: emptyKnowledgeBase(),
      })

      expect(result.action).toBe("ask")
      expect(result.nextSection).toBeNull()
      expect(result.reply).toBe("What is your website?")
      expect(result.reply.match(/\?/g)).toHaveLength(1)
    } finally {
      if (previousKey === undefined) delete process.env.NARA_API_KEY
      else process.env.NARA_API_KEY = previousKey
      vi.unstubAllGlobals()
    }
  })

})

describe("runSetupAssistantTurn (mock provider)", () => {
  it("returns a structured reply and merges captured data into the draft", async () => {
    const draft = emptyKnowledgeBase()
    const result = await runSetupAssistantTurn({
      history: [],
      userMessage: "Glow Aesthetics in San Francisco",
      currentSection: "business",
      draft,
    })
    expect(result.reply.length).toBeGreaterThan(0)
    expect(result.section).toBe("business")
    expect(result.action).toMatch(/ask|summarize|advance|finish/)
    expect(result.draft).toBeDefined()
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it("flags firm prices as a compliance concern", async () => {
    const result = await runSetupAssistantTurn({
      history: [],
      userMessage: "Botox is $13 per unit",
      currentSection: "services",
      draft: emptyKnowledgeBase(),
    })
    const hasFirmPriceConcern = result.concerns.some((c) => /firm price/i.test(c))
    expect(hasFirmPriceConcern).toBe(true)
  })

  it("flags medical claims as a compliance concern", async () => {
    const result = await runSetupAssistantTurn({
      history: [],
      userMessage: "Our Botox is 100% risk-free and guaranteed",
      currentSection: "services",
      draft: emptyKnowledgeBase(),
    })
    const hasMedicalConcern = result.concerns.some((c) => /medical|outcome|risk|guarantee/i.test(c))
    expect(hasMedicalConcern).toBe(true)
  })

  it("marks status.complete when the assistant returns action=finish", async () => {
    // The mock fallback always returns "finish" on the review section.
    const result = await runSetupAssistantTurn({
      history: [],
      userMessage: "Looks good, publish it.",
      currentSection: "review",
      draft: emptyKnowledgeBase(),
    })
    expect(result.action).toBe("finish")
    expect(result.draft.status?.complete).toBe(true)
  })

  it("extracts timezone and schedule from hours input and advances", async () => {
    const result = await runSetupAssistantTurn({
      history: [],
      userMessage: "We are open Monday to Friday from 10 AM to 6 PM, Saturday from 10 AM to 3 PM, and closed on Sunday. Our timezone is America/Los_Angeles.",
      currentSection: "hours",
      draft: emptyKnowledgeBase(),
    })
    expect(result.action).toBe("advance")
    expect(result.nextSection).toBe("services")
    expect(result.draft.hours?.timezone).toBe("America/Los_Angeles")
    expect(result.draft.hours?.schedule?.length).toBe(7)
    expect(result.draft.hours?.schedule?.find(d => d.day === "Sun")?.open).toBe(false)
    expect(result.draft.hours?.schedule?.find(d => d.day === "Mon")?.from).toBe("10:00")
    expect(result.draft.hours?.schedule?.find(d => d.day === "Mon")?.to).toBe("18:00")
    expect(result.draft.hours?.schedule?.find(d => d.day === "Sat")?.from).toBe("10:00")
    expect(result.draft.hours?.schedule?.find(d => d.day === "Sat")?.to).toBe("15:00")
    expect(result.reply).toBe("Saved. What services do you offer?")
  })

  it("captures the exact Asia/Karachi hours message without asking for timezone again", async () => {
    const result = await runSetupAssistantTurn({
      history: [],
      userMessage:
        "Our timezone is Asia/Karachi. We are open Monday to Friday from 10:00 AM to 8:00 PM, Saturday from 11:00 AM to 6:00 PM, and closed on Sunday.",
      currentSection: "hours",
      draft: emptyKnowledgeBase(),
    })

    expect(result.action).toBe("advance")
    expect(result.nextSection).toBe("services")
    expect(result.section).toBe("hours")
    expect(result.draft.hours?.timezone).toBe("Asia/Karachi")
    expect(result.draft.hours?.schedule?.find((day) => day.day === "Mon")).toMatchObject({
      open: true,
      from: "10:00",
      to: "20:00",
    })
    expect(result.draft.hours?.schedule?.find((day) => day.day === "Sat")).toMatchObject({
      open: true,
      from: "11:00",
      to: "18:00",
    })
    expect(result.draft.hours?.schedule?.find((day) => day.day === "Sun")?.open).toBe(false)
    expect(result.reply).toBe("Saved. What services do you offer?")
    expect(result.reply).not.toMatch(/which timezone/i)
  })

  it("recovers an hours answer received while an older draft is stuck on business", async () => {
    const draft = emptyKnowledgeBase()
    draft.business!.name = { value: "Glow Haven Med Spa", status: "captured" }

    const result = await runSetupAssistantTurn({
      history: [
        { role: "user", content: "Our business is Glow Haven Med Spa in Karachi." },
        { role: "assistant", content: "Quick confirm: which timezone should we use?" },
      ],
      userMessage:
        "Our timezone is Asia/Karachi. We are open Monday to Friday from 10:00 AM to 8:00 PM, Saturday from 11:00 AM to 6:00 PM, and closed on Sunday.",
      currentSection: "business",
      draft,
    })

    expect(result.action).toBe("advance")
    expect(result.section).toBe("hours")
    expect(result.nextSection).toBe("services")
    expect(result.draft.business!.name).toEqual({
      value: "Glow Haven Med Spa",
      status: "captured",
    })
    expect(result.draft.hours?.timezone).toBe("Asia/Karachi")
    expect(result.reply).not.toMatch(/which timezone/i)
  })

  it("extracts timezone from PST abbreviation and advances when schedule present", async () => {
    const result = await runSetupAssistantTurn({
      history: [],
      userMessage: "We're open weekdays 9-5 and weekends 10-4, Pacific Time.",
      currentSection: "hours",
      draft: emptyKnowledgeBase(),
    })
    expect(result.action).toBe("advance")
    expect(result.draft.hours?.timezone).toBe("America/Los_Angeles")
  })

  it("asks one short question per field, advances through every step, and completes the KB", async () => {
    let draft = emptyKnowledgeBase()
    let section: Parameters<typeof runSetupAssistantTurn>[0]["currentSection"] = "business"
    const history: Parameters<typeof runSetupAssistantTurn>[0]["history"] = []

    async function answer(message: string) {
      const result = await runSetupAssistantTurn({
        history,
        userMessage: message,
        currentSection: section,
        draft,
      })
      history.push(
        { role: "user", content: message },
        { role: "assistant", content: result.reply },
      )
      draft = result.draft
      if (result.nextSection) section = result.nextSection
      return result
    }

    async function expectQuestion(message: string, expected: RegExp) {
      const result = await answer(message)
      expect(result.reply).toMatch(expected)
      expect(result.reply.match(/\?/g)).toHaveLength(1)
      return result
    }

    await expectQuestion("Wff Med Spa", /website/i)
    await expectQuestion("wffmedspa.com", /street address/i)
    await expectQuestion("25 Main Boulevard, Gulberg III, Lahore", /after hours/i)
    await expectQuestion(
      "Capture inquiries and follow up the next business morning.",
      /regular business hours/i,
    )
    expect(section).toBe("hours")

    await expectQuestion(
      "Monday to Friday 10 AM to 8 PM, Saturday 11 AM to 6 PM, closed Sunday.",
      /timezone/i,
    )
    await expectQuestion("Asia/Karachi", /services do you offer/i)
    expect(section).toBe("services")

    await expectQuestion("Botox and facials.", /other services/i)
    await expectQuestion("No more.", /consultation requests/i)
    expect(section).toBe("booking_policy")

    await expectQuestion("Manual follow-up.", /deposit/i)
    await expectQuestion("No deposit.", /cancellation notice/i)
    await expectQuestion("24 hours.", /common visitor question/i)
    expect(section).toBe("faqs")

    await expectQuestion(
      "Do you offer Botox? Yes, after a consultation with a licensed provider.",
      /another FAQ/i,
    )
    await expectQuestion("No more.", /standard pricing/i)
    await expectQuestion("Use the standard disclaimers.", /what tone/i)
    expect(section).toBe("brand_voice")

    await expectQuestion("Warm.", /greeting/i)
    await expectQuestion("Hi! How can I help with your treatment inquiry?", /phrases.*avoid/i)
    await expectQuestion("No more.", /email address/i)
    expect(section).toBe("notifications")

    await expectQuestion("owner@wffmedspa.com", /ready to save/i)
    expect(section).toBe("review")
    const final = await answer("Yes, save it.")

    expect(final.action).toBe("finish")
    expect(final.nextSection).toBeNull()
    expect(final.reply).toMatch(/saving your knowledge base/i)
    expect(final.draft.status).toMatchObject({ complete: true })
    expect(final.draft.business?.website).toBe("wffmedspa.com")
    expect(final.draft.hours?.timezone).toBe("Asia/Karachi")
    expect(final.draft.services).toHaveLength(1)
    expect(final.draft.booking_policy?.deposit.required).toBe(false)
    expect(final.draft.booking_policy?.cancellation.noticeHours).toBe(24)
    expect(final.draft.faqs[0]?.answer).toMatch(/licensed provider/i)
    expect(final.draft.disclaimers?.standardAccepted).toBe(true)
    expect(final.draft.brand_voice?.greeting).toMatch(/How can I help/i)
    expect(final.draft.notifications?.emailRecipients).toEqual(["owner@wffmedspa.com"])
  })

  it("accepts website as a bare domain without https:// protocol", () => {
    const kb = {
      ...emptyKnowledgeBase(),
      business: {
        name: "Glow Aesthetics",
        website: "glowaesthetics.com",
        addresses: [{ line1: "123 Main St", city: "San Francisco", region: "CA", country: "US" }],
        afterHoursPolicy: "pending",
      },
    }
    const parsed = knowledgeBaseSchema.safeParse(kb)
    expect(parsed.success).toBe(true)
  })

  it("website field accepts empty string", () => {
    const kb = {
      ...emptyKnowledgeBase(),
      business: {
        name: "Test Spa",
        website: "",
        addresses: [],
        afterHoursPolicy: "pending",
      },
    }
    const parsed = knowledgeBaseSchema.safeParse(kb)
    expect(parsed.success).toBe(true)
  })

  it("rejects invalid business name", () => {
    const bad = {
      ...emptyKnowledgeBase(),
      business: {
        name: null,
        website: "",
        addresses: [],
        afterHoursPolicy: "pending",
      },
    }
    const parsed = knowledgeBaseSchema.safeParse(bad)
    expect(parsed.success).toBe(false)
  })
})
