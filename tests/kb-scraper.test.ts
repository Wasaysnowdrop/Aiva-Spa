import { describe, expect, it } from "vitest"

import {
  extractKnowledgeFromHtml,
  scrapeKnowledgeFromUrl,
  type ScrapedKnowledge,
} from "@/lib/kb/scraper"

const FIXTURE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Glow Med Spa — Botox, Fillers & Facials in San Francisco</title>
  <meta name="description" content="Glow Med Spa offers Botox, dermal fillers, and HydraFacial in San Francisco. Book a free consult." />
  <meta property="og:title" content="Glow Med Spa" />
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "How much is Botox?", "acceptedAnswer": { "@type": "Answer", "text": "Botox is priced per unit, confirmed at your consultation." } },
        { "@type": "Question", "name": "Do you take walk-ins?", "acceptedAnswer": { "@type": "Answer", "text": "We are by appointment only." } }
      ]
    }
  </script>
</head>
<body>
  <h1>Glow Med Spa</h1>

  <h2>Botox</h2>
  <p>Neuromodulator for fine lines and wrinkles. Lasts 3-4 months.</p>
  <p>Pricing: $13 per unit. Sessions take about 20 minutes.</p>

  <h2>Dermal Fillers</h2>
  <p>Restylane and Juvederm. Adds volume to lips and cheeks.</p>
  <p>Starts at $650 per syringe. Typical session: 45 minutes.</p>

  <h2>HydraFacial</h2>
  <p>Deep cleansing and hydration in three steps.</p>
  <p>$199 per session. 50 minutes.</p>

  <h2>Hours & Location</h2>
  <p>We're open Monday to Friday, 9am to 7pm, and Saturday 10am to 5pm.</p>

  <h3>How long does Botox last?</h3>
  <p>Results typically last 3-4 months. Individual results vary by metabolism and area treated.</p>

  <h3>Is there any downtime after fillers?</h3>
  <p>Most people return to normal activities right after. Mild swelling can last 24-48 hours.</p>

  <h3>What is your cancellation policy?</h3>
  <p>We ask for 24 hours notice. Late cancellations may incur a $25 fee.</p>

  <dt>Do you offer financing?</dt>
  <dd>Yes — we partner with Cherry and CareCredit for 0% APR plans on packages over $500.</dd>

  <ul>
    <li>Botox touch-up: $13/unit</li>
    <li>Lip flip: $99</li>
    <li>Kysse filler: $850</li>
  </ul>
