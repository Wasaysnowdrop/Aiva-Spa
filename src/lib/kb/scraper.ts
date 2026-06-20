/**
 * Lightweight HTML scraper for the Knowledge Base onboarding flow.
 *
 * The owner pastes their med spa website URL and we pull:
 *   - brand name (title / og:title)
 *   - tagline / description (meta description / og:description)
 *   - services (heading + body + optional price/duration heuristics)
 *   - FAQs (Q/A pairs from FAQPage schema, headings, or dt/dd pairs)
 *
 * No third-party deps — we parse the HTML with a small set of regexes that
 * strip scripts/styles, then walk the text. That's plenty for the typical
 * med spa site (a handful of pages of plain HTML) and avoids pulling in
 * a new top-level dep.
 */

export type ScrapedService = {
  name: string
  description: string
  pricingRule: string
  duration: string
  category: string
}

export type ScrapedFaq = {
  question: string
  answer: string
  category: string
}

export type ScrapedKnowledge = {
  url: string
  brandName: string
  tagline: string
  services: ScrapedService[]
  faqs: ScrapedFaq[]
  fetchedAt: string
}

const SERVICE_CATEGORIES = ["Injectables", "Skin", "Body", "Laser"] as const

const PRICE_RE = /(?:[$€£¥]\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s?(?:USD|EUR|GBP|CAD|AUD)|\b(?:starts? at|from)\b\s?[$€£]?\s?\d[\d,]*(?:\.\d{1,2})?)/i

const DURATION_RE = /\b(\d{1,3})\s?(?:min(?:ute)?s?|hrs?|hours?|h|m)\b/i

const FAQ_LIKE_RE = /(^|\s)(how|what|when|where|why|do|does|is|are|can|could|should|will|would|may|might|should)\b[^.!?\n]{4,160}\?/i

const KNOWN_SERVICE_HINTS = [
  "botox",
  "dysport",
  "xeomin",
  "jeuveau",
  "filler",
  "fillers",
  "juvederm",
  "restylane",
  "sculptra",
  "radiesse",
  "kysse",
  "versa",
  "hydrafacial",
  "microderm",
  "microdermabrasion",
  "chemical peel",
  "peel",
  "laser",
  "ipl",
  "microneedling",
  "rf",
  "radiofrequency",
  "cool sculpting",
  "coolsculpting",
  "emsculpt",
  "kybella",
  "prp",
  "prf",
  "facial",
  "facials",
  "bbl",
  "morpheus",
  "clear and brilliant",
  "thermage",
  "ultherapy",
  "lip flip",
  "lip filler",
  "cheek filler",
  "chin filler",
  "temple filler",
  "undereye filler",
  "tear trough",
  "consultation",
  "consult",
  "treatment",
  "skin care",
  "skincare",
  "dermaplaning",
  "led",
  "led therapy",
  "vitamin shot",
  "b12",
  "weight loss",
  "semaglutide",
  "tirzepatide",
]

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n)
      return Number.isFinite(code) ? String.fromCharCode(code) : " "
    })
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
}

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, " ")
}

function collapseWhitespace(input: string): string {
  return input
    .replace(/\u00a0/g, " ")
    .replace(/[\t\r]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \u00a0]{2,}/g, " ")
    .trim()
}

function safeSlice(input: string, max: number): string {
  if (input.length <= max) return input
  const cut = input.slice(0, max)
  const lastSpace = cut.lastIndexOf(" ")
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + "…"
}

function extractMeta(html: string, re: RegExp): string {
  const m = html.match(re)
  return m ? decodeEntities(stripTags(m[1]).trim()) : ""
}

