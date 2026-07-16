import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/00029_atomic_onboarding_publish.sql"),
  "utf8",
)

describe("atomic onboarding publish migration", () => {
  it("keeps the category constraint intact and validates its exact vocabulary", () => {
    expect(migration).not.toMatch(/drop constraint.*knowledge_services_category_check/i)
    for (const category of [
      "Injectables",
      "Laser Treatments",
      "Facials",
      "Skin Rejuvenation",
      "Body Treatments",
      "Wellness",
      "Other",
    ]) {
      expect(migration).toContain(`'${category}'`)
    }
    expect(migration).toContain("alter column category set default 'Other'")
  })

  it("publishes services, FAQs, guardrails, settings, widget, and completion metadata in one function", () => {
    expect(migration).toContain("create or replace function public.publish_onboarding_knowledge_base")
    expect(migration).toContain("insert into public.knowledge_services")
    expect(migration).toContain("insert into public.knowledge_faqs")
    expect(migration).toContain("insert into public.knowledge_guardrails")
    expect(migration).toContain("update public.widget_config")
    expect(migration).toContain("update public.spa_settings")
    expect(migration).toContain("update auth.users")
  })

  it("makes retries idempotent by normalized owner/name identity", () => {
    expect(migration).toContain("knowledge_services_owner_normalized_name_key")
    expect(migration).toMatch(/on conflict \(user_id, normalized_name\)/i)
    expect(migration).toMatch(/distinct on \(lower\(regexp_replace\(btrim\(service\.name\)/i)
  })

  it("limits the privileged publish function to the service role", () => {
    expect(migration).toMatch(/security definer/i)
    expect(migration).toMatch(/revoke all[\s\S]*from public, anon, authenticated/i)
    expect(migration).toMatch(/grant execute[\s\S]*to service_role/i)
  })
})
