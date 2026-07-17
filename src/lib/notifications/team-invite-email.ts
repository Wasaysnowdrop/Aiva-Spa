import type { TeamRole } from "@/lib/supabase/types"

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character)

const ROLE_ACCESS: Record<Exclude<TeamRole, "Owner">, string> = {
  Manager: "manage leads, conversations, knowledge, widget settings, and team access",
  Staff: "view and update assigned leads and read conversations",
  Receptionist: "view leads and respond to conversations",
}

export function buildTeamInviteEmail(input: {
  businessName: string
  inviterName: string
  recipientName?: string | null
  role: Exclude<TeamRole, "Owner">
  inviteUrl: string
  expiresAt: Date
}) {
  const subject = `You've been invited to join ${input.businessName} on AivaSpa`
  const greeting = input.recipientName?.trim() ? `Hi ${input.recipientName.trim()},` : "Hello,"
  const expiry = input.expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
  const access = ROLE_ACCESS[input.role]
  const text = `${greeting}\n\n${input.inviterName} invited you to join ${input.businessName} on AivaSpa as ${input.role}.\n\nAs ${input.role}, you'll be able to ${access}.\n\nAccept invitation: ${input.inviteUrl}\n\nThis invitation expires on ${expiry}.\n\nIf you were not expecting this invitation, you can ignore this email.`
  const html = `<!doctype html><html><body style="margin:0;background:#08090A;color:#F7F8F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px"><div style="max-width:560px;margin:0 auto;background:#121316;border:1px solid #23252A;border-radius:16px;overflow:hidden"><div style="padding:24px;border-bottom:1px solid #23252A"><div style="font-size:20px;font-weight:800"><span style="color:#E2E54B">A</span> AivaSpa</div></div><div style="padding:28px"><p style="margin:0 0 18px;font-size:16px">${escapeHtml(greeting)}</p><h1 style="font-size:24px;line-height:1.25;margin:0 0 14px">Join ${escapeHtml(input.businessName)}</h1><p style="color:#B5B8BE;line-height:1.65;margin:0 0 16px">${escapeHtml(input.inviterName)} invited you to join <strong style="color:#F7F8F8">${escapeHtml(input.businessName)}</strong> as <strong style="color:#F7F8F8">${escapeHtml(input.role)}</strong>.</p><p style="color:#B5B8BE;line-height:1.65;margin:0 0 24px">As ${escapeHtml(input.role)}, you’ll be able to ${escapeHtml(access)}.</p><a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block;background:#E2E54B;color:#08090A;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:10px">Accept invitation</a><p style="color:#8A8F98;font-size:13px;line-height:1.6;margin:24px 0 8px">This invitation expires on ${escapeHtml(expiry)}.</p><p style="color:#62666D;font-size:12px;line-height:1.6;word-break:break-all;margin:0">Button not working? Copy this URL:<br><a href="${escapeHtml(input.inviteUrl)}" style="color:#B5B8BE">${escapeHtml(input.inviteUrl)}</a></p></div><div style="padding:18px 28px;border-top:1px solid #23252A;color:#62666D;font-size:12px;line-height:1.5">If you were not expecting this invitation, you can ignore this email.</div></div></body></html>`
  return { subject, text, html }
}

