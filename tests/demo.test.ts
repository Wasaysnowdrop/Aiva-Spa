import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { answerDemoMessage, scenarioKnowledgeBundle } from "@/lib/demo/engine"
import { DEMO_SCENARIO_IDS, DEMO_SCENARIOS } from "@/lib/demo/scenarios"
import { demoChatSchema, demoSalesLeadSchema, demoTestLeadSchema } from "@/lib/demo/schemas"

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), "utf8")

afterEach(() => {
  delete process.env.NARA_API_KEY
})

describe("public interactive demo", () => {
  it("ships four curated scenarios without regenerating them", () => {
    expect(DEMO_SCENARIO_IDS).toHaveLength(4)
    for (const id of DEMO_SCENARIO_IDS) {
      const scenario = DEMO_SCENARIOS[id]
      expect(scenario.services.length).toBeGreaterThanOrEqual(5)
      expect(scenario.faqs.length).toBeGreaterThanOrEqual(4)
      expect(scenario.welcomeMessage).toContain(scenario.businessName.split(" ")[0])
    }
  })

  it("answers a service-list question from approved scenario data", async () => {
    const reply = await answerDemoMessage({ scenarioId: "medical-spa", message: "What services do you offer?", history: [] })
    expect(reply.source).toBe("deterministic")
    expect(reply.content).toContain("Botox Cosmetic")
    expect(reply.content).toContain("HydraFacial")
  })

  it("refuses diagnosis and personalised medical advice safely", async () => {
    const reply = await answerDemoMessage({ scenarioId: "medical-spa", message: "Can you diagnose this rash and tell me which medicine to use?", history: [] })
    expect(reply.safeRefusal).toBe(true)
    expect(reply.content.toLowerCase()).toMatch(/can't|not able|licensed provider|medical advice/)
  })

  it("defers unknown or exact pricing to consultation", async () => {
    const reply = await answerDemoMessage({ scenarioId: "medical-spa", message: "How much is an exact Botox treatment?", history: [] })
    expect(reply.content.toLowerCase()).toMatch(/consultation|provider/)
    expect(reply.content).not.toMatch(/\$\d/)
  })

  it("keeps working with a deterministic fallback when no provider is configured", async () => {
    const reply = await answerDemoMessage({ scenarioId: "medical-spa", message: "Tell me something about recovery that is not listed", history: [] })
    expect(["fallback", "deterministic"]).toContain(reply.source)
    expect(reply.content.length).toBeGreaterThan(20)
  })

  it("builds an isolated scenario knowledge bundle", () => {
    const bundle = scenarioKnowledgeBundle("laser-clinic")
    expect(bundle.widget.brandName).toBe("Bareline Laser Studio")
    expect(bundle.services.every((service) => service.id.startsWith("demo-service-"))).toBe(true)
    expect(bundle.services.some((service) => service.name.includes("Botox"))).toBe(false)
  })

  it("requires explicit consent for test and real sales leads", () => {
    const testLead = { mode: "test", name: "Alex Morgan", email: "alex@example.com", phone: "", service: "Botox Cosmetic", preferredDate: "Next Tuesday", preferredTime: "Afternoon", notes: "", consentGiven: false }
    expect(demoTestLeadSchema.safeParse(testLead).success).toBe(false)
    const sales = { fullName: "Alex Morgan", businessName: "Glow", workEmail: "alex@glow.example", phone: "", website: "glow.example", locations: 1, monthlyEnquiries: "50", currentProcess: "Front desk email", countryTimezone: "USA / Pacific", preferredContactTime: "Afternoon", consentGiven: false }
    expect(demoSalesLeadSchema.safeParse(sales).success).toBe(false)
  })

  it("caps and validates chat payloads", () => {
    expect(demoChatSchema.safeParse({ message: "hello", requestId: crypto.randomUUID(), website: "" }).success).toBe(true)
    expect(demoChatSchema.safeParse({ message: "x".repeat(601), requestId: crypto.randomUUID(), website: "" }).success).toBe(false)
    expect(demoChatSchema.safeParse({ message: "hello", requestId: crypto.randomUUID(), website: "bot" }).success).toBe(false)
  })

  it("uses dedicated service-role-only demo tables and atomic server limits", () => {
    const schema = source("supabase/migrations/00039_public_demo.sql")
    const limits = source("supabase/migrations/00040_demo_atomic_limits.sql")
    for (const table of ["demo_sessions", "demo_messages", "demo_leads", "demo_sales_leads", "demo_events"]) {
      expect(schema).toContain(`public.${table}`)
      expect(schema).toContain(`revoke all on public.${table} from anon, authenticated`)
    }
    expect(schema).toContain("is_billable boolean not null default false check (is_billable = false)")
    expect(schema).toContain("environment text not null default 'public_demo'")
    expect(limits).toContain("p_max_messages integer default 12")
    expect(limits).toContain("p_max_output_tokens integer default 2000")
    expect(limits).toContain("for update")
  })

  it("keeps vague preferred times in a needs-scheduling state", () => {
    const dashboard = source("src/components/demo/demo-dashboard.tsx")
    expect(dashboard).toContain("Needs scheduling")
    expect(dashboard).toContain("is a preference, not a confirmed appointment")
    expect(dashboard).toContain("Choose an exact date and time before marking this request booked")
  })

  it("exposes the public route and conversion CTAs without customer-dashboard access", () => {
    const page = source("app/demo/page.tsx")
    const landing = source("app/page.tsx")
    const pricing = source("app/pricing/page.tsx")
    expect(page).not.toMatch(/requireAdmin|redirect\("\/login|dashboard-sidebar/)
    expect(page).toContain("No signup required")
    expect(landing.match(/href="\/demo"/g)?.length).toBeGreaterThanOrEqual(5)
    expect(pricing).toContain("Try the interactive demo")
  })

  it("does not mention or implement SMS in the demo experience", () => {
    const demoSources = [
      source("app/demo/page.tsx"),
      source("src/components/demo/demo-experience.tsx"),
      source("src/components/demo/lead-capture-modal.tsx"),
      source("src/components/demo/demo-dashboard.tsx"),
      source("app/api/demo/sales/route.ts"),
    ].join("\n")
    expect(demoSources).not.toMatch(/\bsms\b/i)
  })

  it("contains no gradients or iframe-based demo preview", () => {
    const demoSources = [source("app/demo/page.tsx"), source("src/components/demo/demo-experience.tsx")].join("\n")
    expect(demoSources).not.toMatch(/gradient|<iframe/i)
  })
})

