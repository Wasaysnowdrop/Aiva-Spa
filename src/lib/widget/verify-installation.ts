import "server-only"

import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

export type WidgetVerificationStatus =
  | "installed"
  | "not_found"
  | "unreachable"
  | "blocked"
  | "invalid"
  | "timeout"
  | "unsupported_redirect"
  | "mismatch"
  | "incomplete"

export type WidgetVerificationResult = {
  success: boolean
  status: WidgetVerificationStatus
  scriptFound: boolean
  widgetIdMatched: boolean
  checkedUrl: string
  checkedAt: string
  message: string
  failureReason?: string
}

const MAX_REDIRECTS = 3
const MAX_BYTES = 750_000
const REQUEST_TIMEOUT_MS = 10_000
const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal", "metadata", "instance-data", "instance-data.ec2.internal"])

function ipv4Blocked(value: string): boolean {
  const parts = value.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b] = parts
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0)
  )
}

export function isBlockedNetworkAddress(value: string): boolean {
  const address = value.toLowerCase().split("%")[0]
  if (address.startsWith("::ffff:")) return ipv4Blocked(address.slice(7))
  if (isIP(address) === 4) return ipv4Blocked(address)
  if (isIP(address) === 6) {
    return address === "::" || address === "::1" || address.startsWith("fc") || address.startsWith("fd") ||
      address.startsWith("fe8") || address.startsWith("fe9") || address.startsWith("fea") || address.startsWith("feb") ||
      address.startsWith("ff") || address.startsWith("2001:db8")
  }
  return true
}

export function normalizePublicWebsiteUrl(input: string): URL {
  const trimmed = input.trim()
  if (!trimmed) throw new Error("INVALID_URL")
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url: URL
  try { url = new URL(candidate) } catch { throw new Error("INVALID_URL") }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("INVALID_URL")
  if (url.username || url.password || !url.hostname || url.port && !/^\d+$/.test(url.port)) throw new Error("INVALID_URL")
  url.hash = ""
  return url
}

export async function validatePublicDestination(url: URL): Promise<void> {
  if (url.username || url.password) throw new Error("BLOCKED_URL")
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "")
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".localhost") || !hostname.includes(".")) throw new Error("BLOCKED_URL")
  if (isIP(hostname)) {
    if (isBlockedNetworkAddress(hostname)) throw new Error("BLOCKED_URL")
    return
  }
  let addresses: { address: string }[]
  try { addresses = await lookup(hostname, { all: true, verbatim: true }) } catch { throw new Error("UNREACHABLE") }
  if (!addresses.length || addresses.some((entry) => isBlockedNetworkAddress(entry.address))) throw new Error("BLOCKED_URL")
}