</body>
</html>`

describe("kb/scraper — extractKnowledgeFromHtml", () => {
  it("extracts brand name from <title> and meta description", () => {
    const out = extractKnowledgeFromHtml(FIXTURE_HTML, "https://example.com")
    expect(out.brandName).toMatch(/Glow Med Spa/)
    expect(out.tagline).toMatch(/Botox/)
  })

  it("extracts services from h2/h3 headings with description and pricing", () => {
    const out = extractKnowledgeFromHtml(FIXTURE_HTML, "https://example.com")
    const botox = out.services.find((s) => s.name.toLowerCase() === "botox")
    expect(botox).toBeDefined()
    expect(botox?.description).toMatch(/Neuromodulator/)
    expect(botox?.pricingRule).toMatch(/13/)
    expect(botox?.duration).toMatch(/20/)
    expect(botox?.category).toBe("Injectables")
  })

  it("extracts fillers, HydraFacial with prices and durations", () => {
    const out = extractKnowledgeFromHtml(FIXTURE_HTML, "https://example.com")
    const fillers = out.services.find((s) => /filler/i.test(s.name))
    expect(fillers).toBeDefined()
    expect(fillers?.pricingRule).toMatch(/650|Starts/i)
    const hydra = out.services.find((s) => /hydrafacial/i.test(s.name))
    expect(hydra).toBeDefined()
    expect(hydra?.pricingRule).toMatch(/199/)
  })

  it("extracts FAQs from JSON-LD schema", () => {
    const out = extractKnowledgeFromHtml(FIXTURE_HTML, "https://example.com")
    const pricing = out.faqs.find((f) => /how much is botox/i.test(f.question))
    expect(pricing).toBeDefined()
    expect(pricing?.answer).toMatch(/per unit/)
    expect(pricing?.category).toBe("Pricing")
    const walkin = out.faqs.find((f) => /walk-ins/i.test(f.question))
    expect(walkin).toBeDefined()
  })

  it("extracts FAQs from dt/dd pairs", () => {
    const out = extractKnowledgeFromHtml(FIXTURE_HTML, "https://example.com")
    const fin = out.faqs.find((f) => /financing/i.test(f.question))
    expect(fin).toBeDefined()
    expect(fin?.answer).toMatch(/Cherry|CareCredit/)
  })

  it("extracts FAQs from h3 question + following paragraph", () => {
    const out = extractKnowledgeFromHtml(FIXTURE_HTML, "https://example.com")
    const last = out.faqs.find((f) => /how long does botox last/i.test(f.question))
    expect(last).toBeDefined()
    expect(last?.answer).toMatch(/3-4 months/)
    const cancel = out.faqs.find((f) => /cancellation/i.test(f.question))
    expect(cancel).toBeDefined()
    expect(cancel?.category).toBe("Booking")
  })

  it("captures menu-style services from list items with prices", () => {
    const out = extractKnowledgeFromHtml(FIXTURE_HTML, "https://example.com")
    const lipFlip = out.services.find((s) => /lip flip/i.test(s.name))
    expect(lipFlip).toBeDefined()
    expect(lipFlip?.pricingRule).toMatch(/99/)
  })

  it("ignores empty or very short scripts and styles", () => {
    const html = `<html><head><title>X</title><meta name="description" content="t"/></head><body><h2>Botox</h2><p>Quick info.</p><script>var x=1;</script><style>body{}</style></body></html>`
    const out = extractKnowledgeFromHtml(html, "https://x")
    expect(out.brandName).toBe("X")
    expect(out.services[0]?.name).toBe("Botox")
  })

  it("returns an empty result for a blank page", () => {
    const out = extractKnowledgeFromHtml("<html><body></body></html>", "https://x")
    expect(out.services).toEqual([])
    expect(out.faqs).toEqual([])
  })

  it("caps services and faqs to a sensible maximum", () => {
    const blocks = Array.from({ length: 200 }, (_, i) => `<h2>Botox ${i}</h2><p>Treats lines ${i}. $${100 + i}. 20 min.</p>`).join("")
    const html = `<html><head><title>X</title></head><body>${blocks}</body></html>`
    const out = extractKnowledgeFromHtml(html, "https://x")
    expect(out.services.length).toBeLessThanOrEqual(50)
  })

  it("decodes common HTML entities in titles and answers", () => {
    const html = `<html><head><title>Glow &amp; Co &#8212; Botox</title><meta name="description" content="Botox &amp; fillers &mdash; the best"/></head><body>
      <script type="application/ld+json">{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is it?","acceptedAnswer":{"@type":"Answer","text":"It&apos;s a treatment &mdash; safe &amp; effective."}}]}</script>
    </body></html>`
    const out = extractKnowledgeFromHtml(html, "https://x")
    expect(out.brandName).toContain("&")
    expect(out.brandName).toContain("—")
    expect(out.faqs[0]?.answer).toContain("'")
    expect(out.faqs[0]?.answer).toContain("&")
  })
})

describe("kb/scraper — URL validation", () => {
  it("rejects an empty URL", async () => {
    const r = await scrapeKnowledgeFromUrl("")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/required/i)
  })

  it("rejects local hostnames", async () => {
    const r = await scrapeKnowledgeFromUrl("https://localhost:3000/anything")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/local/i)
  })

  it("rejects non-http(s) protocols (file:, ftp:, …)", async () => {
    const r = await scrapeKnowledgeFromUrl("file:///etc/passwd")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/http/i)
  })
})

describe("kb/scraper — fixture format", () => {
  it("returns a deterministic shape", () => {
    const out: ScrapedKnowledge = extractKnowledgeFromHtml(FIXTURE_HTML, "https://example.com")
    expect(typeof out.brandName).toBe("string")
    expect(typeof out.tagline).toBe("string")
    expect(Array.isArray(out.services)).toBe(true)
    expect(Array.isArray(out.faqs)).toBe(true)
    for (const s of out.services) {
      expect(typeof s.name).toBe("string")
      expect(typeof s.description).toBe("string")
      expect(typeof s.pricingRule).toBe("string")
      expect(typeof s.duration).toBe("string")
      expect(typeof s.category).toBe("string")
    }
    for (const f of out.faqs) {
      expect(typeof f.question).toBe("string")
      expect(typeof f.answer).toBe("string")
      expect(typeof f.category).toBe("string")
    }
  })
})
