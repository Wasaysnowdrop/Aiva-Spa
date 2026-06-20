#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * scripts/setup-vercel-domains.mjs
 *
 * One-command Vercel domain setup for AivaSpa.
 *
 *   Adds the following domains to the linked Vercel project:
 *     - aivaspa.online          (apex / landing)
 *     - www.aivaspa.online      (apex www alias)
 *     - admin.aivaspa.online    (admin panel)
 *     - *.aivaspa.online        (wildcard for white-label per-spa widgets)
 *
 *   Prints the DNS records you need to add at your registrar
 *   (Namecheap / Cloudflare / GoDaddy) and verifies each domain
 *   once DNS is live.
 *
 * Required env vars (or CLI flags):
 *   VERCEL_TOKEN       — https://vercel.com/account/tokens
 *   VERCEL_PROJECT_ID  — found via `vercel project ls` or in Project Settings
 *   VERCEL_TEAM_ID     — optional, only for team-owned projects
 *   VERCEL_PROJECT_NAME — optional, falls back to the .vercel/project.json link
 *
 * Usage:
 *   node scripts/setup-vercel-domains.mjs
 *   node scripts/setup-vercel-domains.mjs --apex=example.com --admin-sub=admin.example.com
 *   node scripts/setup-vercel-domains.mjs --verify   # just check existing domains
 *
 * After DNS propagates (usually <5 min), re-run with --verify.
 */

import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const APEX_DEFAULT = "aivaspa.online"
const SUBDOMAINS = ["www", "admin"]
const WILDCARD = "*"

function parseArgs(argv) {
  const args = {
    apex: process.env.APEX_DOMAIN || APEX_DEFAULT,
    teamId: process.env.VERCEL_TEAM_ID || "",
    projectId: process.env.VERCEL_PROJECT_ID || "",
    token: process.env.VERCEL_TOKEN || "",
    verifyOnly: false,
    skipWildcard: false,
    json: false,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--verify") args.verifyOnly = true
    else if (a === "--no-wildcard") args.skipWildcard = true
    else if (a === "--json") args.json = true
    else if (a.startsWith("--apex=")) args.apex = a.slice("--apex=".length)
    else if (a.startsWith("--team=")) args.teamId = a.slice("--team=".length)
    else if (a.startsWith("--project="))
      args.projectId = a.slice("--project=".length)
    else if (a.startsWith("--token=")) args.token = a.slice("--token=".length)
    else if (a === "--help" || a === "-h") {
      printHelp()
      process.exit(0)
    }
  }
  return args
}

function printHelp() {
  console.log(`Usage: node scripts/setup-vercel-domains.mjs [options]

Options:
  --apex=DOMAIN         Apex domain (default: aivaspa.online)
  --project=ID          Vercel project ID (or set VERCEL_PROJECT_ID)
  --team=ID             Vercel team ID (or set VERCEL_TEAM_ID)
  --token=TOKEN         Vercel API token (or set VERCEL_TOKEN)
  --verify              Only verify existing domains, don't add new ones
  --no-wildcard         Skip the *.apex wildcard
  --json                Output machine-readable JSON
  --help                Show this help
`)
}

function loadProjectIdFromLink() {
  const path = resolve(process.cwd(), ".vercel/project.json")
  if (!existsSync(path)) return ""
  try {
    const data = JSON.parse(readFileSync(path, "utf8"))
    return data.projectId || ""
  } catch {
    return ""
  }
}

function vercelUrl(pathname, teamId) {
  const base = "https://api.vercel.com"
  const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""
  return `${base}${pathname}${q}`
}

