export type NormalizedContact = {
  phone: string
  email: string
}

const MIN_NORMALIZED_PHONE_LENGTH = 7

export function normalizePhone(input: string | null | undefined): string {
  if (!input) return ""
  const digits = input.replace(/\D/g, "")
  if (digits.length < MIN_NORMALIZED_PHONE_LENGTH) return ""
  return digits.slice(-10)
}

export function normalizeEmail(input: string | null | undefined): string {
  if (!input) return ""
  return input.trim().toLowerCase()
}

export function normalizeContact(input: {
  phone?: string | null
  email?: string | null
}): NormalizedContact {
  return {
    phone: normalizePhone(input.phone),
    email: normalizeEmail(input.email),
  }
}
