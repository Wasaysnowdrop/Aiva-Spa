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

  it("tags database failures with an atomic publish stage and rollback diagnostics", () => {
    for (const event of [
      "PUBLISH_STARTED",
      "PUBLISH_AUTH_VALIDATED",
      "PUBLISH_SERVICES_VALIDATED",
      "PUBLISH_SERVICES_SAVED",
      "PUBLISH_FAQS_SAVED",
      "PUBLISH_POLICIES_SAVED",
      "PUBLISH_BRAND_VOICE_SAVED",
      "PUBLISH_NOTIFICATIONS_SAVED",
      "PUBLISH_STATUS_UPDATED",
      "PUBLISH_FAILED",
      "PUBLISH_ROLLED_BACK",
    ]) {
      expect(migration).toContain(event)
    }
    expect(migration).toContain("v_stage := 'services_upsert'")
    expect(migration).toContain("PUBLISH_STAGE=%s")
    expect(migration).toMatch(/exception when others then/i)
  })
  it("keeps the preceding owner RLS migration retry-safe", () => {
    const rlsMigration = readFileSync(
      join(process.cwd(), "supabase/migrations/00027_kb_proper_rls.sql"),
      "utf8",
    )
    for (const operation of ["view", "insert", "update", "delete"]) {
      expect(rlsMigration).toContain(
        `DROP POLICY IF EXISTS "Users can ${operation} own knowledge guardrails"`,
      )
      expect(rlsMigration).toContain(
        `CREATE POLICY "Users can ${operation} own knowledge guardrails"`,
      )
    }
  })
  it("limits the privileged publish function to the service role", () => {
    expect(migration).toMatch(/security definer/i)
    expect(migration).toMatch(/revoke all[\s\S]*from public, anon, authenticated/i)
    expect(migration).toMatch(/grant execute[\s\S]*to service_role/i)
  })
})
