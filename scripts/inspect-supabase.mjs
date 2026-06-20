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

const TABLES_TO_INSPECT = [
  "spa_settings",
  "team_members",
  "knowledge_services",
  "knowledge_faqs",
  "knowledge_guardrails",
  "widget_config",
  "widget_installs",
  "leads",
  "chat_sessions",
  "google_calendar_settings",
  "google_calendar_events",
  "subscriptions",
  "notification_channels",
  "notification_logs",
  "api_keys",
  "webhooks",
  "webhook_deliveries",
  "audit_logs",
  "integrations_config",
  "custom_domains",
  "custom_calendar_settings",
  "custom_calendar_events",
];

async function inspect() {
  console.log("=== USERS ===");
  let page = 1;
  const allUsers = [];
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) { console.error("listUsers error:", error); break; }
    if (!data?.users?.length) break;
    allUsers.push(...data.users);
    if (data.users.length < 100) break;
    page++;
  }
  console.log(`Total users: ${allUsers.length}`);
  for (const u of allUsers) {
    const isAdmin = u.app_metadata?.is_admin === true;
    console.log(`  ${isAdmin ? "[ADMIN]" : "[USER] "} ${u.id}  ${u.email}  created=${u.created_at}`);
  }

  console.log("\n=== TABLE COUNTS ===");
  for (const t of TABLES_TO_INSPECT) {
    try {
      const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
      if (error) {
        console.log(`  ${t}: ERROR ${error.message}`);
      } else {
        console.log(`  ${t}: ${count ?? 0}`);
      }
    } catch (e) {
      console.log(`  ${t}: SKIP (${e.message})`);
    }
  }
}

inspect().catch((e) => { console.error(e); process.exit(1); });