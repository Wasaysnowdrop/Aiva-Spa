import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

export async function getAdminSettings() {
  const admin = createAdminClient()
  const { data, error } = await admin.from("admin_settings").select("key,value")
  if (error) return {}
  const result: Record<string, unknown> = {}
  for (const row of (data ?? []) as { key: string; value: unknown }[]) result[row.key] = row.value
  return result
}