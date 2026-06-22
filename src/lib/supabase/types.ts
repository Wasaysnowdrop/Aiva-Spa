export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type LeadStatus = "new" | "contacted" | "booked" | "lost"
export type LeadSource = "Website Chat" | "Mobile" | "Direct Link"
export type TeamRole = "Owner" | "Manager" | "Staff" | "Receptionist"
export type TeamMemberStatus = "active" | "invited" | "suspended"
export type KnowledgeCategory = string
export type FaqCategory = "General" | "Pricing" | "Booking" | "Safety" | "Hours"
export type NotificationChannel = "Email" | "SMS"
export type NotificationStatus = "delivered" | "pending" | "failed"
export type WidgetPosition = "bottom-right" | "bottom-left"

export interface TranscriptMessage {
  id: string
  role: "visitor" | "ai" | "staff"
  content: string
  timestamp: string
}

export interface WorkingHours {
  enabled: boolean
  tz: string
  schedule: {
    day: string
    open: boolean
    from: string
    to: string
  }[]
}

export interface Lead {
  id: string
  name: string
  phone: string
  email: string
  service: string
  preferredTime: string
  status: LeadStatus
  source: LeadSource
  sourceUrl: string
  afterHours: boolean
  notes?: string | null
  transcript: TranscriptMessage[]
  createdAt: string
  lastActivityAt: string
  assignedTo?: string | null
  consentGiven: boolean
  phoneNormalized?: string
  emailNormalized?: string
  mergedIntoId?: string | null
  mergedAt?: string | null
  mergedFrom?: MergedLeadEntry[]
}

export type MergedLeadEntry = {
  id: string
  name: string
  phone: string
  email: string
  source: LeadSource
  sourceUrl: string
  createdAt: string
  mergedAt: string
}

export type ChatSessionStatus = "active" | "captured" | "abandoned"

