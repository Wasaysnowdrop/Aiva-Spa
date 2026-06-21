"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ALL_SCOPES,
  API_KEY_PREFIX,
  generateApiKey,
  hashApiKey,
  type ApiKeyScope,
} from "@/lib/api/keys";

export type ApiKeyRecord = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type RawKey = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

function mapKey(row: RawKey): ApiKeyRecord {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: (row.scopes ?? []).filter((s): s is ApiKeyScope =>
      (ALL_SCOPES as string[]).includes(s),
    ) as ApiKeyScope[],
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((r) => mapKey(r as RawKey));
}

export type CreateApiKeyResult =
  | { ok: true; key: ApiKeyRecord; plaintext: string }
  | { ok: false; error: string };

export async function createApiKeyAction(
  formData: FormData,
): Promise<CreateApiKeyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/dashboard/settings?section=api");

  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 80) {
    return { ok: false, error: "Please enter a key name (1–80 characters)." };
  }

  const scopesRaw = formData.getAll("scopes").map(String);
  const scopes = (ALL_SCOPES as string[]).filter((s) => scopesRaw.includes(s));
  if (scopes.length === 0) {
    return { ok: false, error: "Pick at least one scope." };
  }

  const { full, prefix, hash } = generateApiKey();

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: user.id,
      name,
      key_prefix: prefix,
      key_hash: hash,
      scopes,
    } as never)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings");
  return { ok: true, key: mapKey(data as RawKey), plaintext: full };
}

export async function revokeApiKeyAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export type ApiKeyAuthResult =
  | { ok: true; userId: string; keyId: string; scopes: ApiKeyScope[] }
  | { ok: false; status: number; error: string };

export async function authenticateApiKey(
  providedKey: string | null,
): Promise<ApiKeyAuthResult> {
  if (!providedKey || !providedKey.startsWith(API_KEY_PREFIX)) {
    return { ok: false, status: 401, error: "Missing or malformed API key." };
  }
  const hash = hashApiKey(providedKey);
  // Use the admin client so we can look up the key regardless of RLS
  // (the request carries no Supabase auth context — just an API key).
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_keys")
    .select("id, user_id, scopes, revoked_at, expires_at")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, status: 401, error: "Invalid API key." };
  }
  const row = data as {
    id: string;
    user_id: string;
    scopes: string[];
    revoked_at: string | null;
    expires_at: string | null;
  };
  if (row.revoked_at) {
    return { ok: false, status: 401, error: "API key has been revoked." };
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 401, error: "API key has expired." };
  }
  // Fire-and-forget last_used update
  void admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() } as never)
    .eq("id", row.id);

  return {
    ok: true,
    userId: row.user_id,
    keyId: row.id,
    scopes: (row.scopes ?? []).filter((s): s is ApiKeyScope =>
      (ALL_SCOPES as string[]).includes(s),
    ),
  };
}
