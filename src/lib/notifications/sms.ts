export type SmsMessage = {
  to: string
  body: string
  from?: string
}

export type SmsSendResult = {
  ok: boolean
  provider: "twilio" | "log"
  id?: string
  error?: string
}

function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 7 || digits.length > 15) return null
  if (digits.length === 10) return `+1${digits}`
  if (digits.startsWith("00")) return `+${digits.slice(2)}`
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`
  if (phone.startsWith("+")) return `+${digits}`
  return `+${digits}`
}

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  )
}

export async function sendSms(msg: SmsMessage): Promise<SmsSendResult> {
  const normalized = normalizePhone(msg.to)
  if (!normalized) {
    return { ok: false, provider: "log", error: `invalid phone: ${msg.to}` }
  }
  if (!isSmsConfigured()) {
    console.info(`[sms:log-only] to=${normalized} body=${JSON.stringify(msg.body)}`)
    return {
      ok: false,
      provider: "log",
      error: "sms provider not configured (set TWILIO_* env vars)",
    }
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!
  const token = process.env.TWILIO_AUTH_TOKEN!
  const from = msg.from || process.env.TWILIO_FROM_NUMBER!
  const body = new URLSearchParams({ To: normalized, From: from, Body: msg.body })

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        },
        body: body.toString(),
      },
    )
    if (!res.ok) {
      const err = await res.text().catch(() => "")
      return {
        ok: false,
        provider: "twilio",
        error: `twilio ${res.status}: ${err.slice(0, 200)}`,
      }
    }
    const data = (await res.json().catch(() => ({}))) as { sid?: string }
    return { ok: true, provider: "twilio", id: data.sid }
  } catch (err) {
    return {
      ok: false,
      provider: "twilio",
      error: err instanceof Error ? err.message : "send failed",
    }
  }
}

export function buildLeadNotificationSms(input: {
  brandName: string
  leadName: string
  service: string
  phone: string
}): string {
  return `${input.brandName}: new lead ${input.leadName} (${input.service}). Call ${input.phone} to follow up.`
}
