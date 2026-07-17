import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { formatAuditEvent } from "@/lib/team/audit"
import { buildTeamInviteEmail } from "@/lib/notifications/team-invite-email"
import { generateInviteToken, hashInviteToken } from "@/lib/team/tokens"

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8")

describe("team layout", () => {
  const source = read("src/components/dashboard/team-management.tsx")

  it("uses a responsive two-column main area and a separate full-width audit panel", () => {
    expect(source).toContain('xl:grid-cols-[minmax(0,1fr)_320px]')
    expect(source).toContain('<AuditLogPanel />')
    expect(source.indexOf('<AuditLogPanel />')).toBeGreaterThan(source.indexOf('</div>\n\n      <AuditLogPanel'))
    expect(source).not.toMatch(/absolute|negative|\-mx-/)
  })

  it("collapses to one column without fixed panel heights or horizontal overflow", () => {
    expect(source).toContain("grid-cols-1")
    expect(source).not.toMatch(/h-\[(?:[3-9]\d{2}|\d{4})px\]/)
    expect(source).toContain("min-w-0")
  })
})

describe("audit formatting", () => {
  it("formats a raw subscription event into readable copy", () => {
    const formatted = formatAuditEvent({
      id: "1",
      userName: "Abdul Wasay",
      action: "SUBSCRIPTION_PLAN_CHANGED from=growth to=pro effective_at=immediate",
      createdAt: "2026-07-17T12:00:00Z",
    })
    expect(formatted.title).toBe("Subscription plan changed")
    expect(formatted.description).toBe("Growth → Pro")
    expect(formatted.category).toBe("billing")
  })

  it("handles missing metadata, actor, and malformed timestamps safely", () => {
    const formatted = formatAuditEvent({ action: "TEAM_MEMBER_REMOVED", createdAt: "bad", id: "2", userName: "" })
    expect(formatted.actor).toBe("System")
    expect(formatted.description).toBeTruthy()
    expect(formatted.timestamp).toBe("bad")
  })
})

describe("invite security and email", () => {
  it("creates an unpredictable raw token and a one-way SHA-256 hash", () => {
    const first = generateInviteToken()
    const second = generateInviteToken()
    expect(first.rawToken).toMatch(/^[a-f0-9]{64}$/)
    expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(first.rawToken).not.toBe(first.tokenHash)
    expect(first.rawToken).not.toBe(second.rawToken)
    expect(hashInviteToken(first.rawToken)).toBe(first.tokenHash)
  })

  it("renders business name, role, expiry, and acceptance URL", () => {
    const email = buildTeamInviteEmail({
      businessName: "Glow Aesthetics",
      inviterName: "Abdul Wasay",
      recipientName: "Jamie",
      role: "Staff",
      inviteUrl: "https://aivaspa.online/invite/accept?token=secret",
      expiresAt: new Date("2026-07-24T00:00:00Z"),
    })
    expect(email.subject).toContain("Glow Aesthetics")
    expect(email.text).toContain("as Staff")
    expect(email.html).toContain("Accept invitation")
    expect(email.html).toContain("https://aivaspa.online/invite/accept?token=secret")
  })

  it("enforces one pending invitation and atomic acceptance in the migration", () => {
    const migration = read("supabase/migrations/00035_team_invitations_and_audit.sql")
    expect(migration).toContain("team_invitations_pending_unique")
    expect(migration).toContain("where status = 'pending'")
    expect(migration).toContain("accept_team_invitation")
    expect(migration).toContain("for update")
    expect(migration).toContain("INVITE_EMAIL_MISMATCH")
    expect(migration).not.toMatch(/raw_token|invite_token\s+text/)
  })
})

