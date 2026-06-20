import type { NextConfig } from "next"

function parseEmbedOrigins(): string[] {
  const raw = process.env.EMBED_ALLOWED_ORIGINS ?? ""
  const parsed = raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
  if (parsed.length > 0) return parsed
  return process.env.NODE_ENV === "production"
    ? []
    : ["http://localhost:3000", "http://127.0.0.1:3000"]
}

const embedOrigins = parseEmbedOrigins()
const frameAncestorsValue = embedOrigins.includes("*")
  ? "*"
  : embedOrigins.length > 0
    ? embedOrigins.join(" ")
    : "'none'"

const embedSecurityHeaders = [
  { key: "X-Frame-Options", value: frameAncestorsValue === "*" ? "ALLOWALL" : "SAMEORIGIN" },
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
