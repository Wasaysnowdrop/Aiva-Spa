import type { WorkingHours } from "@/lib/supabase/types"

export function isAfterHours(hours: WorkingHours, now: Date = new Date()): boolean {
  if (!hours.enabled) return false
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const day = dayNames[now.getDay()]
  const entry = hours.schedule.find((s) => s.day === day)
  if (!entry || !entry.open) return true
  const [openH, openM] = entry.from.split(":").map((n) => parseInt(n, 10))
  const [closeH, closeM] = entry.to.split(":").map((n) => parseInt(n, 10))
  if (Number.isNaN(openH) || Number.isNaN(closeH)) return true
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const openMin = openH * 60 + (openM || 0)
  const closeMin = closeH * 60 + (closeM || 0)
  return nowMin < openMin || nowMin > closeMin
}