export interface ChatSession {
  id: string
  sessionId: string
  spaId: string
  transcript: TranscriptMessage[]
  messageCount: number
  lastMessage: string
  lastRole: "visitor" | "ai" | "staff"
  lastMessageAt: string
  sourceUrl: string
  afterHours: boolean
  visitorName: string | null
  leadCaptured: boolean
  leadId: string | null
  consentGiven: boolean
  status: ChatSessionStatus
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface KnowledgeService {
  id: string
  userId: string | null
  name: string
  category: KnowledgeCategory
  description: string
  pricingRule: string
  duration: string
  active: boolean
}

export interface KnowledgeFaq {
  id: string
  userId: string | null
  question: string
  answer: string
  category: FaqCategory
  updatedAt: string
}

export type GuardrailRuleType =
  | "safety"
  | "pricing"
  | "medical"
  | "booking"
  | "out_of_scope"
  | "emergency"
  | "general"

export const GUARDRAIL_RULE_TYPES: GuardrailRuleType[] = [
  "safety",
  "pricing",
  "medical",
  "booking",
  "out_of_scope",
  "emergency",
  "general",
]

export const GUARDRAIL_RULE_TYPE_LABELS: Record<GuardrailRuleType, string> = {
  safety: "Safety",
  pricing: "Pricing",
  medical: "Medical",
  booking: "Booking",
  out_of_scope: "Out of scope",
  emergency: "Emergency",
  general: "General",
}

export interface KnowledgeGuardrail {
  id: string
  userId: string | null
  title: string
  body: string
  description: string
  ruleType: GuardrailRuleType
  enabled: boolean
  isActive: boolean
}

export interface TeamMember {
  id: string
  name: string
  email: string
  phone?: string | null
  role: TeamRole
  status: TeamMemberStatus
  lastActiveAt: string | null
  avatarColor: string
}

export interface NotificationLog {
  id: string
  leadId: string
  leadName: string
  channel: NotificationChannel
  recipient: string
  status: NotificationStatus
  sentAt: string
}

export interface SpaSettings {
  id: string
  spaName: string
  website: string
  ownerName: string
  ownerEmail: string
  address: string
  plan: string
  paymentMethod: string
  createdAt: string
  updatedAt: string
}

export interface IntegrationConfig {
  id: string
  name: string
  description: string
  status: string
  icon: string
}

export interface NotificationChannelConfig {
  id: string
  channel: string
  label: string
  description: string
  enabled: boolean
  recipients: string[]
}

export interface AuditLog {
  id: string
  userName: string
  action: string
  createdAt: string
}

export interface WidgetConfig {
  id: string
  brandName: string
  logoInitial: string
  bubbleLogoUrl: string | null
  primaryColor: string
  position: WidgetPosition
  welcomeMessage: string
  proactiveEnabled: boolean
  proactiveDelaySeconds: number
  proactiveMessage: string
  showBranding: boolean
  collectEmail: boolean
  collectPhone: boolean
  consentText: string
  workingHours: WorkingHours
  extendedKb: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback
}

const leadStatuses: readonly LeadStatus[] = ["new", "contacted", "booked", "lost"]
const leadSources: readonly LeadSource[] = ["Website Chat", "Mobile", "Direct Link"]
const teamRoles: readonly TeamRole[] = ["Owner", "Manager", "Staff", "Receptionist"]
const teamStatuses: readonly TeamMemberStatus[] = ["active", "invited", "suspended"]
const faqCategories: readonly FaqCategory[] = ["General", "Pricing", "Booking", "Safety", "Hours"]
const notificationChannels: readonly NotificationChannel[] = ["Email", "SMS"]
const notificationStatuses: readonly NotificationStatus[] = ["delivered", "pending", "failed"]
const widgetPositions: readonly WidgetPosition[] = ["bottom-right", "bottom-left"]
const chatSessionStatuses: readonly ChatSessionStatus[] = ["active", "captured", "abandoned"]

type DbRecord = Record<string, unknown>

function transcriptValue(value: unknown): TranscriptMessage[] {
  if (!Array.isArray(value)) return []
  return value.map((message, index) => {
    const row = typeof message === "object" && message !== null ? (message as DbRecord) : {}
    return {
      id: stringValue(row.id, `msg_${index + 1}`),
      role: enumValue(row.role, ["visitor", "ai", "staff"] as const, "visitor"),
      content: stringValue(row.content),
      timestamp: stringValue(row.timestamp),
    }
  })
}

function workingHoursValue(value: unknown): WorkingHours {
  if (!value || typeof value !== "object") {
    return {
      enabled: false,
      tz: "America/Los_Angeles",
      schedule: [],
    }
  }
  const obj = value as DbRecord
  const schedule = Array.isArray(obj.schedule)
    ? obj.schedule.map((d: unknown) => {
        const day = typeof d === "object" && d !== null ? (d as DbRecord) : {}
        return {
          day: stringValue(day.day, ""),
          open: booleanValue(day.open, false),
          from: stringValue(day.from, "09:00"),
          to: stringValue(day.to, "17:00"),
        }
      })
    : []
  return {
    enabled: booleanValue(obj.enabled, false),
    tz: stringValue(obj.tz, "America/Los_Angeles"),
    schedule,
  }
}

function mergedFromValue(value: unknown): MergedLeadEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const row = entry as DbRecord
      return {
        id: stringValue(row.id),
        name: stringValue(row.name),
        phone: stringValue(row.phone),
        email: stringValue(row.email),
        source: enumValue(row.source, leadSources, "Website Chat"),
        sourceUrl: stringValue(row.source_url ?? row.sourceUrl),
        createdAt: stringValue(row.created_at ?? row.createdAt),
        mergedAt: stringValue(row.merged_at ?? row.mergedAt),
      } satisfies MergedLeadEntry
    })
    .filter((entry): entry is MergedLeadEntry => entry !== null)
}

export function mapLead(row: DbRecord): Lead {
  const createdAt = stringValue(row.created_at ?? row.createdAt, new Date().toISOString())
  const lastActivityAt = stringValue(row.last_activity_at ?? row.lastActivityAt, createdAt)
  return {
    id: stringValue(row.id),
    name: stringValue(row.name, "Unknown lead"),
    phone: stringValue(row.phone),
    email: stringValue(row.email),
    service: stringValue(row.service ?? row.service_interest, "Botox"),
    preferredTime: stringValue(row.preferred_time ?? row.preferredTime, "Not specified"),
    status: enumValue(row.status, leadStatuses, "new"),
    source: enumValue(row.source, leadSources, "Website Chat"),
    sourceUrl: stringValue(row.source_url ?? row.sourceUrl, "/"),
    afterHours: booleanValue(row.after_hours ?? row.afterHours, false),
    notes: stringValue(row.notes, undefined as unknown as string) || null,
    transcript: transcriptValue(row.transcript),
    createdAt,
    lastActivityAt,
    assignedTo: stringValue(row.assigned_to ?? row.assignedTo, undefined as unknown as string) || null,
    consentGiven: booleanValue(row.consent_given ?? row.consentGiven, false),
    phoneNormalized: stringValue(row.phone_normalized ?? row.phoneNormalized, ""),
    emailNormalized: stringValue(row.email_normalized ?? row.emailNormalized, ""),
    mergedIntoId:
      stringValue(row.merged_into_id ?? row.mergedIntoId, undefined as unknown as string) || null,
    mergedAt: stringValue(row.merged_at ?? row.mergedAt, undefined as unknown as string) || null,
    mergedFrom: mergedFromValue(row.merged_from ?? row.mergedFrom),
  }
}

