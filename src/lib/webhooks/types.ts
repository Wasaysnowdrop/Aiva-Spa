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

// Numeric IP ranges we refuse to dial from the server. Complements the
// hostname checks in isValidWebhookUrl.
const PRIVATE_IPV4_RANGES: Array<[number, number]> = [
  // 10.0.0.0/8
  [ipToInt("10.0.0.0"), ipToInt("10.255.255.255")],
  // 172.16.0.0/12
  [ipToInt("172.16.0.0"), ipToInt("172.31.255.255")],
  // 192.168.0.0/16
  [ipToInt("192.168.0.0"), ipToInt("192.168.255.255")],
  // 127.0.0.0/8 (loopback)
  [ipToInt("127.0.0.0"), ipToInt("127.255.255.255")],
  // 169.254.0.0/16 (link-local)
  [ipToInt("169.254.0.0"), ipToInt("169.254.255.255")],
  // 0.0.0.0/8
  [ipToInt("0.0.0.0"), ipToInt("0.255.255.255")],
  // 100.64.0.0/10 (CGNAT)
  [ipToInt("100.64.0.0"), ipToInt("100.127.255.255")],
]

function ipToInt(ip: string): number {
  const parts = ip.split(".")
  if (parts.length !== 4) return -1
  let n = 0
  for (const p of parts) {
    const v = Number(p)
    if (!Number.isFinite(v) || v < 0 || v > 255) return -1
    n = (n << 8) | v
  }
  return n >>> 0
}

function isPrivateIPv4(host: string): boolean {
  const n = ipToInt(host)
  if (n < 0) return false
  return PRIVATE_IPV4_RANGES.some(([lo, hi]) => n >= lo && n <= hi)
}

function isPrivateIPv6(host: string): boolean {
  const h = host.toLowerCase().split("%")[0] ?? ""
  // Strip surrounding brackets just in case
  const bare = h.replace(/^\[|\]$/g, "")
  if (bare === "::1" || bare === "::") return true
  if (bare.startsWith("fe80:") || bare.startsWith("fe8") || bare.startsWith("fe9") || bare.startsWith("fea") || bare.startsWith("feb")) return true
  if (bare.startsWith("fc") || bare.startsWith("fd")) return true // fc00::/7 ULA
  if (bare.startsWith("ff")) return true // multicast
  return false
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
    // Numeric IP literals (IPv4 and IPv6) — refuse anything that looks
    // like an internal address. Note this does NOT defend against DNS
    // rebinding where a public hostname resolves to a private IP at
    // request time; deploy behind a network that does not allow outbound
    // to internal addresses for full protection.
    if (/^\d+(\.\d+){3}$/.test(host) && isPrivateIPv4(host)) return false
    if (host.includes(":") && isPrivateIPv6(host)) return false
    return true
  } catch {
    return false
  }
}
