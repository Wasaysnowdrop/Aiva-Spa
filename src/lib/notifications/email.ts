export type EmailMessage = {
  to: string | string[]
  subject: string
  text: string
  html?: string
  from?: string
  replyTo?: string
}

export type EmailSendResult = {
  ok: boolean
  provider: "resend" | "smtp" | "log"
  id?: string
  error?: string
}

const RESEND_ENDPOINT = "https://api.resend.com/emails"

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export function getResendConfigDiagnostic() {
  const from = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || ""
  const address = (from.match(/<([^>]+)>/)?.[1] ?? from).trim()
  const domain = address.includes("@") ? address.split("@").pop() ?? null : null
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || ""
  return {
    enabled: process.env.RESEND_CONFIG_CHECK === "true",
    apiKeyPresent: Boolean(process.env.RESEND_API_KEY),
    fromEmailPresent: Boolean(from),
    appUrlPresent: Boolean(appUrl),
    senderDomain: domain,
    senderLooksProductionReady: Boolean(domain && domain !== "resend.dev"),
  }
}

export async function sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
  if (!isEmailConfigured()) {
    return sendEmailLogOnly(msg)
  }

  const from = msg.from || process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || "AivaSpa <alerts@aivaspa.com>"
  const payload = {
    from,
    to: Array.isArray(msg.to) ? msg.to : [msg.to],
    subject: msg.subject,
    text: msg.text,
    ...(msg.html ? { html: msg.html } : {}),
    ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => "")
      return { ok: false, provider: "resend", error: `resend ${res.status}: ${err.slice(0, 200)}` }
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return { ok: true, provider: "resend", id: data.id }
  } catch (err) {
    return {
      ok: false,
      provider: "resend",
      error: err instanceof Error ? err.message : "send failed",
    }
  }
}

async function sendEmailLogOnly(msg: EmailMessage): Promise<EmailSendResult> {
  const recipients = Array.isArray(msg.to) ? msg.to.join(", ") : msg.to
  console.info(
    `[email:log-only] to=${recipients} subject=${JSON.stringify(msg.subject)}`,
  )
  // Log-only mode means the operator hasn't configured Resend yet. Surface
  // that as a non-delivered result so dispatch.ts records `failed` (not
  // `delivered`) in notification_logs — otherwise owners will think emails
  // are being sent when they aren't.
  return {
    ok: false,
    provider: "log",
    error: "email provider not configured (set RESEND_API_KEY)",
  }
}

