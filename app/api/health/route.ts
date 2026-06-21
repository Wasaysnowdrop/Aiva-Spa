import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { buildCorsHeaders } from "@/lib/security/cors";
import { consumePublicRateLimit } from "@/lib/security/public-rate-limit";
import { tooManyRequests } from "@/lib/security/limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

const HEALTH_LIMIT = {
  bucket: "public:health",
  // Generous — uptime monitors poll every few seconds. Anything tighter
  // would false-positive during legit outages.
  options: { maxRequests: 300, windowMs: 60_000 },
} as const

function cors(request: Request) {
  return buildCorsHeaders(request)
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) })
}

async function checkSupabase(): Promise<{ ok: boolean; latencyMs: number | null; error?: string }> {
  const t0 = Date.now();
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("integrations_config").select("id", { head: true }).limit(1);
    if (error) return { ok: false, latencyMs: Date.now() - t0, error: error.message };
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(request: Request) {
  const rl = consumePublicRateLimit(request, HEALTH_LIMIT)
  if (rl.limited) return tooManyRequests(rl, cors(request))

  const db = await checkSupabase();
  const healthy = db.ok;
  const body = {
    status: healthy ? "ok" : "degraded",
    service: "aivaspa",
    version: process.env.npm_package_version ?? "0.1.0",
    env: process.env.NODE_ENV ?? "unknown",
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    checks: {
      database: db,
    },
  };
  return NextResponse.json(body, {
    status: healthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      ...cors(request),
    },
  });
}

export async function HEAD(request: Request) {
  // Mirror GET's verdict so monitoring tools that probe with HEAD first
  // see the real database health (503 when down) instead of a lying 200.
  const rl = consumePublicRateLimit(request, HEALTH_LIMIT)
  if (rl.limited) {
    return new Response(null, {
      status: 429,
      headers: { "Cache-Control": "no-store, max-age=0", "retry-after": "1" },
    })
  }
  const db = await checkSupabase()
  return new Response(null, {
    status: db.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}