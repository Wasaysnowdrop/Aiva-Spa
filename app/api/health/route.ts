import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

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

export async function GET() {
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
    },
  });
}

export function HEAD() {
  return new Response(null, { status: 200 });
}