export function mapTeamMember(row: DbRecord): TeamMember {
  return {
    id: stringValue(row.id),
    name: stringValue(row.name, "Team member"),
    email: stringValue(row.email),
    phone: stringValue(row.phone, undefined as unknown as string) || null,
    role: enumValue(row.role, teamRoles, "Staff"),
    status: enumValue(row.status, teamStatuses, "active"),
    lastActiveAt: stringValue(row.last_active_at ?? row.lastActiveAt, undefined as unknown as string) || null,
    avatarColor: stringValue(row.avatar_color ?? row.avatarColor, "#8A8F98"),
  }
}

export function mapChatSession(row: DbRecord): ChatSession {
  const createdAt = stringValue(row.created_at ?? row.createdAt, new Date().toISOString())
  const updatedAt = stringValue(row.updated_at ?? row.updatedAt, createdAt)
  const lastMessageAt = stringValue(row.last_message_at ?? row.lastMessageAt, updatedAt)
  const lastRole = enumValue(row.last_role ?? row.lastRole, ["visitor", "ai", "staff"] as const, "visitor")
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {}
  return {
    id: stringValue(row.id),
    sessionId: stringValue(row.session_id ?? row.sessionId, ""),
    spaId: stringValue(row.spa_id ?? row.spaId, "default"),
    transcript: transcriptValue(row.transcript),
    messageCount: numberValue(row.message_count ?? row.messageCount, 0),
    lastMessage: stringValue(row.last_message ?? row.lastMessage),
    lastRole,
    lastMessageAt,
    sourceUrl: stringValue(row.source_url ?? row.sourceUrl, "/"),
    afterHours: booleanValue(row.after_hours ?? row.afterHours, false),
    visitorName: stringValue(row.visitor_name ?? row.visitorName, undefined as unknown as string) || null,
    leadCaptured: booleanValue(row.lead_captured ?? row.leadCaptured, false),
    leadId: stringValue(row.lead_id ?? row.leadId, undefined as unknown as string) || null,
    consentGiven: booleanValue(row.consent_given ?? row.consentGiven, false),
    status: enumValue(row.status, chatSessionStatuses, "active"),
    metadata,
    createdAt,
    updatedAt,
  }
}

