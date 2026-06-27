import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL = "wffgaming188@gmail.com";

const TABLES_TO_WIPE = [
  "webhook_deliveries",
  "webhooks",
  "notification_logs",
  "notification_channels",
  "api_keys",
  "audit_logs",
  "google_calendar_events",
  "google_calendar_settings",
  "chat_sessions",
  "leads",
  "team_members",
  "knowledge_services",
  "knowledge_faqs",
  "knowledge_guardrails",
];

const TABLES_TO_KEEP = [
  "spa_settings",
  "widget_config",
  "widget_installs",
  "subscriptions",
  "integrations_config",
];

async function wipeTable(table) {
  const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) {
    return { table, ok: false, error: error.message };
  }
  return { table, ok: true };
}

async function run() {
  console.log("=== Step 1: Find admin user ===");
  const allUsers = [];
  let page = 1;
  while (true) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (!data?.users?.length) break;
    allUsers.push(...data.users);
    if (data.users.length < 100) break;
    page++;
  }
  const admin = allUsers.find((u) => u.email === ADMIN_EMAIL);
  if (!admin) {
    console.error(`Admin user ${ADMIN_EMAIL} not found. Aborting.`);
    process.exit(1);
  }
  console.log(`Admin found: ${admin.id} (${admin.email})`);

  console.log("\n=== Step 2: Delete non-admin users ===");
  for (const u of allUsers) {
    if (u.id === admin.id) continue;
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) {
      console.log(`  [FAIL] ${u.email} - ${error.message}`);
    } else {
      console.log(`  [DELETED] ${u.email}`);
    }
  }

  console.log("\n=== Step 3: Wipe dummy data tables ===");
  for (const t of TABLES_TO_WIPE) {
    const res = await wipeTable(t);
    if (res.ok) {
      console.log(`  [WIPED] ${t}`);
    } else {
      console.log(`  [FAIL]  ${t} - ${res.error}`);
    }
  }

  console.log("\n=== Step 4: Verify ===");
  for (const t of [...TABLES_TO_KEEP, ...TABLES_TO_WIPE]) {
    try {
      const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
      console.log(`  ${t}: ${count ?? 0} rows`);
    } catch {
      console.log(`  ${t}: SKIP`);
    }
  }

  const remaining = [];
  let p = 1;
  while (true) {
    const { data } = await supabase.auth.admin.listUsers({ page: p, perPage: 100 });
    if (!data?.users?.length) break;
    remaining.push(...data.users);
    if (data.users.length < 100) break;
    p++;
  }
  console.log(`\nRemaining auth users: ${remaining.length}`);
  for (const u of remaining) {
    const isAdmin = u.app_metadata?.is_admin === true;
    console.log(`  ${isAdmin ? "[ADMIN]" : "[USER] "} ${u.email}`);
  }
}

run().catch(() => { process.exit(1); });