function findTitle(html: string): string {
  const og = extractMeta(html, /<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
  if (og) return og
  const tw = extractMeta(html, /<meta\s+[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i)
  if (tw) return tw
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (t) return collapseWhitespace(decodeEntities(t[1]))
  return ""
}

function findDescription(html: string): string {
  const og = extractMeta(html, /<meta\s+[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
  if (og) return og
  const md = extractMeta(html, /<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
  if (md) return md
  return ""
}

function stripScriptsAndStyles(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
}

function extractSchemaFaqs(html: string): { question: string; answer: string }[] {
  const out: { question: string; answer: string }[] = []
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )
  for (const b of blocks) {
    try {
      const json = JSON.parse(b[1])
      collectFaqFromJsonLd(json, out)
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return out
}

function collectFaqFromJsonLd(
  node: unknown,
  out: { question: string; answer: string }[],
): void {
  if (!node || typeof node !== "object") return
  if (Array.isArray(node)) {
    for (const n of node) collectFaqFromJsonLd(n, out)
    return
  }
  const obj = node as Record<string, unknown>
  const type = obj["@type"]
  if (type === "FAQPage" && Array.isArray(obj.mainEntity)) {
    for (const q of obj.mainEntity) {
      const r = q as Record<string, unknown>
      if (r["@type"] === "Question" && typeof r.name === "string") {
        const accepted = r.acceptedAnswer as Record<string, unknown> | undefined
        const ans = (accepted?.text as string | undefined) ?? ""
        if (ans) out.push({ question: r.name, answer: ans })
      }
    }
  } else if (type === "Question" && typeof obj.name === "string") {
    const accepted = obj.acceptedAnswer as Record<string, unknown> | undefined
    const ans = (accepted?.text as string | undefined) ?? ""
    if (ans) out.push({ question: obj.name, answer: ans })
  } else if (type === "Service" && typeof obj.name === "string") {
    // service schema is not a FAQ but might be picked up; ignore here
  } else if (Array.isArray(obj["@graph"])) {
    for (const n of obj["@graph"]) collectFaqFromJsonLd(n, out)
  }
}

function findHeadingsAndParagraphs(html: string): { tag: "h1" | "h2" | "h3" | "p" | "li"; text: string }[] {
  const cleaned = stripScriptsAndStyles(html)
  const out: { tag: "h1" | "h2" | "h3" | "p" | "li"; text: string }[] = []
  const re = /<(h1|h2|h3|p|li)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(cleaned)) !== null) {
    const tag = m[1].toLowerCase() as "h1" | "h2" | "h3" | "p" | "li"
    const text = collapseWhitespace(decodeEntities(stripTags(m[2])))
    if (text.length >= 2 && text.length <= 800) {
      out.push({ tag, text })
    }
  }
  return out
}

function findFaqPairs(html: string): { question: string; answer: string }[] {
  const out: { question: string; answer: string }[] = []
  // 1. <dt>question</dt> <dd>answer</dd>
  const dtRe = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi
  let m: RegExpExecArray | null
  while ((m = dtRe.exec(html)) !== null) {
    const q = collapseWhitespace(decodeEntities(stripTags(m[1])))
    const a = collapseWhitespace(decodeEntities(stripTags(m[2])))
    if (q && a && q.length < 300 && a.length < 1500) {
      out.push({ question: q, answer: a })
    }
  }
  // 2. <details><summary>question</summary>answer</details>
  const detRe = /<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi
  while ((m = detRe.exec(html)) !== null) {
    const q = collapseWhitespace(decodeEntities(stripTags(m[1])))
    const a = collapseWhitespace(decodeEntities(stripTags(m[2])))
    if (q && a && q.length < 300 && a.length < 1500) {
      out.push({ question: q, answer: a })
    }
  }
  return out
}

function pickFaqCategory(question: string): string {
  const q = question.toLowerCase()
  if (/\b(price|cost|how much|charge|fee|package|discount)\b/.test(q)) return "Pricing"
  if (/\b(book|appointment|consult|schedule|reschedul|cancel\w*)\b/i.test(q)) return "Booking"
  if (/\b(safe|risk|side|allerg|pregnan|aftercare|recovery)\b/.test(q)) return "Safety"
  if (/\b(hours|open|close|location|address|parking|where)\b/.test(q)) return "Hours"
  return "General"
}

function guessServiceCategory(name: string): string {
  const n = name.toLowerCase()
  if (/(botox|dysport|xeomin|jeuveau|filler|fillers|juvederm|restylane|sculptra|radiesse|kybella|prp|prf|lip|cheek|chin|temple|undereye|tear|nasolabial)/.test(n)) {
    return "Injectables"
  }
  if (/(laser|ipl|bbl|morpheus|thermage|ultherapy|coolsculpting|cool sculpting|emsculpt|clear and brilliant|rf|radio ?frequency)/.test(n)) {
    return "Laser"
  }
  if (/(body|weight|semaglutide|tirzepatide|emsculpt|sculpting|contour)/.test(n)) {
    return "Body"
  }
  return "Skin"
}

function looksLikeServiceName(text: string): boolean {
  const lower = text.toLowerCase()
  if (lower.length < 3 || lower.length > 60) return false
  if (FAQ_LIKE_RE.test(lower)) return false
  if (lower.includes("?")) return false
  return KNOWN_SERVICE_HINTS.some((h) => lower.includes(h))
}

export function extractKnowledgeFromHtml(html: string, url: string): ScrapedKnowledge {
  const brandName = findTitle(html)
  const tagline = findDescription(html)
  const blocks = findHeadingsAndParagraphs(html)
  const schemaFaqs = extractSchemaFaqs(html)
  const dtFaqs = findFaqPairs(html)

  // ----- Services -----
  const serviceMap = new Map<string, ScrapedService>()
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.tag !== "h2" && b.tag !== "h3") continue
    if (!looksLikeServiceName(b.text)) continue
    const name = safeSlice(b.text.replace(/\s*[:\-–—|].*$/, "").trim(), 80)
    if (serviceMap.has(name.toLowerCase())) continue
    const descriptionParts: string[] = []
    let pricingRule = ""
    let duration = ""
    for (let j = i + 1; j < blocks.length && blocks[j].tag !== "h2" && blocks[j].tag !== "h3"; j++) {
      const t = blocks[j].text
      if (!t) continue
      if (!pricingRule) {
        const pm = t.match(PRICE_RE)
        if (pm) pricingRule = pm[0]
      }
      if (!duration) {
        const dm = t.match(DURATION_RE)
        if (dm) duration = dm[0]
      }
      if (descriptionParts.length < 4) descriptionParts.push(safeSlice(t, 220))
      if (descriptionParts.length >= 2 && pricingRule && duration) break
    }
    const description = descriptionParts.join(" ").trim()
    serviceMap.set(name.toLowerCase(), {
      name,
      description,
      pricingRule: pricingRule || "Confirmed at consultation",
      duration,
      category: guessServiceCategory(name),
    })
  }

  // Also pick up menu items from <li> lines that include a price
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.tag !== "li") continue
    if (b.text.length < 3 || b.text.length > 120) continue
    const priceMatch = b.text.match(PRICE_RE)
    if (!priceMatch) continue
    const name = safeSlice(b.text.replace(PRICE_RE, "").replace(/[\s:.\-–—]+$/g, "").trim(), 80)
    if (!name || name.length < 3) continue
    const key = name.toLowerCase()
    if (serviceMap.has(key)) {
      const existing = serviceMap.get(key)!
      if (existing.pricingRule === "Confirmed at consultation") {
        serviceMap.set(key, { ...existing, pricingRule: priceMatch[0] })
      }
      continue
    }
    if (looksLikeServiceName(name) || /^[A-Z]/.test(name)) {
      serviceMap.set(key, {
        name,
        description: "",
        pricingRule: priceMatch[0],
        duration: "",
        category: guessServiceCategory(name),
      })
    }
  }

  // ----- FAQs -----
  const faqMap = new Map<string, ScrapedFaq>()
  for (const f of [...schemaFaqs, ...dtFaqs]) {
    const q = collapseWhitespace(decodeEntities(f.question))
    const a = collapseWhitespace(decodeEntities(f.answer))
    if (!q || !a) continue
    if (q.length < 5 || a.length < 10) continue
    const key = q.toLowerCase()
    if (faqMap.has(key)) continue
    faqMap.set(key, { question: q, answer: safeSlice(a, 1200), category: pickFaqCategory(q) })
  }

  // Heuristic FAQ extraction from headings + following paragraph
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.tag === "h3" && b.text.includes("?") && b.text.length < 200) {
      const answer = blocks[i + 1]
      if (answer && answer.tag === "p" && answer.text.length > 20) {
        const key = b.text.toLowerCase()
        if (!faqMap.has(key)) {
          faqMap.set(key, {
            question: b.text,
            answer: safeSlice(answer.text, 1200),
            category: pickFaqCategory(b.text),
          })
        }
      }
    }
  }

  return {
    url,
    brandName: safeSlice(brandName, 120),
    tagline: safeSlice(tagline, 240),
    services: Array.from(serviceMap.values()).slice(0, 50),
    faqs: Array.from(faqMap.values()).slice(0, 80),
    fetchedAt: new Date().toISOString(),
  }
}

