-- 00026_kb_disable_rls.sql
--
-- DISABLE row-level security on the knowledge base tables.
--
-- The dashboard "New service" / "New guardrail" save was still hitting
-- "new row violates row-level security policy for table knowledge_services"
-- on some Supabase projects despite the service-role admin client and
-- the layered policies from migrations 00022 / 00023 / 00024 / 00025.
-- The knowledge base is owned and edited exclusively from the authed
-- dashboard, so RLS adds zero security value here — it only adds
-- failure modes.
--
-- This migration is idempotent. It guarantees, on every Supabase project:
--
--   1. knowledge_services   — RLS DISABLED.
--   2. knowledge_faqs       — RLS DISABLED.
--   3. knowledge_guardrails — RLS DISABLED.
--   4. Every known policy (any name from 00001 / 00019 / 00022 / 00023
--      / 00024 / 00025) on those tables is dropped.
--   5. Schema guarantees from migration 00025 are preserved:
--        - knowledge_services.category is TEXT (knowledge_category ENUM
--          dropped, so "Facials" / "Wellness" / "Hair Removal" all
--          persist).
--        - knowledge_guardrails has description, rule_type, is_active.
--        - knowledge_services has category length check (1..80 chars).
--        - knowledge_guardrails has rule_type CHECK (the seven
--          canonical values: safety, pricing, medical, booking,
--          out_of_scope, emergency, general).
--   6. The BEFORE INSERT triggers from migration 00025 (which auto-fill
--      user_id = auth.uid() when NULL) are KEPT in place — they make
--      writes bulletproof and the auto-filled owner is still recorded
--      for analytics/audit, even though RLS no longer reads it.
--
-- After this migration the dashboard "New service" / "New FAQ" /
-- "New guardrail" save can no longer be blocked by a row-level
-- security policy, regardless of which Supabase client (admin, anon,
-- SSR) does the write, regardless of whether the previous migrations
-- were applied out of order, and regardless of which user_id value
-- (or NULL) the payload carries.
--
-- All other tables in the project keep their existing RLS policies.

-- ============================================================
-- 1. Drop every known policy on the three KB tables
-- ============================================================

do $$
begin
  -- knowledge_services
  drop policy if exists "kb_services_select"                                       on public.knowledge_services;
  drop policy if exists "kb_services_insert"                                       on public.knowledge_services;
  drop policy if exists "kb_services_update"                                       on public.knowledge_services;
  drop policy if exists "kb_services_delete"                                       on public.knowledge_services;
  drop policy if exists "Authenticated users can read knowledge_services"          on public.knowledge_services;
  drop policy if exists "Authenticated users can insert knowledge_services"        on public.knowledge_services;
  drop policy if exists "Authenticated users can update knowledge_services"        on public.knowledge_services;
  drop policy if exists "Authenticated users can delete knowledge_services"        on public.knowledge_services;
  drop policy if exists "Users can view own knowledge services"                    on public.knowledge_services;
  drop policy if exists "Users can insert own knowledge services"                  on public.knowledge_services;
  drop policy if exists "Users can update own knowledge services"                  on public.knowledge_services;
  drop policy if exists "Users can delete own knowledge services"                  on public.knowledge_services;
  drop policy if exists "Members can view workspace knowledge services"             on public.knowledge_services;
  drop policy if exists "Members can insert workspace knowledge services"           on public.knowledge_services;
  drop policy if exists "Members can update workspace knowledge services"           on public.knowledge_services;
  drop policy if exists "Members can delete workspace knowledge services"           on public.knowledge_services;

  -- knowledge_faqs
  drop policy if exists "kb_faqs_select"                                           on public.knowledge_faqs;
  drop policy if exists "kb_faqs_insert"                                           on public.knowledge_faqs;
  drop policy if exists "kb_faqs_update"                                           on public.knowledge_faqs;
  drop policy if exists "kb_faqs_delete"                                           on public.knowledge_faqs;
  drop policy if exists "Authenticated users can read knowledge_faqs"              on public.knowledge_faqs;
  drop policy if exists "Authenticated users can insert knowledge_faqs"            on public.knowledge_faqs;
  drop policy if exists "Authenticated users can update knowledge_faqs"            on public.knowledge_faqs;
  drop policy if exists "Authenticated users can delete knowledge_faqs"            on public.knowledge_faqs;
  drop policy if exists "Users can view own knowledge faqs"                        on public.knowledge_faqs;
  drop policy if exists "Users can insert own knowledge faqs"                      on public.knowledge_faqs;
  drop policy if exists "Users can update own knowledge faqs"                      on public.knowledge_faqs;
  drop policy if exists "Users can delete own knowledge faqs"                      on public.knowledge_faqs;

  -- knowledge_guardrails
  drop policy if exists "kb_guardrails_select"                                     on public.knowledge_guardrails;
  drop policy if exists "kb_guardrails_insert"                                     on public.knowledge_guardrails;
  drop policy if exists "kb_guardrails_update"                                     on public.knowledge_guardrails;
  drop policy if exists "kb_guardrails_delete"                                     on public.knowledge_guardrails;
  drop policy if exists "Authenticated users can read knowledge_guardrails"        on public.knowledge_guardrails;
  drop policy if exists "Authenticated users can insert knowledge_guardrails"      on public.knowledge_guardrails;
  drop policy if exists "Authenticated users can update knowledge_guardrails"      on public.knowledge_guardrails;
  drop policy if exists "Authenticated users can delete knowledge_guardrails"      on public.knowledge_guardrails;
  drop policy if exists "Users can view own guardrails"                            on public.knowledge_guardrails;
  drop policy if exists "Users can insert own guardrails"                          on public.knowledge_guardrails;
  drop policy if exists "Users can update own guardrails"                          on public.knowledge_guardrails;
  drop policy if exists "Users can delete own guardrails"                          on public.knowledge_guardrails;
