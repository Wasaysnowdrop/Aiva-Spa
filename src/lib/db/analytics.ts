import { createClient } from "@/lib/supabase/server"
import type { DailyCount, ServiceEngagement } from "@/lib/supabase/types"

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function formatDay(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export async function getLeadAnalytics(range = "14d") {
  const supabase = await createClient()
  const days = Number.parseInt(range, 10) || 14
  const today = startOfDay(new Date())
  const cutoff = new Date(today)
  cutoff.setDate(today.getDate() - (days - 1))

  const { data: raw, error } = await supabase
    .from("leads")
    .select("created_at, status, after_hours, service, consent_given")
    .gte("created_at", cutoff.toISOString())

  if (error) throw new Error(error.message)

  const leads = (raw ?? []) as {
    created_at: string
    status: string
    after_hours: boolean
    service: string
    consent_given: boolean
  }[]

  const dailyCounts: DailyCount[] = Array.from({ length: days }, (_, index) => {
    const day = new Date(cutoff)
    day.setDate(cutoff.getDate() + index)
    const dayStart = startOfDay(day).getTime()
    const count = leads.filter(
      (l) => startOfDay(new Date(l.created_at)).getTime() === dayStart,
    ).length
    return {
      day:
        days <= 14
          ? day.toLocaleDateString("en-US", { weekday: "short" })
          : formatDay(day),
      value: count,
      label: `${formatDay(day)}: ${count}`,
    }
  })

  const priorCutoff = new Date(cutoff)
  priorCutoff.setDate(cutoff.getDate() - days)
  const priorCount = leads.filter(
    (l) =>
      new Date(l.created_at) >= priorCutoff &&
      new Date(l.created_at) < cutoff,
  ).length
  const periodChange =
    priorCount > 0
      ? ((leads.length - priorCount) / priorCount) * 100
      : leads.length > 0
        ? 100
        : 0

  const total = leads.length || 1
  const booked = leads.filter((l) => l.status === "booked").length
  const afterHours = leads.filter((l) => l.after_hours).length
  const converted = leads.filter(
    (l) => l.consent_given && l.status !== "lost",
  ).length

  const kpis = [
    {
      label: "Visitor → Lead",
      value: 12,
      current: Math.round((converted / total) * 100),
      format: "%",
    },
    {
      label: "Lead → Booked",
      value: 35,
      current: Math.round((booked / total) * 100),
      format: "%",
    },
    {
      label: "After-hours capture",
      value: 30,
      current: Math.round((afterHours / total) * 100),
      format: "%",
    },
    { label: "Avg. response time", value: 3, current: 0, format: "s", invert: true },
    { label: "Answer accuracy", value: 95, current: 0, format: "%" },
    { label: "Notification delivery", value: 99, current: 0, format: "%" },
  ]

  const serviceMap = new Map<string, number>()
  leads.forEach((l) =>
    serviceMap.set(l.service, (serviceMap.get(l.service) ?? 0) + 1),
  )

  const serviceColors = [
    "#E2E54B",
    "#5E6AD2",
    "#22D3EE",
    "#34D399",
    "#FF77E9",
    "#F59E0B",
    "#8A8F98",
  ]
  const leadsByService: ServiceEngagement[] = Array.from(
    serviceMap.entries(),
  ).map(([name, value], index) => ({
    name,
    value,
    color: serviceColors[index % serviceColors.length],
  }))

  const hourlyCounts = Array.from({ length: 24 }, (_, hour) => {
    return leads.filter((l) => new Date(l.created_at).getHours() === hour)
      .length
  })

  return {
    dailyCounts,
    periodChange,
    kpis,
    leadsByService,
    hourlyCounts,
    totalLeads: leads.length,
  }
}

export async function getDashboardKpis() {
  const supabase = await createClient()
  const now = new Date()

  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const monthAgo = new Date(now)
  monthAgo.setDate(monthAgo.getDate() - 30)

  const todayStart = startOfDay(now)

  const { data: raw, error } = await supabase
    .from("leads")
    .select("created_at, status, after_hours")

  if (error) throw new Error(error.message)

  const all = (raw ?? []) as {
    created_at: string
    status: string
    after_hours: boolean
  }[]
  const totalLeads = all.length
  const newLeadsToday = all.filter(
    (l) => new Date(l.created_at) >= todayStart,
  ).length
  const leadsThisWeek = all.filter(
    (l) => new Date(l.created_at) >= weekAgo,
  ).length
  const leadsThisMonth = all.filter(
    (l) => new Date(l.created_at) >= monthAgo,
  ).length
  const booked = all.filter((l) => l.status === "booked").length
  const afterHoursCount = all.filter((l) => l.after_hours).length
  const afterHoursRate =
    totalLeads > 0
      ? Math.round((afterHoursCount / totalLeads) * 100)
      : 0
  const conversionRate =
    totalLeads > 0 ? Math.round((booked / totalLeads) * 100) : 0

  return {
    totalLeads,
    newLeadsToday,
    leadsThisWeek,
    leadsThisMonth,
    booked,
    afterHoursCount,
    afterHoursRate,
    conversionRate,
  }
}

export async function getNewLeadsCount(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("status", "new")

  if (error) throw new Error(error.message)
  return count ?? 0
}
