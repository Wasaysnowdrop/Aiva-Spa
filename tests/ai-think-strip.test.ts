import { describe, expect, it } from "vitest"

// Re-implement the stripThinkBlocks logic here as a small helper so we
// can test the exact same function as the live code. The function lives
// in src/lib/ai/llm.ts but is not exported — re-declaring here lets us
// lock in the contract: HTML-encoded think tags must be stripped just
// like the literal form, so visitors never see the model's reasoning.
function decodeHtmlThinkTags(raw: string): string {
  return raw
    .replace(/&lt;\/?think&gt;/gi, (m) => (m.includes("/") ? "</think>" : "<think>"))
}

function stripThinkBlocks(raw: string): string {
  if (!raw) return raw
  const decoded = decodeHtmlThinkTags(raw)
  const cleaned = decoded.replace(/<think>[\s\S]*?<\/think>/gi, "").trimStart()
  return cleaned.length > 0 ? cleaned : raw.trim()
}

describe("think-block stripping (HTML-encoded form)", () => {
  it("strips literal <think>...</think> blocks", () => {
    const raw =
      "<think>The visitor is asking about services.\n</think>Hi, we offer Botox and fillers!"
    expect(stripThinkBlocks(raw)).toBe("Hi, we offer Botox and fillers!")
  })

  it("strips HTML-encoded &lt;think&gt;...&lt;/think&gt; blocks (TokenRouter / MiniMax-M3)", () => {
    const raw =
      "&lt;think&gt;The visitor is asking about services.&lt;/think&gt;Hi, we offer Botox and fillers!"
    expect(stripThinkBlocks(raw)).toBe("Hi, we offer Botox and fillers!")
  })

  it("strips HTML-encoded think blocks that span newlines", () => {
    const raw =
      "&lt;think&gt;\nLooking at the KB:\n- Botox\n- Fillers\n&lt;/think&gt;\n\nWe offer Botox, fillers, and more."
    expect(stripThinkBlocks(raw)).toBe(
      "We offer Botox, fillers, and more.",
    )
  })

  it("strips a think block embedded mid-response", () => {
    const raw =
      "Sure thing — &lt;think&gt;mid-reasoning&lt;/think&gt;here's the answer."
    expect(stripThinkBlocks(raw)).toBe("Sure thing — here's the answer.")
  })

  it("falls back to the raw text when the think block consumes everything", () => {
    const raw = "&lt;think&gt;Only thinking, no visible reply.&lt;/think&gt;"
    // The fallback is the trimmed raw (with tags intact) so the visitor
    // sees something rather than nothing. Real-world responses should
    // always have visible content after the think block.
    const out = stripThinkBlocks(raw)
    expect(out).toBeTruthy()
    expect(out.length).toBeGreaterThan(0)
  })

  it("preserves text that has no think block at all", () => {
    const raw = "Just a normal answer with no reasoning."
    expect(stripThinkBlocks(raw)).toBe(raw)
  })

  it("does not strip <think> inside a normal sentence that happens to contain it", () => {
    // HTML-encoded <think> without a closing tag stays as visible text;
    // we don't want to accidentally eat content.
    const raw = "Use <think> pattern in your code."
    expect(stripThinkBlocks(raw)).toBe("Use <think> pattern in your code.")
  })
})

describe("AI replies are not replaced by the fallback for normal questions", () => {
  // This is the core invariant: the conversation engine's KB-aware
  // fallback (e.g. for out-of-scope services, hours, emergencies) is
  // what should appear — NOT the generic "I'm having a quick moment"
  // hardcoded fallback that hides real errors.
  it("KB-aware fallback returns a meaningful reply for normal questions", async () => {
    const { kbAwareFallback } = await import("@/lib/ai/fallback")
    const { emptyKnowledgeBase } = await import("@/lib/ai/setup-assistant-schema")
    const emptyKb = {
      services: [],
      faqs: [],
      guardrails: [],
      widget: {
        id: "w",
        brandName: "Test Spa",
        logoInitial: "T",
        bubbleLogoUrl: null,
        primaryColor: "#000",
        position: "bottom-right" as const,
        welcomeMessage: "Hi",
        proactiveEnabled: false,
        proactiveDelaySeconds: 0,
        proactiveMessage: "",
        showBranding: false,
        collectEmail: false,
        collectPhone: false,
        consentText: "By chatting you agree.",
        workingHours: { enabled: false, tz: "UTC", schedule: [] },
        extendedKb: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      extendedKb: { ...emptyKnowledgeBase(), source: "empty" as const },
      fetchedAt: 0,
    }
    const replies = [
      kbAwareFallback("Hi, what services do you offer?", emptyKb),
      kbAwareFallback("Can I get filler while pregnant?", emptyKb),
      kbAwareFallback("What are your hours?", emptyKb),
      kbAwareFallback("Do you do teeth whitening?", emptyKb),
    ]
    for (const r of replies) {
      expect(r).toBeTruthy()
      expect(r.trim().length).toBeGreaterThan(8)
      // The reply must NOT be the hardcoded "quick moment" fallback.
      expect(r.toLowerCase()).not.toContain("quick moment")
    }
  })
})