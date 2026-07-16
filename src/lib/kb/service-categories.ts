import { z } from "zod"

/** Exact values allowed by knowledge_services_category_check in Postgres. */
export const SERVICE_CATEGORIES = [
  "Injectables",
  "Laser Treatments",
  "Facials",
  "Skin Rejuvenation",
  "Body Treatments",
  "Wellness",
  "Other",
] as const

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]

export const serviceCategorySchema = z.enum(SERVICE_CATEGORIES)
export const FALLBACK_SERVICE_CATEGORY: ServiceCategory = "Other"

const CATEGORY_BY_KEY = new Map<string, ServiceCategory>(
  SERVICE_CATEGORIES.map((category) => [categoryKey(category), category]),
)

const CATEGORY_ALIASES: Record<string, ServiceCategory> = {
  injectable: "Injectables",
  injectables: "Injectables",
  botox: "Injectables",
  filler: "Injectables",
  fillers: "Injectables",
  laser: "Laser Treatments",
  lasers: "Laser Treatments",
  laser_treatment: "Laser Treatments",
  laser_treatments: "Laser Treatments",
  laser_hair_removal: "Laser Treatments",
  facial: "Facials",
  facial_treatment: "Facials",
  facial_treatments: "Facials",
  hydrafacial: "Facials",
  prp_facial: "Facials",
  skin: "Skin Rejuvenation",
  skincare: "Skin Rejuvenation",
  skin_care: "Skin Rejuvenation",
  skin_treatment: "Skin Rejuvenation",
  skin_treatments: "Skin Rejuvenation",
  skin_rejuvenation: "Skin Rejuvenation",
  chemical_peel: "Skin Rejuvenation",
  chemical_peels: "Skin Rejuvenation",
  microneedling: "Skin Rejuvenation",
  acne: "Skin Rejuvenation",
  body: "Body Treatments",
  body_treatment: "Body Treatments",
  body_treatments: "Body Treatments",
  body_contouring: "Body Treatments",
  wellness: "Wellness",
  general: "Other",
  misc: "Other",
  miscellaneous: "Other",
  other: "Other",
}

function categoryKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
}

export function isServiceCategory(value: unknown): value is ServiceCategory {
  return typeof value === "string" && SERVICE_CATEGORIES.includes(value as ServiceCategory)
}

export function normalizeServiceName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase()
}

/**
 * Converts legacy/AI labels to the exact database vocabulary. If the label is
 * unknown, the service name is used for deterministic inference; the total
 * fallback is always the database-valid `Other` value.
 */
export function normalizeServiceCategory(
  rawCategory: unknown,
  serviceName = "",
): ServiceCategory {
  if (typeof rawCategory === "string") {
    const key = categoryKey(rawCategory)
    const canonical = CATEGORY_BY_KEY.get(key)
    if (canonical) return canonical
    const alias = CATEGORY_ALIASES[key]
    if (alias) return alias
  }

  const name = serviceName.trim()
  if (/botox|filler|inject|dysport|xeomin|sculptra|kybella/i.test(name)) return "Injectables"
  if (/laser|\bipl\b|hair removal/i.test(name)) return "Laser Treatments"
  if (/hydrafacial|\bfacial\b|facials|prp facial/i.test(name)) return "Facials"
  if (/microneedl|chemical peel|skin|acne|rejuven|dermaplan|resurfac/i.test(name)) {
    return "Skin Rejuvenation"
  }
  if (/body|contour|coolsculpt|emsculpt/i.test(name)) return "Body Treatments"
  if (/wellness|vitamin|iv therapy/i.test(name)) return "Wellness"
  return FALLBACK_SERVICE_CATEGORY
}

export function dedupeServicesByNormalizedName<T extends { name: string }>(services: T[]): T[] {
  const seen = new Set<string>()
  return services.filter((service) => {
    const key = normalizeServiceName(service.name)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