async function vercelFetch(url, token, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let body
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { raw: text }
  }
  if (!res.ok) {
    const err = new Error(
      `Vercel API ${init.method || "GET"} ${url} failed: ${res.status} ${res.statusText}`,
    )
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

async function listDomains({ projectId, teamId, token }) {
  const url = vercelUrl(`/v9/projects/${projectId}/domains`, teamId)
  const res = await vercelFetch(url, token)
  return res.domains || []
}

async function addDomain({ projectId, teamId, token, name }) {
  const url = vercelUrl(`/v9/projects/${projectId}/domains`, teamId)
  return vercelFetch(url, token, {
    method: "POST",
    body: JSON.stringify({ name }),
  })
}

async function removeDomain({ projectId, teamId, token, name }) {
  const url = vercelUrl(
    `/v9/projects/${projectId}/domains/${encodeURIComponent(name)}`,
    teamId,
  )
  return vercelFetch(url, token, { method: "DELETE" })
}

async function getDomainConfig({ projectId, teamId, token, name }) {
  const url = vercelUrl(
    `/v6/domains/${encodeURIComponent(name)}/config`,
    teamId,
  )
  return vercelFetch(url, token)
}

function printBanner(text) {
  const bar = "─".repeat(Math.max(40, text.length + 4))
  console.log(`\n${bar}\n  ${text}\n${bar}`)
}

function describeVerification(name, verification) {
  if (!verification) return "  (no verification info returned)"
  const lines = []
  if (verification.type === "TXT") {
    lines.push(
      `  TXT  ${verification.domain || name}  →  "${verification.value}"`,
    )
  } else if (verification.type === "A") {
    lines.push(`  A    ${verification.domain || name}  →  ${verification.value}`)
  } else {
    lines.push(
      `  ${verification.type || "DNS"}  ${verification.domain || name}  →  ${verification.value || "(see Vercel)"}`,
    )
  }
  return lines.join("\n")
}

function isAlreadyExistsError(err) {
  if (!err) return false
  if (err.status === 409) return true
  const code = err.body?.error?.code
  const msg = err.body?.error?.message || ""
  return (
    code === "domain_already_exists" ||
    msg.toLowerCase().includes("already exists") ||
    msg.toLowerCase().includes("already in use")
  )
}

function isWildcardUnsupportedError(err) {
  const code = err.body?.error?.code
  const msg = (err.body?.error?.message || "").toLowerCase()
  return (
    code === "forbidden" ||
    code === "domain_not_supported" ||
    msg.includes("wildcard") ||
    msg.includes("not supported on your plan")
  )
}

async function main() {
  const args = parseArgs(process.argv)

  if (!args.token) {
    console.error(
      "✗ VERCEL_TOKEN is missing. Get one at https://vercel.com/account/tokens",
    )
    process.exit(1)
  }
  if (!args.projectId) args.projectId = loadProjectIdFromLink()
  if (!args.projectId) {
    console.error(
      "✗ VERCEL_PROJECT_ID is missing. Run `vercel link` first or pass --project=…",
    )
    process.exit(1)
  }

  const apex = args.apex.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  const targets = [apex, ...SUBDOMAINS.map((s) => `${s}.${apex}`)]
  if (!args.skipWildcard) targets.push(`${WILDCARD}.${apex}`)

  printBanner(`AivaSpa · Vercel domain setup`)
  console.log(`  Project  : ${args.projectId}${args.teamId ? ` (team ${args.teamId})` : ""}`)
  console.log(`  Apex     : ${apex}`)
  console.log(`  Targets  : ${targets.join(", ")}`)

  const existing = await listDomains({
    projectId: args.projectId,
    teamId: args.teamId,
    token: args.token,
  })
  const existingNames = new Set(existing.map((d) => d.name))
  console.log(`  Existing : ${existing.length} domain(s) already configured`)

  if (args.json) {
    process.stdout.write(
      JSON.stringify({ existing: existingNames, targets }, null, 2) + "\n",
    )
  }

  if (args.verifyOnly) {
    printBanner("Verification status")
    for (const d of existing) {
      const ok = d.verified ? "✓ verified" : "… pending"
      console.log(`  ${ok.padEnd(12)} ${d.name}`)
    }
    return
  }

  const results = []
  for (const name of targets) {
    if (existingNames.has(name)) {
      console.log(`  • ${name}  (already added)`)
      results.push({ name, status: "exists" })
      continue
    }
    try {
      const added = await addDomain({
        projectId: args.projectId,
        teamId: args.teamId,
        token: args.token,
        name,
      })
      console.log(`  + ${name}  (created)`)
      results.push({ name, status: "created", verification: added.verification })
    } catch (err) {
      if (isAlreadyExistsError(err)) {
        console.log(`  • ${name}  (already on Vercel)`)
        results.push({ name, status: "exists" })
      } else if (name.startsWith("*") && isWildcardUnsupportedError(err)) {
        console.log(
          `  ! ${name}  (skipped — wildcard requires Vercel Pro; add manually in dashboard)`,
        )
        results.push({ name, status: "skipped_plan" })
      } else {
        console.log(`  ✗ ${name}  (${err.message})`)
        results.push({ name, status: "error", error: err.message })
      }
    }
  }

  printBanner("DNS records to add at your registrar")
  console.log("  Apex (aivaspa.online):")
  console.log("    A       @                76.76.21.21")
  console.log("  Subdomains (cname to Vercel):")
  for (const sub of SUBDOMAINS) {
    console.log(`    CNAME   ${sub}             cname.vercel-dns.com.`)
  }
  console.log("  Wildcard (Pro plan only):")
  console.log("    CNAME   *                 cname.vercel-dns.com.")
  console.log("\n  ℹ  If your registrar doesn't support CNAME on the apex,")
  console.log("     use the A record (76.76.21.21) shown above.\n")

  printBanner("Per-domain verification (TXT records)")
  for (const r of results) {
    if (r.verification) {
      console.log(`  ${r.name}:`)
      console.log(describeVerification(r.name, r.verification))
    }
  }

  printBanner("Next steps")
  console.log("  1. Add the DNS records above at your registrar.")
  console.log("  2. Wait 1-10 minutes for propagation.")
  console.log("  3. Re-run with --verify to confirm:")
  console.log("       node scripts/setup-vercel-domains.mjs --verify")
  console.log("  4. Add the public env var to Vercel:")
  console.log("       NEXT_PUBLIC_SITE_URL=https://aivaspa.online")
  console.log("  5. (Optional) Add Vercel env vars for the admin subdomain:")
  console.log("       ADMIN_BASE_URL=https://admin.aivaspa.online")
  console.log("\n  Once DNS is live:")
  console.log(`    https://${apex}              → marketing site`)
  for (const sub of SUBDOMAINS) {
    const label = sub === "admin" ? "internal admin panel" : sub
    console.log(`    https://${sub}.${apex}        → ${label}`)
  }
  if (!args.skipWildcard) {
    console.log(`    https://<spa>.${apex}     → that spa's white-label widget`)
  }
}

main().catch((err) => {
  if (err.body) {
    console.error("Vercel API error:", JSON.stringify(err.body, null, 2))
  } else {
    console.error("Error:", err.message)
  }
  process.exit(1)
})