export function buildLeadNotificationEmail(input: {
  brandName: string
  leadName: string
  service: string
  preferredTime: string
  phone: string
  email: string
  sourceUrl: string
  afterHours: boolean
  transcriptExcerpt?: string
}): { subject: string; text: string; html: string } {
  const subject = `New ${input.service} lead — ${input.leadName}`
  const text = [
    `${input.brandName}: new consultation request`,
    ``,
    `Name:        ${input.leadName}`,
    `Phone:       ${input.phone}`,
    `Email:       ${input.email}`,
    `Service:     ${input.service}`,
    `Preferred:   ${input.preferredTime}`,
    `Source URL:  ${input.sourceUrl}`,
    `After hours: ${input.afterHours ? "yes" : "no"}`,
    ``,
    input.transcriptExcerpt
      ? `Conversation excerpt:\n${input.transcriptExcerpt}\n`
      : ``,
    `Open the dashboard to follow up: ${process.env.NEXT_PUBLIC_SITE_URL || "https://aivaspa.com"}/dashboard/leads`,
  ].join("\n")

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#08090A; color:#F7F8F8; padding:24px;">
<div style="max-width:560px; margin:0 auto; background:#121316; border:1px solid #23252A; border-radius:16px; padding:24px;">
  <div style="display:flex; align-items:center; gap:10px; margin-bottom:18px;">
    <div style="width:32px; height:32px; border-radius:10px; background:#E2E54B; color:#08090A; display:flex; align-items:center; justify-content:center; font-weight:700;">A</div>
    <div>
      <div style="font-weight:700; font-size:16px;">${escapeHtml(input.brandName)} · New lead</div>
      <div style="font-size:12px; color:#8A8F98;">Captured by AivaSpa AI receptionist</div>
    </div>
  </div>
  <h1 style="margin:0 0 8px 0; font-size:22px;">${escapeHtml(input.leadName)}</h1>
  <p style="margin:0 0 18px 0; color:#8A8F98; font-size:14px;">Interested in <strong style="color:#F7F8F8;">${escapeHtml(input.service)}</strong> · preferred ${escapeHtml(input.preferredTime)}</p>
  <table style="width:100%; border-collapse:collapse; font-size:14px;">
    <tr><td style="padding:6px 0; color:#8A8F98; width:120px;">Phone</td><td style="padding:6px 0;"><a href="tel:${escapeAttr(input.phone)}" style="color:#F7F8F8;">${escapeHtml(input.phone)}</a></td></tr>
    <tr><td style="padding:6px 0; color:#8A8F98;">Email</td><td style="padding:6px 0;"><a href="mailto:${escapeAttr(input.email)}" style="color:#F7F8F8;">${escapeHtml(input.email)}</a></td></tr>
    <tr><td style="padding:6px 0; color:#8A8F98;">Source</td><td style="padding:6px 0; color:#F7F8F8;">${escapeHtml(input.sourceUrl)}</td></tr>
    <tr><td style="padding:6px 0; color:#8A8F98;">After hours</td><td style="padding:6px 0; color:#F7F8F8;">${input.afterHours ? "Yes" : "No"}</td></tr>
  </table>
  ${
    input.transcriptExcerpt
      ? `<h3 style="margin-top:24px; font-size:14px; color:#8A8F98;">Conversation excerpt</h3><pre style="white-space:pre-wrap; background:#0B0C0E; border:1px solid #23252A; border-radius:10px; padding:12px; font-size:12px; color:#F7F8F8; font-family: ui-monospace, Menlo, monospace;">${escapeHtml(input.transcriptExcerpt)}</pre>`
      : ""
  }
  <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://aivaspa.com"}/dashboard/leads" style="display:inline-block; margin-top:20px; background:#E2E54B; color:#08090A; text-decoration:none; font-weight:700; padding:10px 16px; border-radius:10px;">Open in dashboard →</a>
</div>
</body></html>`

  return { subject, text, html }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;")
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://aivaspa.com"
}

function shell(content: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>AivaSpa</title>
</head>
<body style="margin:0; padding:0; background:#08090A; color:#F7F8F8; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#08090A;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="left">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="background:#E2E54B; color:#08090A; font-weight:800; font-size:14px; line-height:14px; padding:8px 10px; border-radius:10px; letter-spacing:-0.02em;">A</td>
                        <td style="padding-left:10px; color:#F7F8F8; font-weight:700; font-size:14px; letter-spacing:-0.01em;">AivaSpa</td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="color:#62666D; font-size:11px;">24/7 AI receptionist</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#121316; border:1px solid #23252A; border-radius:18px; padding:28px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 4px 0 4px; color:#62666D; font-size:11px; line-height:1.5;">
              <p style="margin:0 0 6px 0;">AivaSpa · AI receptionist for modern med spas</p>
              <p style="margin:0;">You're receiving this because you signed up at <a href="${siteUrl()}" style="color:#8A8F98; text-decoration:underline;">aivaspa.com</a>.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildWelcomeEmail(input: {
  fullName: string
  spaName?: string | null
  loginUrl?: string | null
}): { subject: string; text: string; html: string } {
  const firstName = input.fullName.trim().split(/\s+/)[0] || "there"
  const spa = (input.spaName ?? "").trim() || "your med spa"
  const subject = `Welcome to AivaSpa, ${firstName}!`
  const loginUrl = input.loginUrl || `${siteUrl()}/login`

  const text = [
    `Hi ${firstName},`,
    ``,
    `Welcome to AivaSpa — your 24/7 AI receptionist for ${spa}.`,
    ``,
    `Here's what you can do next:`,
    `  · Finish the 9-step onboarding to teach Aiva about your services, hours, and FAQs.`,
    `  · Install the chat widget on your website with one script tag.`,
    `  · Turn on the Custom Calendar so Aiva can offer live booking slots and send reminders.`,
    ``,
    `Sign in to get started: ${loginUrl}`,
    ``,
    `Need help? Reply to this email — a real human reads every message.`,
    ``,
    `— The AivaSpa team`,
  ].join("\n")

  const body = `
    <p style="margin:0 0 6px 0; color:#E2E54B; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">Welcome aboard</p>
    <h1 style="margin:0 0 12px 0; font-size:26px; line-height:1.2; color:#F7F8F8; letter-spacing:-0.02em;">Hi ${escapeHtml(firstName)} — let's set up ${escapeHtml(spa)}.</h1>
    <p style="margin:0 0 22px 0; font-size:15px; line-height:1.55; color:#C9CDD3;">Aiva is your 24/7 AI receptionist. She answers questions from your approved knowledge base, captures leads the moment they arrive, and books consultations on your calendar — so you can stop chasing DMs and focus on treatments.</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px 0;">
      <tr>
        <td style="background:#0B0C0E; border:1px solid #23252A; border-radius:14px; padding:16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="36" valign="top">
                <div style="width:28px; height:28px; border-radius:8px; background:#E2E54B22; border:1px solid #E2E54B55; color:#E2E54B; text-align:center; line-height:28px; font-weight:800; font-size:14px;">1</div>
              </td>
              <td style="padding-left:12px;" valign="top">
                <p style="margin:0; font-size:14px; font-weight:700; color:#F7F8F8;">Finish onboarding</p>
                <p style="margin:4px 0 0 0; font-size:13px; line-height:1.5; color:#8A8F98;">A 9-step AI interview teaches Aiva about your services, pricing, FAQs, guardrails, hours, and brand voice.</p>
              </td>
            </tr>
            <tr><td colspan="2" style="height:10px; line-height:10px; font-size:0;">&nbsp;</td></tr>
            <tr>
              <td width="36" valign="top">
                <div style="width:28px; height:28px; border-radius:8px; background:#E2E54B22; border:1px solid #E2E54B55; color:#E2E54B; text-align:center; line-height:28px; font-weight:800; font-size:14px;">2</div>
              </td>
              <td style="padding-left:12px;" valign="top">
                <p style="margin:0; font-size:14px; font-weight:700; color:#F7F8F8;">Install the widget</p>
                <p style="margin:4px 0 0 0; font-size:13px; line-height:1.5; color:#8A8F98;">Copy one snippet and paste before <code style="background:#16171A; padding:1px 6px; border-radius:4px; font-size:12px; color:#F7F8F8;">&lt;/body&gt;</code> on your site. Aiva goes live in seconds.</p>
              </td>
            </tr>
            <tr><td colspan="2" style="height:10px; line-height:10px; font-size:0;">&nbsp;</td></tr>
            <tr>
              <td width="36" valign="top">
                <div style="width:28px; height:28px; border-radius:8px; background:#E2E54B22; border:1px solid #E2E54B55; color:#E2E54B; text-align:center; line-height:28px; font-weight:800; font-size:14px;">3</div>
              </td>
              <td style="padding-left:12px;" valign="top">
                <p style="margin:0; font-size:14px; font-weight:700; color:#F7F8F8;">Turn on the Custom Calendar</p>
                <p style="margin:4px 0 0 0; font-size:13px; line-height:1.5; color:#8A8F98;">Aiva offers visitors live booking slots based on your working hours, then emails and texts them reminders automatically.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="background:#E2E54B; border-radius:12px;">
          <a href="${escapeAttr(loginUrl)}" style="display:inline-block; padding:13px 22px; color:#08090A; font-weight:800; font-size:14px; text-decoration:none; letter-spacing:-0.01em;">Open my dashboard →</a>
        </td>
      </tr>
    </table>

    <p style="margin:22px 0 0 0; font-size:13px; line-height:1.55; color:#8A8F98;">Questions? Just reply to this email — a real human reads every message.</p>
  `

  return { subject, text, html: shell(body) }
}

