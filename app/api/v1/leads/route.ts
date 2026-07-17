import { buildCorsHeaders } from "@/lib/security/cors"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function disabled(request: Request): Response {
  return Response.json(
    {
      ok: false,
      error: "The external API is not available.",
      errorType: "FEATURE_DISABLED",
      feature: "external_api",
    },
    { status: 404, headers: buildCorsHeaders(request) },
  )
}

export function OPTIONS(request: Request) {
  return disabled(request)
}

export function GET(request: Request) {
  return disabled(request)
}

export function POST(request: Request) {
  return disabled(request)
}
