/**
 * Hard-coded safety-net allowlist of emails that are allowed to be
 * considered admins, regardless of what `app_metadata.is_admin` says.
 * The `is_admin` flag in Supabase auth is the primary gate; this list
 * is a backstop so that even if a row is misconfigured in the database
 * we never grant admin to an untrusted email.
 *
 * Override at runtime by setting `ADMIN_ALLOWED_EMAILS` to a
 * comma-separated list of lowercase emails in the environment.
 */

const DEFAULT_ADMIN_EMAILS: readonly string[] = ["wffgaming188@gmail.com"]

export function getAdminEmailAllowlist(): Set<string> {
  const fromEnv = (process.env.ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const merged = new Set<string>(DEFAULT_ADMIN_EMAILS)
  for (const e of fromEnv) merged.add(e)
  return merged
}

export function isEmailAllowedAsAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return getAdminEmailAllowlist().has(email.trim().toLowerCase())
}
