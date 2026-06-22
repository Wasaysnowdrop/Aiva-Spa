-- 00023_kb_persistence_hardening.sql
--
-- Hardens knowledge_services persistence so the Dashboard > Knowledge Base
-- > Services & pricing tab survives page refresh.
--
-- Root cause fixed by this migration
-- ---------------------------------
-- The dashboard editor saves via a server action that uses the Supabase
-- service-role admin client (RLS-bypass) and then re-reads the list with the
-- browser anon client (RLS-enforced). If the schema is inconsistent — most
-- commonly because migration 00022_kb_user_scoping.sql was never applied on
-- the remote database — one of three failure modes occurs:
--
--   1. knowledge_services has no user_id column. The insert payload
--      includes user_id, the INSERT fails with
--      "column 'user_id' does not exist", and the row never lands.
--
--   2. knowledge_services.category is still the knowledge_category ENUM
--      from migration 00001. Custom categories like "Facials" / "Wellness"
--      / "Hair Removal" are rejected with
--      "invalid input value for enum".
--
--   3. RLS is disabled (state after 00019) but the browser anon client still
--      cannot read the freshly inserted rows because the anon client has
--      no session cookie and the dashboard never re-validates the row
--      against the user's auth.uid().
--
-- This migration is fully idempotent and safe to re-run. It brings any
-- remote database — whether migrations 00019–00022 were applied or not —
-- into the same end state that the dashboard code in
-- src/lib/db/knowledge.server.ts already assumes.
--
-- End state guaranteed by this migration:
--   * knowledge_services has columns:
--       id uuid pk, user_id uuid null, name text, category text,
--       description text, pricing_rule text, duration text,
--       active bool, created_at timestamptz, updated_at timestamptz
--   * knowledge_category enum (if it still exists) is dropped — category is text.
--   * idx_knowledge_services_user_id index exists.
--   * RLS is ENABLED.
--   * Per-user SELECT / INSERT / UPDATE / DELETE policies are in place
--     (legacy NULL user_id rows stay visible to every authenticated user
--     so seed data and pre-migration user content never disappears).
--   * updated_at trigger keeps created_at / updated_at honest.

-- ============================================================
-- 1. user_id column
-- ============================================================
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'knowledge_services'
      and column_name = 'user_id'
  ) then
    alter table public.knowledge_services
      add column user_id uuid references auth.users(id) on delete cascade;
  end if;
end $$;

-- ============================================================
-- 2. category column must be TEXT (not the old ENUM)
-- ============================================================
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'knowledge_services'
      and column_name = 'category'
      and (data_type = 'USER-DEFINED' or udt_name = 'knowledge_category')
  ) then
    -- Coerce existing enum values to text before we drop the type.
    alter table public.knowledge_services
      alter column category drop default;

    alter table public.knowledge_services
      alter column category type text using category::text;

    alter table public.knowledge_services
      alter column category set default 'Skin';

    alter table public.knowledge_services
      alter column category set not null;

    drop type if exists public.knowledge_category;
  end if;
end $$;

-- Category length sanity check (matches migration 00020).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'knowledge_services_category_length_chk'
      and conrelid = 'public.knowledge_services'::regclass
  ) then
    alter table public.knowledge_services
      add constraint knowledge_services_category_length_chk
      check (char_length(btrim(category)) between 1 and 80);
  end if;
end $$;

-- ============================================================
-- 3. Backfill any blank categories so NOT NULL is never violated.
-- ============================================================
update public.knowledge_services
set category = 'Skin'
where category is null or btrim(category) = '';

-- ============================================================
-- 4. Indexes
-- ============================================================
create index if not exists idx_knowledge_services_user_id
  on public.knowledge_services(user_id);

create index if not exists idx_knowledge_services_category
  on public.knowledge_services(category);

-- ============================================================
-- 5. updated_at trigger (keep timestamps honest)
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_knowledge_services_updated_at
  on public.knowledge_services;

create trigger set_knowledge_services_updated_at
  before update on public.knowledge_services
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- 6. RLS — enable and reset to per-user policies
-- ============================================================
alter table public.knowledge_services enable row level security;

