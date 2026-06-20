if (typeof window !== "undefined") {
  throw new Error(
    "This module can only be imported on the server. Move the import to a server-only file.",
  )
}

const STATIC_ALLOWED_ORIGINS = new Set<string>([
  // Local development
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
])

function parseAllowedOrigins(): string[] {
  const raw =
    process.env.CORS_ALLOWED_ORIGINS ??
    process.env.NEXT_PUBLIC_CORS_ALLOWED_ORIGINS ??
    ""
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
}

const ENV_ALLOWED_ORIGINS = parseAllowedOrigins()

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  if (STATIC_ALLOWED_ORIGINS.has(origin)) return true
  if (ENV_ALLOWED_ORIGINS.includes(origin)) return true
  if (process.env.NODE_ENV !== "production") {
    try {
      const u = new URL(origin)
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true
    } catch {
      // ignore parse errors
    }
  }
  return false
}

export type CorsOptions = {
  allowMethods?: string
  allowHeaders?: string
  maxAge?: string
  allowOrigin?: "*" | "allowlist"
}

const DEFAULT_METHODS = "GET,POST,OPTIONS"
const DEFAULT_HEADERS = "content-type, x-spa-id, x-session-id, authorization, x-api-key"
const DEFAULT_MAX_AGE = "86400"

export function buildCorsHeaders(
  request: Request,
  options: CorsOptions = {},
): Record<string, string> {
  const origin = request.headers.get("origin")
  const allowOrigin =
    options.allowOrigin === "*" || !options.allowOrigin
      ? "*"
      : isAllowedOrigin(origin)
        ? (origin as string)
        : "null"
  return {
    "access-control-allow-origin": allowOrigin,
    vary: "Origin",
    "access-control-allow-methods": options.allowMethods ?? DEFAULT_METHODS,
    "access-control-allow-headers": options.allowHeaders ?? DEFAULT_HEADERS,
    "access-control-max-age": options.maxAge ?? DEFAULT_MAX_AGE,
  }
}

export function isOriginAllowed(origin: string | null): boolean {
  return isAllowedOrigin(origin)
}

export function enforceOrigin(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true
  const origin = request.headers.get("origin")
  if (!origin) return true
  return isAllowedOrigin(origin)
}