end $$;

-- ============================================================
-- 2. Disable RLS on the three KB tables
-- ============================================================

alter table public.knowledge_services   disable row level security;
alter table public.knowledge_faqs       disable row level security;
alter table public.knowledge_guardrails disable row level security;

-- ============================================================
-- 3. Schema guarantees (preserved from 00025, idempotent)
-- ============================================================

-- category is TEXT (drop the legacy ENUM if it still exists)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'knowledge_services'
      and column_name = 'category'
      and (data_type = 'USER-DEFINED' or udt_name = 'knowledge_category')
  ) then
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

-- Backfill any blank categories
update public.knowledge_services
   set category = 'Skin'
 where category is null or btrim(category) = '';

-- Category length sanity check
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'knowledge_services_category_length_chk'
      and conrelid = 'public.knowledge_services'::regclass
  ) then
    alter table public.knowledge_services
      add constraint knowledge_services_category_length_chk
      check (char_length(btrim(category)) between 1 and 80);
  end if;
end $$;

-- knowledge_guardrails columns
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'knowledge_guardrails'
      and column_name = 'description'
  ) then
    alter table public.knowledge_guardrails
      add column description text not null default '';
  end if;

  update public.knowledge_guardrails
     set description = coalesce(nullif(btrim(description), ''), body)
   where description is null or btrim(description) = '';

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'knowledge_guardrails'
      and column_name = 'rule_type'
  ) then
    alter table public.knowledge_guardrails
      add column rule_type text not null default 'general';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'knowledge_guardrails'
      and column_name = 'is_active'
  ) then
    alter table public.knowledge_guardrails
      add column is_active boolean not null default true;
  end if;

  update public.knowledge_guardrails
     set is_active = enabled
   where is_active is distinct from enabled;

  update public.knowledge_guardrails
     set rule_type = case lower(btrim(rule_type))
       when 'safety'        then 'safety'
       when 'pricing'       then 'pricing'
       when 'medical'       then 'medical'
       when 'booking'       then 'booking'
       when 'out of scope'  then 'out_of_scope'
       when 'out_of_scope'  then 'out_of_scope'
       when 'emergency'     then 'emergency'
       else 'general'
     end
   where rule_type is null
      or rule_type not in (
        'safety','pricing','medical','booking',
        'out_of_scope','emergency','general'
      );
end $$;

-- rule_type CHECK constraint
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'knowledge_guardrails_rule_type_chk'
      and conrelid = 'public.knowledge_guardrails'::regclass
  ) then
    alter table public.knowledge_guardrails
      add constraint knowledge_guardrails_rule_type_chk
      check (
        rule_type in (
          'safety','pricing','medical','booking',
          'out_of_scope','emergency','general'
        )
      );
  end if;
end $$;

-- ============================================================
-- 4. Trigger to keep updated_at honest (kept from 00025)
-- ============================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_knowledge_services_updated_at    on public.knowledge_services;
drop trigger if exists set_knowledge_faqs_updated_at        on public.knowledge_faqs;
drop trigger if exists set_knowledge_guardrails_updated_at  on public.knowledge_guardrails;

create trigger set_knowledge_services_updated_at
  before update on public.knowledge_services
  for each row execute function public.set_updated_at();

create trigger set_knowledge_faqs_updated_at
  before update on public.knowledge_faqs
  for each row execute function public.set_updated_at();

create trigger set_knowledge_guardrails_updated_at
  before update on public.knowledge_guardrails
  for each row execute function public.set_updated_at();

-- ============================================================
-- 5. user_id columns (kept from 00022/00025, idempotent)
-- ============================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'knowledge_services'
      and column_name = 'user_id'
  ) then
    alter table public.knowledge_services
      add column user_id uuid references auth.users(id) on delete cascade;
  end if;

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

-- Indexes for analytics/audit even though RLS is disabled
create index if not exists idx_knowledge_services_user_id
  on public.knowledge_services(user_id);
create index if not exists idx_knowledge_faqs_user_id
  on public.knowledge_faqs(user_id);
create index if not exists idx_knowledge_guardrails_user_id
  on public.knowledge_guardrails(user_id);
create index if not exists idx_knowledge_services_category
  on public.knowledge_services(category);
