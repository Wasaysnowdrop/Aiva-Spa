export type AnalyticsRangeKey = "7d" | "30d" | "90d" | "365d"
export type AnalyticsTrend = { value: number | null; direction: "up" | "down" | "neutral"; label: string }

export type AnalyticsSummary = {
  visitorConversations: number
  qualifiedLeads: number
  bookedLeads: number
  visitorToLeadRate: number | null
  leadToBookingRate: number | null
  averageResponseSeconds: number | null
  notificationDeliveryRate: number | null
}

export type AnalyticsPayload = {
  range: { key: AnalyticsRangeKey; start: string; end: string; timezone: string; grouping: "daily" | "weekly" | "monthly" }
  summary: AnalyticsSummary
  previous: AnalyticsSummary
  trends: Record<keyof Omit<AnalyticsSummary, "notificationDeliveryRate">, AnalyticsTrend>
  timeline: { key: string; label: string; conversations: number; leads: number; bookings: number }[]
  funnel: { stage: string; count: number; percentage: number | null }[]
  services: { name: string; count: number; percentage: number }[]
  hours: { hour: number; label: string; conversations: number }[]
  referrers: { domain: string; conversations: number; leads: number; conversionRate: number | null }[]
  statuses: { status: "new" | "contacted" | "booked" | "lost"; count: number; percentage: number }[]
}

