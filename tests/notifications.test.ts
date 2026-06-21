import { describe, expect, it, vi, beforeEach } from "vitest"

import {
  sendEmail,
  isEmailConfigured,
  buildWelcomeEmail,
  buildDailySummaryEmail,
} from "@/lib/notifications/email"

describe("email (mocked Resend)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete process.env.RESEND_API_KEY
  })

  it("logs when not configured and reports ok=false so dispatch records 'failed'", async () => {
    // Unconfigured Resend must not look like a successful send — otherwise
    // the dispatcher writes notification_logs.status = "delivered" and
    // operators lose leads silently. See sendEmailLogOnly in
    // src/lib/notifications/email.ts.
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {})
    expect(isEmailConfigured()).toBe(false)
    const res = await sendEmail({
      to: "alex@example.com",
      subject: "Hi",
      text: "body",
    })
    expect(res.ok).toBe(false)
    expect(res.provider).toBe("log")
    expect(res.error).toMatch(/not configured/i)
    expect(logSpy).toHaveBeenCalled()
  })

  it("calls Resend when configured", async () => {
    process.env.RESEND_API_KEY = "test-key"
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "abc" }), { status: 200 }))
    const res = await sendEmail({
      to: "alex@example.com",
      subject: "New lead",
      text: "Body",
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(res.ok).toBe(true)
    expect(res.provider).toBe("resend")
    expect(res.id).toBe("abc")
  })

  it("captures Resend errors as a failed result", async () => {
    process.env.RESEND_API_KEY = "test-key"
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("forbidden", { status: 403, statusText: "Forbidden" }),
    )
    const res = await sendEmail({ to: "x@y.com", subject: "x", text: "y" })
    expect(res.ok).toBe(false)
    expect(res.provider).toBe("resend")
    expect(res.error).toMatch(/resend 403/)
  })
})

describe("welcome email template", () => {
  it("renders a personalized, dark-themed welcome", () => {
    const out = buildWelcomeEmail({
      fullName: "Alex Morgan",
      spaName: "Glow Med Spa",
      loginUrl: "https://aivaspa.com/login",
    })
    expect(out.subject).toBe("Welcome to AivaSpa, Alex!")
    expect(out.text).toContain("Hi Alex,")
    expect(out.text).toContain("Glow Med Spa")
    expect(out.html).toContain("Welcome aboard")
    expect(out.html).toContain("Alex")
    expect(out.html).toContain("Open my dashboard")
    expect(out.html).toContain("https://aivaspa.com/login")
    // Branded dark theme tokens present
    expect(out.html).toContain("#E2E54B")
    expect(out.html).toContain("#08090A")
    // Escaping sanity check — fullName containing markup is safe
    const evil = buildWelcomeEmail({ fullName: "<script>alert(1)</script>Alex" })
    expect(evil.html).not.toContain("<script>alert(1)</script>")
    expect(evil.html).toContain("&lt;script&gt;")
  })
})

describe("daily summary email template", () => {
  it("renders an empty-state when no leads captured", () => {
    const out = buildDailySummaryEmail({
      brandName: "Glow Med Spa",
      recipientName: "Alex Morgan",
      date: "Mon, Jun 16",
      totalLeads: 0,
      newLeads: 0,
      contacted: 0,
      booked: 0,
      conversations: 4,
      afterHours: 0,
      topService: null,
      leads: [],
    })
    expect(out.subject).toContain("Glow Med Spa")
    expect(out.subject).toContain("Mon, Jun 16")
    expect(out.html).toContain("Good morning, Alex")
    expect(out.html).toContain("No leads captured yesterday")
    expect(out.text).toContain("Total leads:    0")
    expect(out.text).toContain("Conversations:  4")
  })

  it("renders lead rows + top service for a busy day", () => {
    const out = buildDailySummaryEmail({
      brandName: "Glow Med Spa",
      recipientName: "Alex",
      date: "Tue, Jun 17",
      totalLeads: 3,
      newLeads: 2,
      contacted: 1,
      booked: 1,
      conversations: 9,
      afterHours: 1,
      topService: "Botox",
      leads: [
        { name: "Jamie L.", service: "Botox", preferredTime: "Sat 2 PM", source: "Website Chat", status: "booked", createdAt: "2026-06-17T15:00:00Z" },
        { name: "Priya R.", service: "Lip Filler", preferredTime: "Wed AM", source: "Website Chat", status: "new", createdAt: "2026-06-17T11:00:00Z" },
        { name: "Sam K.", service: "Botox", preferredTime: "Fri evening", source: "Website Chat", status: "new", createdAt: "2026-06-17T09:30:00Z" },
      ],
    })
    expect(out.html).toContain("Jamie L.")
    expect(out.html).toContain("Priya R.")
    expect(out.html).toContain("Botox")
    expect(out.html).toContain("booked")
    expect(out.text).toContain("Top service:    Botox")
    expect(out.text).toContain("Jamie L.")
  })

  it("escapes malicious lead names", () => {
    const out = buildDailySummaryEmail({
      brandName: "Glow Med Spa",
      date: "Tue, Jun 17",
      totalLeads: 1,
      newLeads: 1,
      contacted: 0,
      booked: 0,
      conversations: 1,
      afterHours: 0,
      topService: "Botox",
      leads: [
        { name: "<img src=x onerror=alert(1)>", service: "Botox", preferredTime: "Today", source: "Website Chat", status: "new", createdAt: "" },
      ],
    })
    expect(out.html).not.toContain("<img src=x onerror=alert(1)>")
    expect(out.html).toContain("&lt;img")
  })
})
