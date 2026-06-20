import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAdmin } from "@/lib/admin/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { recordAudit } from "@/lib/audit"
import { AdminTopBar } from "@/components/admin/admin-shell"

export const runtime = "nodejs"

async function updateSetting(formData: FormData) {
  "use server"
  const admin = await requireAdmin()
  const key = String(formData.get("key") ?? "")
  const valueRaw = String(formData.get("value") ?? "{}")
  let parsed: unknown
  try {
    parsed = JSON.parse(valueRaw)
  } catch {
    parsed = valueRaw
  }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("admin_settings")
    .upsert({ key, value: parsed, updated_by: admin.id } as never)
  if (error) {
    await supabase.from("admin_audit_log").insert({
      admin_user_id: admin.id,
      admin_email: admin.email ?? "",
      action: "settings.update_failed",
      target: key,
      metadata: { error: error.message },
    } as never)
    redirect(`/admin/settings?error=${encodeURIComponent(error.message)}`)
  }
  await supabase.from("admin_audit_log").insert({
    admin_user_id: admin.id,
    admin_email: admin.email ?? "",
    action: "settings.update",
    target: key,
    metadata: { value: parsed },
  } as never)
  await recordAudit({ userName: admin.email ?? admin.id, action: `admin.settings.update ${key}` })
  revalidatePath("/admin/settings")
  redirect(`/admin/settings?ok=${encodeURIComponent(key)}`)
}

async function toggleKillSwitch(formData: FormData) {
  "use server"
  const admin = await requireAdmin()
  const switchName = String(formData.get("switch") ?? "")
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "kill_switches")
    .maybeSingle()
  const current = ((data as { value?: unknown } | null)?.value as Record<string, unknown> | null) ?? {}
  const next = { ...current, [switchName]: !current[switchName] }
  const { error } = await supabase
    .from("admin_settings")
    .upsert({ key: "kill_switches", value: next, updated_by: admin.id } as never)
  if (error) {
    redirect(`/admin/settings?error=${encodeURIComponent(error.message)}`)
  }
  await supabase.from("admin_audit_log").insert({
    admin_user_id: admin.id,
    admin_email: admin.email ?? "",
    action: "kill_switch.toggle",
    target: switchName,
    metadata: { new_value: next[switchName] },
  } as never)
  revalidatePath("/admin/settings")
  redirect(`/admin/settings?ok=${encodeURIComponent(switchName)}`)
}

async function getSettings() {
  const supabase = createAdminClient()
  const { data } = await supabase.from("admin_settings").select("*")
  const out: Record<string, unknown> = {}
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    out[row.key] = row.value
  }
  return out
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>
}) {
  const settings = await getSettings()
  const sp = await searchParams
  const featureFlags = (settings.feature_flags as Record<string, boolean> | null) ?? {}
  const killSwitches = (settings.kill_switches as Record<string, boolean> | null) ?? {}
  const llmCaps = (settings.llm_caps as Record<string, number> | null) ?? {}

  return (
    <>
      <AdminTopBar
        title="Settings"
        subtitle="Feature flags, kill switches, LLM caps"
      />
      <div className="space-y-5 p-5">
        {sp.ok ? (
          <div className="rounded-md border border-[#4CB782]/30 bg-[#4CB782]/10 px-3 py-2 text-xs text-[#4CB782]">
            Saved <code className="font-mono">{sp.ok}</code>.
          </div>
        ) : null}
        {sp.error ? (
          <div className="rounded-md border border-[#EB5757]/30 bg-[#EB5757]/10 px-3 py-2 text-xs text-[#EB5757]">
            {sp.error}
          </div>
        ) : null}

        <section className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-5">
          <h2 className="text-sm font-semibold text-[#F7F8F8]">Kill switches</h2>
          <p className="mt-1 text-[10px] text-[#62666D]">
            Toggle to immediately stop the feature across the platform. Changes take effect on the next request.
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Object.entries(killSwitches).map(([name, value]) => (
              <li
                key={name}
                className="flex items-center justify-between rounded-md border border-[#1A1B1E] bg-[#0B0C0E] px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-mono text-[#F7F8F8]">{name}</p>
                  <p className="text-[10px] text-[#62666D]">
                    {value ? "Currently blocking traffic" : "Currently allowed"}
                  </p>
                </div>
                <form action={toggleKillSwitch}>
                  <input type="hidden" name="switch" value={name} />
                  <button
                    type="submit"
                    className={
                      "inline-flex h-7 items-center rounded-md border px-2 text-[10px] font-semibold uppercase tracking-wider transition " +
                      (value
                        ? "border-[#EB5757]/30 bg-[#EB5757]/10 text-[#EB5757] hover:bg-[#EB5757]/20"
                        : "border-[#4CB782]/30 bg-[#4CB782]/10 text-[#4CB782] hover:bg-[#4CB782]/20")
                    }
                  >
                    {value ? "Disable" : "Enable"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-5">
          <h2 className="text-sm font-semibold text-[#F7F8F8]">Feature flags</h2>
          <p className="mt-1 text-[10px] text-[#62666D]">
            Per-feature visibility. Stored as JSON in <code className="font-mono">admin_settings.feature_flags</code>.
          </p>
          <form action={updateSetting} className="mt-3 space-y-3">
            <input type="hidden" name="key" value="feature_flags" />
            <textarea
              name="value"
              defaultValue={JSON.stringify(featureFlags, null, 2)}
              rows={8}
              className="w-full rounded-md border border-[#23252A] bg-[#121316] p-3 font-mono text-xs text-[#F7F8F8] focus:border-[#E2E54B] focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-md bg-[#E2E54B] px-4 text-xs font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90"
            >
              Save feature flags
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-[#23252A] bg-[#0B0C0E] p-5">
          <h2 className="text-sm font-semibold text-[#F7F8F8]">LLM caps</h2>
          <p className="mt-1 text-[10px] text-[#62666D]">
            Per-spa request and token limits. Enforced in <code className="font-mono">/api/chat</code>.
          </p>
          <form action={updateSetting} className="mt-3 space-y-3">
            <input type="hidden" name="key" value="llm_caps" />
            <textarea
              name="value"
              defaultValue={JSON.stringify(llmCaps, null, 2)}
              rows={6}
              className="w-full rounded-md border border-[#23252A] bg-[#121316] p-3 font-mono text-xs text-[#F7F8F8] focus:border-[#E2E54B] focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-md bg-[#E2E54B] px-4 text-xs font-semibold text-[#08090A] transition hover:bg-[#E2E54B]/90"
            >
              Save LLM caps
            </button>
          </form>
        </section>
      </div>
    </>
  )
}