export type FetchResult = { ok: true; html: string; finalUrl: string } | { ok: false; error: string }

const USER_AGENT =
  "Mozilla/5.0 (compatible; AivaSpaBot/1.0; +https://aivaspa.online/bot) AppleWebKit/537.36"

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"])

export async function fetchHtml(inputUrl: string, opts: { timeoutMs?: number } = {}): Promise<FetchResult> {
  const raw = (inputUrl || "").trim()
  if (!raw) return { ok: false, error: "URL is required" }
  // Reject anything that already names a non-http(s) protocol (file:, ftp:, …)
  // before we try to URL-parse — the URL constructor is lenient and would
  // happily turn "file:///etc/passwd" into a valid https URL.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) {
    return { ok: false, error: "Only http and https URLs are supported" }
  }
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return { ok: false, error: "Invalid URL" }
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, error: "Only http and https URLs are supported" }
  }
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "0.0.0.0") {
    return { ok: false, error: "Local addresses are not allowed" }
  }

  const timeout = Math.min(Math.max(opts.timeoutMs ?? 8000, 1000), 15000)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.8",
      },
    })
    if (!res.ok) {
      return { ok: false, error: `Fetch failed: HTTP ${res.status}` }
    }
    const ct = res.headers.get("content-type") || ""
    if (ct && !/text\/html|application\/xhtml/i.test(ct)) {
      return { ok: false, error: "URL did not return HTML" }
    }
    const finalUrl = res.url || url.toString()
    const html = await res.text()
    if (html.length > 5_000_000) {
      return { ok: false, error: "Page is too large to scan (5MB limit)" }
    }
    return { ok: true, html, finalUrl }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "Fetch timed out" }
    }
    return { ok: false, error: e instanceof Error ? e.message : "Fetch failed" }
  } finally {
    clearTimeout(timer)
  }
}

export async function scrapeKnowledgeFromUrl(inputUrl: string): Promise<
  | { ok: true; data: ScrapedKnowledge }
  | { ok: false; error: string }
> {
  const fetched = await fetchHtml(inputUrl)
  if (!fetched.ok) return fetched
  try {
    const data = extractKnowledgeFromHtml(fetched.html, fetched.finalUrl)
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to parse page" }
  }
}

export function describeScrapedKnowledge(data: ScrapedKnowledge): string {
  return [
    `${data.services.length} service${data.services.length === 1 ? "" : "s"}`,
    `${data.faqs.length} FAQ${data.faqs.length === 1 ? "" : "s"}`,
    data.brandName ? `brand: ${data.brandName}` : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

export { SERVICE_CATEGORIES }
