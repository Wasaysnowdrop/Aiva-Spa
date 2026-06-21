-- ============================================================
-- AivaSpa — Owner scoping for notification channels
-- ============================================================
--
-- notification_channels was created in 00001 as a single-tenant config
-- (no user_id). For multi-tenant deployments we need to scope each
-- channel to its owner so leads from one spa don't fan out to other
-- spas' notification recipients.
--
-- This migration is backward-compatible: existing rows keep user_id NULL
-- and dispatch treats those as legacy/global defaults (see
-- src/lib/notifications/dispatch.ts).

alter table notification_channels
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_notification_channels_user
  on notification_channels(user_id);

-- Index over lead_name so admin notification log search stays fast.
create index if not exists idx_notification_logs_lead_name
  on notification_logs(lead_name);

-- Realtime: ensure chat_sessions realtime subscription survives a clean
-- re-run of the publication. The Supabase Realtime publication guard is
-- idempotent.
do $$ begin
  begin
    alter publication supabase_realtime add table chat_sessions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table leads;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table notification_logs;
  exception when duplicate_object then null;
  end;
end $$;

-- Fix idempotency bug from migration 00007: the two drop policy
-- statements on lines 75-76 targeted the WRONG table (`webhooks`).
-- On re-run, the create policy statements at 96-101 (on the correct
-- table `webhook_deliveries`) failed with "policy already exists".
-- Drop the policies on the correct table so this migration is safe to
-- re-run alongside the existing 00007.
do $$ begin
  drop policy if exists "Users can read own webhook deliveries" on webhook_deliveries;
  drop policy if exists "Service can write webhook deliveries" on webhook_deliveries;
exception when others then null;
end $$;