do $$
begin
  -- Drop every policy we know about across all prior migrations so this
  -- migration is safe to run regardless of which ones landed remotely.
  drop policy if exists "kb_services_select"                       on public.knowledge_services;
  drop policy if exists "kb_services_insert"                       on public.knowledge_services;
  drop policy if exists "kb_services_update"                       on public.knowledge_services;
  drop policy if exists "kb_services_delete"                       on public.knowledge_services;
  drop policy if exists "Authenticated users can read knowledge_services"     on public.knowledge_services;
  drop policy if exists "Authenticated users can insert knowledge_services"   on public.knowledge_services;
  drop policy if exists "Authenticated users can update knowledge_services"   on public.knowledge_services;
  drop policy if exists "Authenticated users can delete knowledge_services"   on public.knowledge_services;

  create policy "kb_services_select"
    on public.knowledge_services
    for select
    to authenticated
    using (user_id is null or user_id = auth.uid());

  create policy "kb_services_insert"
    on public.knowledge_services
    for insert
    to authenticated
    with check (auth.uid() is not null and user_id = auth.uid());

  create policy "kb_services_update"
    on public.knowledge_services
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

  create policy "kb_services_delete"
    on public.knowledge_services
    for delete
    to authenticated
    using (user_id = auth.uid());
end $$;

-- ============================================================
-- 7. Knowledge base FAQ/guardrails get the same hardening so the
--    dashboard never silently loses data on those tabs either.
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'knowledge_faqs'
      and column_name = 'user_id'
  ) then
    alter table public.knowledge_faqs
      add column user_id uuid references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'knowledge_guardrails'
      and column_name = 'user_id'
  ) then
    alter table public.knowledge_guardrails
      add column user_id uuid references auth.users(id) on delete cascade;
  end if;
end $$;

create index if not exists idx_knowledge_faqs_user_id
  on public.knowledge_faqs(user_id);
create index if not exists idx_knowledge_guardrails_user_id
  on public.knowledge_guardrails(user_id);

alter table public.knowledge_faqs       enable row level security;
alter table public.knowledge_guardrails enable row level security;

drop trigger if exists set_knowledge_faqs_updated_at       on public.knowledge_faqs;
drop trigger if exists set_knowledge_guardrails_updated_at on public.knowledge_guardrails;

create trigger set_knowledge_faqs_updated_at
  before update on public.knowledge_faqs
  for each row
  execute function public.set_updated_at();

create trigger set_knowledge_guardrails_updated_at
  before update on public.knowledge_guardrails
  for each row
  execute function public.set_updated_at();

do $$
begin
  drop policy if exists "kb_faqs_select"       on public.knowledge_faqs;
  drop policy if exists "kb_faqs_insert"       on public.knowledge_faqs;
  drop policy if exists "kb_faqs_update"       on public.knowledge_faqs;
  drop policy if exists "kb_faqs_delete"       on public.knowledge_faqs;
  drop policy if exists "kb_guardrails_select" on public.knowledge_guardrails;
  drop policy if exists "kb_guardrails_insert" on public.knowledge_guardrails;
  drop policy if exists "kb_guardrails_update" on public.knowledge_guardrails;
  drop policy if exists "kb_guardrails_delete" on public.knowledge_guardrails;

  create policy "kb_faqs_select" on public.knowledge_faqs
    for select to authenticated
    using (user_id is null or user_id = auth.uid());

  create policy "kb_faqs_insert" on public.knowledge_faqs
    for insert to authenticated
    with check (auth.uid() is not null and user_id = auth.uid());

  create policy "kb_faqs_update" on public.knowledge_faqs
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

  create policy "kb_faqs_delete" on public.knowledge_faqs
    for delete to authenticated
    using (user_id = auth.uid());

  create policy "kb_guardrails_select" on public.knowledge_guardrails
    for select to authenticated
    using (user_id is null or user_id = auth.uid());

  create policy "kb_guardrails_insert" on public.knowledge_guardrails
    for insert to authenticated
    with check (auth.uid() is not null and user_id = auth.uid());

  create policy "kb_guardrails_update" on public.knowledge_guardrails
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

  create policy "kb_guardrails_delete" on public.knowledge_guardrails
    for delete to authenticated
    using (user_id = auth.uid());
end $$;
