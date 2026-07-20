import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

export async function getDemoAnalytics(days = 30) {
  const admin = createAdminClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString()
  const [{ data: sessions, error: sessionsError }, { data: events, error: eventsError }, { count: salesLeads }] = await Promise.all([
    admin.from("demo_sessions").select("id,scenario_id,status,message_count,ai_request_count,generated_output_tokens,lead_created,sales_lead_created,started_at,last_activity_at,current_step,completion_percentage,abuse_count").gte("started_at", since).order("started_at", { ascending: false }).limit(10_000),
    admin.from("demo_events").select("event_name,metadata,created_at,demo_session_id").gte("created_at", since).order("created_at", { ascending: false }).limit(20_000),
    admin.from("demo_sales_leads").select("id", { count: "exact", head: true }).gte("created_at", since),
  ])
  if (sessionsError) throw new Error(sessionsError.message)
  if (eventsError) throw new Error(eventsError.message)

  const rows = (sessions || []) as unknown as Array<Record<string, unknown>>
  const eventRows = (events || []) as unknown as Array<Record<string, unknown>>
  const completed = rows.filter((row) => row.status === "completed")
  const durations = rows.map((row) => Math.max(0, new Date(String(row.last_activity_at)).getTime() - new Date(String(row.started_at)).getTime()))
  const totalMessages = rows.reduce((sum, row) => sum + Number(row.message_count || 0), 0)
  const outputTokens = rows.reduce((sum, row) => sum + Number(row.generated_output_tokens || 0), 0)
  const eventCount = (name: string) => eventRows.filter((event) => event.event_name === name).length
  const scenarioCounts = new Map<string, number>()
  const abandonment = new Map<string, number>()
  for (const row of rows) {
    const scenario = String(row.scenario_id)
    scenarioCounts.set(scenario, (scenarioCounts.get(scenario) || 0) + 1)
    if (row.status !== "completed") {
      const step = String(row.current_step || "scenario")
      abandonment.set(step, (abandonment.get(step) || 0) + 1)
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    days,
    metrics: {
      sessionsStarted: rows.length,
      sessionsCompleted: completed.length,
      completionRate: rows.length ? completed.length / rows.length * 100 : 0,
      averageDurationSeconds: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length / 1000 : 0,
      averageMessages: rows.length ? totalMessages / rows.length : 0,
      leadCaptureReached: rows.filter((row) => Boolean(row.lead_created)).length,
      salesLeads: salesLeads || 0,
      salesConversionRate: rows.length ? (salesLeads || 0) / rows.length * 100 : 0,
      walkthroughClicks: eventCount("DEMO_BOOK_WALKTHROUGH_CLICKED"),
      signupClicks: eventCount("DEMO_SIGNUP_CLICKED"),
      abuseBlocks: eventCount("DEMO_ABUSE_BLOCKED"),
      aiRequests: rows.reduce((sum, row) => sum + Number(row.ai_request_count || 0), 0),
      outputTokens,
      estimatedAiCostUsd: outputTokens / 1_000_000 * Number(process.env.DEMO_OUTPUT_TOKEN_COST_PER_MILLION || 0.4),
    },
    scenarioCounts: [...scenarioCounts.entries()].sort((a, b) => b[1] - a[1]),
    abandonment: [...abandonment.entries()].sort((a, b) => b[1] - a[1]),
    recentSessions: rows.slice(0, 25).map((row) => ({
      id: String(row.id),
      scenario: String(row.scenario_id),
      status: String(row.status),
      messages: Number(row.message_count || 0),
      completion: Number(row.completion_percentage || 0),
      leadCreated: Boolean(row.lead_created),
      salesLeadCreated: Boolean(row.sales_lead_created),
      startedAt: String(row.started_at),
      step: String(row.current_step),
    })),
  }
}

