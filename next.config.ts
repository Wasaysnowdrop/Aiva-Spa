import type { NextConfig } from "next"

function parseEmbedOrigins(): string[] {
  const raw = process.env.EMBED_ALLOWED_ORIGINS ?? ""
  const parsed = raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
  // Default: allow any site to frame the embed so the widget works out of
  // the box on a customer's own website. Set EMBED_ALLOWED_ORIGINS in Vercel
  // to a comma-separated list (e.g. "https://myspa.com,https://www.myspa.com")
  // to lock it down to specific domains. Use "*" to explicitly opt in to all.
  if (parsed.length > 0) return parsed
  return ["*"]
}

const embedOrigins = parseEmbedOrigins()
const frameAncestorsValue = embedOrigins.includes("*")
  ? "*"
  : embedOrigins.length > 0
    ? embedOrigins.join(" ")
    : "*"

const embedSecurityHeaders = [
  { key: "X-Frame-Options", value: "ALLOWALL" },
  {
    key: "Content-Security-Policy",
    value: `frame-ancestors ${frameAncestorsValue};`,
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
]

const isProd = process.env.NODE_ENV === "production"
const apiCorsHeaders = [
  { key: "Access-Control-Allow-Origin", value: isProd ? envOrigin() : "*" },
  { key: "Vary", value: "Origin" },
  { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
  {
    key: "Access-Control-Allow-Headers",
    value: "content-type, x-spa-id, x-session-id, authorization, x-api-key",
  },
  { key: "Access-Control-Max-Age", value: "86400" },
]

function envOrigin() {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!site) return "*"
  return site
}

const globalHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
]

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  allowedDevOrigins: [
    "aivaspa.online",
    "www.aivaspa.online",
    "admin.aivaspa.online",
    ".aivaspa.online",
    "localhost",
    "127.0.0.1",
  ],
  async headers() {
    return [
      { source: "/:path*", headers: globalHeaders },
      { source: "/embed/:path*", headers: embedSecurityHeaders },
      { source: "/embed-demo/:path*", headers: embedSecurityHeaders },
      { source: "/api/:path*", headers: apiCorsHeaders },
    ]
  },
  serverExternalPackages: ["node:crypto"],
}

export default nextConfig
