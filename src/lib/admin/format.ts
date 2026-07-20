type Metadata = Record<string, unknown>

const text = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value : fallback

export function humanizeAction(action: string, metadata: Metadata = {}): string {
  if (/subscription.*plan/i.test(action)) {
    return `Plan changed from ${text(metadata.from, "previous plan")} to ${text(metadata.to, "new plan")}.`
  }

  const known: Record<string, string> = {
    "user.ban": "User access suspended.",
    "user.unban": "User access restored.",
    "user.promote_admin": "Administrator access granted.",
    "user.demote_admin": "Administrator access revoked.",
    "incident.resolve": "Incident marked resolved.",
    "incident.acknowledge": "Incident acknowledged.",
  }

  return known[action]
    ?? `${action.replaceAll(/[._]/g, " ").replace(/^./, (letter) => letter.toUpperCase())}.`
}