function optionalUuidValue(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function mapKnowledgeService(row: DbRecord): KnowledgeService {
  const rawCategory = stringValue(row.category, "")
  const category = rawCategory.trim() ? rawCategory.trim() : "Skin"
  return {
    id: stringValue(row.id),
    userId: optionalUuidValue(row.user_id ?? row.userId),
    name: stringValue(row.name, ""),
    category,
    description: stringValue(row.description),
    pricingRule: stringValue(row.pricing_rule ?? row.pricingRule),
    duration: stringValue(row.duration),
    active: booleanValue(row.active, true),
  }
}

export function mapKnowledgeFaq(row: DbRecord): KnowledgeFaq {
  return {
    id: stringValue(row.id),
    userId: optionalUuidValue(row.user_id ?? row.userId),
    question: stringValue(row.question, ""),
    answer: stringValue(row.answer),
    category: enumValue(row.category, faqCategories, "General"),
    updatedAt: stringValue(row.updated_at ?? row.updatedAt, new Date().toISOString()),
  }
}

export function mapKnowledgeGuardrail(row: DbRecord): KnowledgeGuardrail {
  const rawDescription = stringValue(row.description, undefined as unknown as string)
  const rawBody = stringValue(row.body, undefined as unknown as string)
  const description =
    typeof rawDescription === "string" && rawDescription.trim().length > 0
      ? rawDescription
      : rawBody
  const rawRuleType = stringValue(row.rule_type ?? row.ruleType, "general").trim().toLowerCase()
  const ruleType = (
    GUARDRAIL_RULE_TYPES as readonly string[]
  ).includes(rawRuleType)
    ? (rawRuleType as GuardrailRuleType)
    : "general"
  const enabled = booleanValue(
    row.is_active ?? row.isActive ?? row.enabled,
    true,
  )
  return {
    id: stringValue(row.id),
    userId: optionalUuidValue(row.user_id ?? row.userId),
    title: stringValue(row.title, ""),
    body: description,
    description,
    ruleType,
    enabled,
    isActive: enabled,
  }
}

export function mapNotificationLog(row: DbRecord): NotificationLog {
  return {
    id: stringValue(row.id),
    leadId: stringValue(row.lead_id ?? row.leadId),
    leadName: stringValue(row.lead_name ?? row.leadName),
    channel: enumValue(row.channel, notificationChannels, "Email"),
    recipient: stringValue(row.recipient),
    status: enumValue(row.status, notificationStatuses, "pending"),
    sentAt: stringValue(row.sent_at ?? row.sentAt, new Date().toISOString()),
  }
}

export function mapAuditLog(row: DbRecord): AuditLog {
  return {
    id: stringValue(row.id),
    userName: stringValue(row.user_name ?? row.userName),
    action: stringValue(row.action),
    createdAt: stringValue(row.created_at ?? row.createdAt, new Date().toISOString()),
  }
}

export function mapWidgetConfig(row: DbRecord): WidgetConfig {
  const rawLogo = row.bubble_logo_url ?? row.bubbleLogoUrl
  const bubbleLogoUrl =
    typeof rawLogo === "string" && rawLogo.trim().length > 0 ? rawLogo.trim() : null
  return {
    id: stringValue(row.id),
    brandName: stringValue(row.brand_name ?? row.brandName, "Glow Med Spa"),
    logoInitial: stringValue(row.logo_initial ?? row.logoInitial, "G"),
    bubbleLogoUrl,
    primaryColor: stringValue(row.primary_color ?? row.primaryColor, "#E2E54B"),
    position: enumValue(row.position, widgetPositions, "bottom-right"),
    welcomeMessage: stringValue(
      row.welcome_message ?? row.welcomeMessage,
      "Hi! Are you looking to book a consultation or ask about a treatment?",
    ),
    proactiveEnabled: booleanValue(row.proactive_enabled ?? row.proactiveEnabled, true),
    proactiveDelaySeconds: numberValue(row.proactive_delay_seconds ?? row.proactiveDelaySeconds, 8),
    proactiveMessage: stringValue(
      row.proactive_message ?? row.proactiveMessage,
      "Still browsing? I can answer questions or set up a consultation in seconds.",
    ),
    showBranding: booleanValue(row.show_branding ?? row.showBranding, true),
    collectEmail: booleanValue(row.collect_email ?? row.collectEmail, true),
    collectPhone: booleanValue(row.collect_phone ?? row.collectPhone, true),
    consentText: stringValue(
      row.consent_text ?? row.consentText,
      "By chatting, you agree to our privacy policy. We'll only contact you about your inquiry.",
    ),
    workingHours: workingHoursValue(row.working_hours ?? row.workingHours),
    extendedKb: extendedKbValue(row.extended_kb ?? row.extendedKb),
    createdAt: stringValue(row.created_at ?? row.createdAt, new Date().toISOString()),
    updatedAt: stringValue(row.updated_at ?? row.updatedAt, new Date().toISOString()),
  }
}

function extendedKbValue(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export function mapIntegrationConfig(row: DbRecord): IntegrationConfig {
  return {
    id: stringValue(row.id),
    name: stringValue(row.name),
    description: stringValue(row.description),
    status: stringValue(row.status, "available"),
    icon: stringValue(row.icon),
  }
}

export function mapNotificationChannelConfig(row: DbRecord): NotificationChannelConfig {
  const recipients = Array.isArray(row.recipients) ? row.recipients.map((r: unknown) => String(r)) : []
  return {
    id: stringValue(row.id),
    channel: stringValue(row.channel),
    label: stringValue(row.label),
    description: stringValue(row.description),
    enabled: booleanValue(row.enabled, false),
    recipients,
  }
}

export function mapSpaSettings(row: DbRecord): SpaSettings {
  return {
    id: stringValue(row.id),
    spaName: stringValue(row.spa_name ?? row.spaName, ""),
    website: stringValue(row.website, ""),
    ownerName: stringValue(row.owner_name ?? row.ownerName, ""),
    ownerEmail: stringValue(row.owner_email ?? row.ownerEmail, ""),
    address: stringValue(row.address, ""),
    plan: stringValue(row.plan, "Pro · $149/mo"),
    paymentMethod: stringValue(row.payment_method ?? row.paymentMethod, ""),
    createdAt: stringValue(row.created_at ?? row.createdAt, new Date().toISOString()),
    updatedAt: stringValue(row.updated_at ?? row.updatedAt, new Date().toISOString()),
  }
}

export type ServiceEngagement = {
  name: string
  value: number
  color: string
}

export type DailyCount = {
  day: string
  value: number
  label?: string
}

export type Database = {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, unknown>
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
    >
    Views: Record<string, { Row: Record<string, unknown> }>
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>
    Enums: Record<string, string>
    CompositeTypes: Record<string, Record<string, unknown>>
  }
}
