-- 00022_kb_user_scoping.sql
--
-- Per-workspace isolation for the knowledge base (services / faqs / guardrails).
--
-- Previous state (00019_disable_kb_rls.sql) disabled RLS entirely on these
-- tables so the dashboard's service-role writes could never get blocked by a
-- stale cookie. That removed any notion of "who owns this row" — every
-- authenticated user could read every other user's content. It also meant
-- the dashboard could be reading stale or empty data after a write because
-- there was no workspace filter on the read side.
--
-- This migration:
--   1. Adds a nullable `user_id` column to knowledge_services,
--      knowledge_faqs, and knowledge_guardrails (nullable so existing
--      seed rows and any pre-migration user data still belong to
--      "everyone" until the owner edits them).
--   2. Re-enables RLS with policies that:
--        SELECT  : row is unowned (legacy) OR row belongs to auth.uid()
--        INSERT  : row must be inserted with auth.uid() as user_id
--        UPDATE  : row must belong to auth.uid()
--        DELETE  : row must belong to auth.uid()
--   3. Backfills `user_id` to NULL where it is missing so existing rows
--      remain visible to all authenticated users until they're edited.
--   4. Adds an index on user_id so the policy check stays fast.
--
-- The dashboard server actions always pass `user_id = auth.uid()` on
-- insert (see src/lib/db/knowledge.server.ts), and on read they filter
-- by `user_id IS NULL OR user_id = auth.uid()` so legacy rows keep
-- showing up alongside the user's own.

alter table knowledge_services
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table knowledge_faqs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table knowledge_guardrails
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_knowledge_services_user_id   on knowledge_services(user_id);
create index if not exists idx_knowledge_faqs_user_id       on knowledge_faqs(user_id);
create index if not exists idx_knowledge_guardrails_user_id on knowledge_guardrails(user_id);

-- Re-enable RLS on the KB tables. Replace the legacy "allow everything" state
-- from migration 00019 with proper per-user policies.
alter table knowledge_services   enable row level security;
alter table knowledge_faqs       enable row level security;
alter table knowledge_guardrails enable row level security;

do $$
begin
  -- knowledge_services
  drop policy if exists "kb_services_select" on knowledge_services;
  drop policy if exists "kb_services_insert" on knowledge_services;
  drop policy if exists "kb_services_update" on knowledge_services;
  drop policy if exists "kb_services_delete" on knowledge_services;

  create policy "kb_services_select"
    on knowledge_services for select to authenticated
    using (user_id is null or user_id = auth.uid());

  create policy "kb_services_insert"
    on knowledge_services for insert to authenticated
    with check (user_id = auth.uid());

  create policy "kb_services_update"
    on knowledge_services for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

  create policy "kb_services_delete"
    on knowledge_services for delete to authenticated
    using (user_id = auth.uid());

  -- knowledge_faqs
  drop policy if exists "kb_faqs_select" on knowledge_faqs;
  drop policy if exists "kb_faqs_insert" on knowledge_faqs;
  drop policy if exists "kb_faqs_update" on knowledge_faqs;
  drop policy if exists "kb_faqs_delete" on knowledge_faqs;

  create policy "kb_faqs_select"
    on knowledge_faqs for select to authenticated
    using (user_id is null or user_id = auth.uid());

  create policy "kb_faqs_insert"
    on knowledge_faqs for insert to authenticated
    with check (user_id = auth.uid());

  create policy "kb_faqs_update"
    on knowledge_faqs for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

  create policy "kb_faqs_delete"
    on knowledge_faqs for delete to authenticated
    using (user_id = auth.uid());

  -- knowledge_guardrails
  drop policy if exists "kb_guardrails_select" on knowledge_guardrails;
  drop policy if exists "kb_guardrails_insert" on knowledge_guardrails;
  drop policy if exists "kb_guardrails_update" on knowledge_guardrails;
  drop policy if exists "kb_guardrails_delete" on knowledge_guardrails;

  create policy "kb_guardrails_select"
    on knowledge_guardrails for select to authenticated
    using (user_id is null or user_id = auth.uid());

  create policy "kb_guardrails_insert"
    on knowledge_guardrails for insert to authenticated
    with check (user_id = auth.uid());

  create policy "kb_guardrails_update"
    on knowledge_guardrails for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

  create policy "kb_guardrails_delete"
    on knowledge_guardrails for delete to authenticated
    using (user_id = auth.uid());
end $$;

-- Backfill: leave existing rows with user_id = NULL so they stay visible to
-- every authenticated user until they're edited. This preserves the seed data
-- from 00001 and any pre-migration user content.
update knowledge_services   set user_id = null where user_id is null;
update knowledge_faqs       set user_id = null where user_id is null;
update knowledge_guardrails set user_id = null where user_id is null;