export type DailySummaryLead = {
  name: string
  service: string
  preferredTime: string
  source: string
  status: string
  createdAt: string
}

export function buildDailySummaryEmail(input: {
  brandName: string
  recipientName?: string | null
  date: string
  totalLeads: number
  newLeads: number
  contacted: number
  booked: number
  conversations: number
  topService: string | null
  afterHours: number
  leads: DailySummaryLead[]
}): { subject: string; text: string; html: string } {
  const dateLabel = input.date
  const subject = `${input.brandName} · Daily summary for ${dateLabel}`
  const firstName =
    (input.recipientName ?? "").trim().split(/\s+/)[0] || "there"

  const stat = (label: string, value: string | number, accent?: string) => `
    <td style="background:#0B0C0E; border:1px solid #23252A; border-radius:12px; padding:14px 14px 12px 14px; width:33.33%;">
      <p style="margin:0; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#62666D;">${escapeHtml(label)}</p>
      <p style="margin:6px 0 0 0; font-size:22px; line-height:1.1; font-weight:800; color:${accent || "#F7F8F8"}; letter-spacing:-0.02em;">${escapeHtml(String(value))}</p>
    </td>`

  const leadsRows =
    input.leads.length === 0
      ? `<tr><td colspan="4" style="padding:18px 12px; text-align:center; color:#62666D; font-size:13px; background:#0B0C0E; border:1px dashed #23252A; border-radius:12px;">No leads captured yesterday. Aiva was chatting though — check the Conversations tab.</td></tr>`
      : input.leads
          .slice(0, 8)
          .map((l) => {
            const statusColor =
              l.status === "booked"
                ? "#4CB782"
                : l.status === "contacted"
                  ? "#5E6AD2"
                  : l.status === "lost"
                    ? "#EB5757"
                    : "#E2E54B"
            return `
              <tr>
                <td style="padding:12px 12px; border-bottom:1px solid #23252A; color:#F7F8F8; font-size:13px; font-weight:600;">${escapeHtml(l.name)}</td>
                <td style="padding:12px 12px; border-bottom:1px solid #23252A; color:#C9CDD3; font-size:13px;">${escapeHtml(l.service)}</td>
                <td style="padding:12px 12px; border-bottom:1px solid #23252A; color:#C9CDD3; font-size:12px;">${escapeHtml(l.preferredTime)}</td>
                <td style="padding:12px 12px; border-bottom:1px solid #23252A; text-align:right;"><span style="display:inline-block; padding:3px 8px; border:1px solid ${statusColor}55; background:${statusColor}15; color:${statusColor}; border-radius:999px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em;">${escapeHtml(l.status)}</span></td>
              </tr>`
          })
          .join("")

  const text = [
    `${input.brandName} — Daily summary for ${dateLabel}`,
    ``,
    `Hi ${firstName}, here's how ${input.brandName} performed yesterday:`,
    ``,
    `  · Total leads:    ${input.totalLeads}`,
    `  · New:            ${input.newLeads}`,
    `  · Contacted:      ${input.contacted}`,
    `  · Booked:         ${input.booked}`,
    `  · Conversations:  ${input.conversations}`,
    `  · After-hours:    ${input.afterHours}`,
    input.topService ? `  · Top service:    ${input.topService}` : "",
    ``,
    input.leads.length === 0
      ? `No new leads captured. Aiva is still chatting — open the Conversations tab to see what came in.`
      : input.leads
          .map(
            (l) =>
              `  · ${l.name} — ${l.service} (${l.preferredTime}) — ${l.status}`,
          )
          .join("\n"),
    ``,
    `Open the dashboard: ${siteUrl()}/dashboard`,
  ]
    .filter((line) => line !== null)
    .join("\n")

  const body = `
    <p style="margin:0 0 6px 0; color:#E2E54B; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">Daily summary · ${escapeHtml(dateLabel)}</p>
    <h1 style="margin:0 0 8px 0; font-size:26px; line-height:1.2; color:#F7F8F8; letter-spacing:-0.02em;">Good morning, ${escapeHtml(firstName)}.</h1>
    <p style="margin:0 0 22px 0; font-size:15px; line-height:1.55; color:#C9CDD3;">Here's how ${escapeHtml(input.brandName)} performed yesterday. ${input.totalLeads === 0 ? "A quiet 24 hours — Aiva is still chatting, just no one handed over their details yet." : ""}</p>

    <table role="presentation" width="100%" cellspacing="8" cellpadding="0" border="0" style="margin:0 0 22px 0;">
      <tr>
        ${stat("New leads", input.newLeads, "#E2E54B")}
        <td style="width:8px; font-size:0; line-height:0;">&nbsp;</td>
        ${stat("Booked", input.booked, "#4CB782")}
        <td style="width:8px; font-size:0; line-height:0;">&nbsp;</td>
        ${stat("Conversations", input.conversations, "#5E6AD2")}
      </tr>
      <tr><td colspan="5" style="height:4px; line-height:4px; font-size:0;">&nbsp;</td></tr>
      <tr>
        ${stat("After-hours", input.afterHours)}
        <td style="width:8px; font-size:0; line-height:0;">&nbsp;</td>
        ${stat("Top service", input.topService || "—", "#F7F8F8")}
        <td style="width:8px; font-size:0; line-height:0;">&nbsp;</td>
        ${stat("Contacted", input.contacted)}
      </tr>
    </table>

    <p style="margin:0 0 10px 0; color:#8A8F98; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">Yesterday's leads</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#121316; border:1px solid #23252A; border-radius:14px; overflow:hidden; margin:0 0 22px 0;">
      <thead>
        <tr style="background:#0B0C0E;">
          <th align="left" style="padding:10px 12px; color:#62666D; font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">Lead</th>
          <th align="left" style="padding:10px 12px; color:#62666D; font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">Service</th>
          <th align="left" style="padding:10px 12px; color:#62666D; font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">Preferred</th>
          <th align="right" style="padding:10px 12px; color:#62666D; font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${leadsRows}
      </tbody>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="background:#E2E54B; border-radius:12px;">
          <a href="${siteUrl()}/dashboard" style="display:inline-block; padding:13px 22px; color:#08090A; font-weight:800; font-size:14px; text-decoration:none; letter-spacing:-0.01em;">Open today's dashboard →</a>
        </td>
        <td style="padding-left:8px;">
          <a href="${siteUrl()}/dashboard/leads" style="display:inline-block; padding:13px 18px; color:#F7F8F8; font-weight:700; font-size:13px; text-decoration:none; background:#0B0C0E; border:1px solid #23252A; border-radius:12px;">View leads</a>
        </td>
      </tr>
    </table>

    <p style="margin:22px 0 0 0; font-size:12px; line-height:1.55; color:#62666D;">You're getting this because daily summaries are enabled in your notification settings. <a href="${siteUrl()}/dashboard/settings?section=notifications" style="color:#8A8F98; text-decoration:underline;">Manage preferences</a>.</p>
  `

  return { subject, text, html: shell(body) }
}
