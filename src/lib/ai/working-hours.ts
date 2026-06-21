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
  if (Number.isNaN(openM) || Number.isNaN(closeM)) return true
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const openMin = openH * 60 + (openM || 0)
  const closeMin = closeH * 60 + (closeM || 0)
  // Overnight hours: e.g. open 22:00, close 02:00. closeMin < openMin means
  // the window crosses midnight — currently inside when nowMin >= openMin
  // OR nowMin < closeMin.
  if (closeMin < openMin) {
    return !(nowMin >= openMin || nowMin < closeMin)
  }
  return nowMin < openMin || nowMin > closeMin
}