export function inspectWidgetHtml(html: string, widgetId: string): { scriptFound: boolean; widgetIdMatched: boolean; clientRendered: boolean } {
  const escaped = widgetId.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&")
  const scriptTags = html.match(/<script\b[^>]*>/gi) ?? []
  const loaderTags = scriptTags.filter((tag) => /\bsrc\s*=\s*["'][^"']*\/embed\/[^/"']+\/loader(?:[?"'])/i.test(tag))
  const scriptFound = loaderTags.length > 0
  const widgetIdMatched = loaderTags.some((tag) =>
    new RegExp(`/embed/${escaped}/loader(?:[?'"])`, "i").test(tag) &&
    new RegExp(`data-spa-id\\s*=\\s*["']${escaped}["']`, "i").test(tag),
  )
  const strippedBody = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, "").trim() ?? ""
  const clientRendered = /__NEXT_DATA__|data-reactroot|id=["'](?:root|app)["']/i.test(html) && strippedBody.length < 80
  return { scriptFound, widgetIdMatched, clientRendered }
}

async function readLimitedHtml(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? 0)
  if (declared > MAX_BYTES) throw new Error("RESPONSE_TOO_LARGE")
  if (!response.body) return ""
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) { await reader.cancel(); throw new Error("RESPONSE_TOO_LARGE") }
    chunks.push(value)
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(merged)
}

export async function verifyWidgetInstallation(input: { url: string; widgetId: string }): Promise<WidgetVerificationResult> {
  const checkedAt = new Date().toISOString()
  let current: URL
  try { current = normalizePublicWebsiteUrl(input.url) } catch {
    return { success: false, status: "invalid", scriptFound: false, widgetIdMatched: false, checkedUrl: input.url.trim(), checkedAt, message: "Enter a valid public http or https website address.", failureReason: "invalid_url" }
  }
  const original = current.toString()
  if (process.env.NODE_ENV !== "production") console.info("WIDGET_CHECK_STARTED", { hostname: current.hostname })

  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      await validatePublicDestination(current)
      if (process.env.NODE_ENV !== "production") console.info("WIDGET_CHECK_URL_VALIDATED", { hostname: current.hostname, redirectCount })
      const requestStarted = Date.now()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      let response: Response
      try {
        response = await fetch(current, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: { "user-agent": "AivaSpa-InstallVerifier/1.0 (+https://aivaspa.online)", accept: "text/html,application/xhtml+xml;q=0.9" },
          cache: "no-store",
        })
      } catch (error) {
        if (error instanceof Error && (error.name === "AbortError" || /abort|timeout/i.test(error.message))) throw new Error("TIMEOUT")
        throw new Error("UNREACHABLE")
      } finally { clearTimeout(timer) }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")
        if (!location || redirectCount === MAX_REDIRECTS) throw new Error("UNSUPPORTED_REDIRECT")
        const next = new URL(location, current)
        if (next.protocol !== "http:" && next.protocol !== "https:") throw new Error("UNSUPPORTED_REDIRECT")
        current = next
        continue
      }
      if ([401, 403, 407, 429].includes(response.status)) throw new Error("REMOTE_BLOCKED")
      if (!response.ok) throw new Error("UNREACHABLE")
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
      if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        return { success: false, status: "incomplete", scriptFound: false, widgetIdMatched: false, checkedUrl: current.toString(), checkedAt, message: "We reached the website, but it did not return an HTML page.", failureReason: "non_html_response" }
      }
      const remainingMs = REQUEST_TIMEOUT_MS - (Date.now() - requestStarted)
      if (remainingMs <= 0) throw new Error("TIMEOUT")
      const bodyTimer = setTimeout(() => controller.abort(), remainingMs)
      let html: string
      try {
        html = await readLimitedHtml(response)
      } catch (error) {
        if (controller.signal.aborted || error instanceof Error && /abort|timeout/i.test(error.message)) throw new Error("TIMEOUT")
        throw error
      } finally {
        clearTimeout(bodyTimer)
      }
      const inspection = inspectWidgetHtml(html, input.widgetId)
      if (inspection.widgetIdMatched) {
        if (process.env.NODE_ENV !== "production") console.info("WIDGET_CHECK_SCRIPT_FOUND", { hostname: current.hostname })
        return { success: true, status: "installed", scriptFound: true, widgetIdMatched: true, checkedUrl: current.toString(), checkedAt, message: "AivaSpa is installed and the widget ID matches this business." }
      }
      if (inspection.scriptFound) {
        return { success: false, status: "mismatch", scriptFound: true, widgetIdMatched: false, checkedUrl: current.toString(), checkedAt, message: "We found AivaSpa code, but it belongs to a different widget. Replace it with the snippet shown in this guide.", failureReason: "widget_id_mismatch" }
      }
      if (process.env.NODE_ENV !== "production") console.info("WIDGET_CHECK_NOT_FOUND", { hostname: current.hostname, clientRendered: inspection.clientRendered })
      return inspection.clientRendered
        ? { success: false, status: "incomplete", scriptFound: false, widgetIdMatched: false, checkedUrl: current.toString(), checkedAt, message: "We couldn't confirm the installation automatically. Open the site in an incognito window and check whether the chat bubble appears.", failureReason: "client_rendered_page" }
        : { success: true, status: "not_found", scriptFound: false, widgetIdMatched: false, checkedUrl: current.toString(), checkedAt, message: "We couldn't find the AivaSpa widget code on this page." }
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNREACHABLE"
    if (reason === "BLOCKED_URL") {
      if (process.env.NODE_ENV !== "production") console.info("WIDGET_CHECK_BLOCKED", { hostname: current.hostname })
      return { success: false, status: "blocked", scriptFound: false, widgetIdMatched: false, checkedUrl: original, checkedAt, message: "For security, this checker can only access public websites.", failureReason: "private_or_internal_address" }
    }
    if (reason === "TIMEOUT") return { success: false, status: "timeout", scriptFound: false, widgetIdMatched: false, checkedUrl: current.toString(), checkedAt, message: "The website took too long to respond. Please try again.", failureReason: "request_timeout" }
    if (reason === "UNSUPPORTED_REDIRECT") return { success: false, status: "unsupported_redirect", scriptFound: false, widgetIdMatched: false, checkedUrl: current.toString(), checkedAt, message: "The website redirected too many times or used an unsupported destination.", failureReason: "unsupported_redirect" }
    if (reason === "REMOTE_BLOCKED") return { success: false, status: "blocked", scriptFound: false, widgetIdMatched: false, checkedUrl: current.toString(), checkedAt, message: "The website blocked the automated check. Open it in an incognito window and confirm the bubble manually.", failureReason: "remote_site_blocked" }
    return { success: false, status: "unreachable", scriptFound: false, widgetIdMatched: false, checkedUrl: current.toString(), checkedAt, message: "We couldn't access this website. Check that it is online and publicly available.", failureReason: reason.toLowerCase() }
  }
  return { success: false, status: "incomplete", scriptFound: false, widgetIdMatched: false, checkedUrl: original, checkedAt, message: "We couldn't complete the installation check.", failureReason: "check_incomplete" }
}
