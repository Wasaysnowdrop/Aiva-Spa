import { describe, expect, it } from "vitest"

import {
  dedupeServicesByNormalizedName,
  isServiceCategory,
  normalizeServiceCategory,
  normalizeServiceName,
  SERVICE_CATEGORIES,
} from "@/lib/kb/service-categories"
import { knowledgeBaseSchema, emptyKnowledgeBase } from "@/lib/ai/setup-assistant-schema"
import { servicesExtractionResponseSchema } from "@/lib/ai/services-input"

describe("service category database contract", () => {
  it("uses the exact seven values enforced by Postgres", () => {
    expect(SERVICE_CATEGORIES).toEqual([
      "Injectables",
      "Laser Treatments",
      "Facials",
      "Skin Rejuvenation",
      "Body Treatments",
      "Wellness",
      "Other",
    ])
  })

  it.each([
    ["Skin", "", "Skin Rejuvenation"],
    ["Body", "", "Body Treatments"],
    ["Laser", "", "Laser Treatments"],
    ["Facial", "", "Facials"],
    ["", "Botox Cosmetic - Wrinkle Reduction", "Injectables"],
    ["", "Dermal Fillers - Facial Volume Restoration", "Injectables"],
    ["", "HydraFacial - Deep Skin Cleansing", "Facials"],
    ["", "Microneedling - Skin Rejuvenation", "Skin Rejuvenation"],
    ["", "Laser Hair Removal - Permanent Hair Reduction", "Laser Treatments"],
    ["", "Chemical Peels - Skin Resurfacing", "Skin Rejuvenation"],
    ["", "PRP Facials", "Facials"],
    ["", "Acne Treatments", "Skin Rejuvenation"],
    ["", "Professional Aesthetic Consultations", "Other"],
    ["unrecognised-ai-label", "Custom signature treatment", "Other"],
  ])("normalizes category %j for %j to %j", (raw, name, expected) => {
    expect(normalizeServiceCategory(raw, name)).toBe(expected)
  })

  it("accepts canonical values without changing them", () => {
    for (const category of SERVICE_CATEGORIES) {
      expect(normalizeServiceCategory(category, "anything")).toBe(category)
    }
  })

  it("normalizes invalid AI draft categories before publish", () => {
    const parsed = knowledgeBaseSchema.parse({
      ...emptyKnowledgeBase(),
      services: [{ name: "Mystery Service", category: "made_up", description: "Details" }],
    })
    expect(parsed.services[0]?.category).toBe("Other")
    expect(isServiceCategory(parsed.services[0]?.category)).toBe(true)
  })

  it("uses a valid fallback at the structured AI extraction boundary", () => {
    const parsed = servicesExtractionResponseSchema.parse({
      isValid: true,
      services: [{ name: "Mystery Service", category: "made_up", description: "Details" }],
    })
    expect(parsed.services[0]?.category).toBe("Other")
  })
  it("infers a missing or null draft category from the service name", () => {
    const parsed = knowledgeBaseSchema.parse({
      ...emptyKnowledgeBase(),
      services: [
        { name: "Laser Hair Removal", category: null, description: "Details" },
      ],
    })
    expect(parsed.services[0]?.category).toBe("Laser Treatments")
  })


  it("normalizes service names deterministically", () => {
    expect(normalizeServiceName("  Laser   Hair Removal  ")).toBe("laser hair removal")
  })

  it("deduplicates case and whitespace variants without changing first-write order", () => {
    const services = dedupeServicesByNormalizedName([
      { name: "Botox", value: 1 },
      { name: "  botox  ", value: 2 },
      { name: "HydraFacial", value: 3 },
    ])
    expect(services).toEqual([
      { name: "Botox", value: 1 },
      { name: "HydraFacial", value: 3 },
    ])
  })

  it("never returns a value outside the database contract", () => {
    const inputs = [undefined, null, "", "Skin", "laser_treatments", "wellness", "nonsense"]
    for (const input of inputs) {
      expect(isServiceCategory(normalizeServiceCategory(input, "Unknown Service"))).toBe(true)
    }
  })
})
