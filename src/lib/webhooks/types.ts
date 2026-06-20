export const WEBHOOK_EVENTS = [
  "lead.created",
  "lead.updated",
  "lead.merged",
  "lead.deleted",
  "conversation.started",
  "conversation.completed",
] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

export type Webhook = {
  id: string
  userId: string
  url: string
  secret: string
  events: WebhookEvent[]
  active: boolean
  description: string
  createdAt: string
  updatedAt: string
}

export type DeliveryResult = {
  ok: boolean
  status?: number
  body?: string
  error?: string
  durationMs: number
}

export function isValidWebhookUrl(url: string) {
  try {
    const u = new URL(url)
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    const host = u.hostname.toLowerCase()
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local") ||
      host.endsWith(".internal")
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}
