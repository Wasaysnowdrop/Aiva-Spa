-- 00024_kb_final_fix.sql
--
-- Final, idempotent consolidation of the knowledge base schema, RLS, and
-- guardrails feature. This migration is safe to apply on top of every
-- earlier state (00001, 00019, 00020, 00021, 00022, 00023).
--
-- It guarantees, on every Supabase project, the following end state:
--
--   * knowledge_services / knowledge_faqs / knowledge_guardrails each have
--     a nullable `user_id uuid` column.
--   * knowledge_services.category is TEXT (no longer the knowledge_category
--     ENUM, so custom values like "Facials" persist).
--   * knowledge_guardrails has the columns required by the dashboard
--     Guardrails editor: `description` (the long-form rule), `rule_type`
--     (Safety / Pricing / Medical / Booking / Out of scope / Emergency /
--     General), and a permissive `is_active` boolean.
--   * RLS is enabled on every KB table with simple per-user policies:
--       - SELECT: row.user_id IS NULL OR row.user_id = auth.uid()
--       - INSERT: row.user_id = auth.uid()   (admin client bypasses RLS)
--       - UPDATE / DELETE: row.user_id = auth.uid()
--     The legacy "Authenticated users can ..." policies from 00001 are
--     dropped so they can no longer combine with the per-user policies
--     and produce "new row violates row-level security policy" errors.
--   * idx_*_user_id indexes exist so the policy lookups stay fast.
--   * An updated_at trigger keeps created_at / updated_at honest.
--
-- The Dashboard "New service" / "New guardrail" server actions
-- (app/actions/knowledge.ts → src/lib/db/knowledge.server.ts) write with
-- the Supabase service-role admin client which bypasses RLS, AND they
-- stamp `user_id = auth.uid()` on every insert so any RLS-enabled read
-- path can also see the row.

-- ============================================================
-- 1. knowledge_services
-- ============================================================

-- user_id column (nullable so legacy seed rows survive).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'knowledge_services'
      and column_name  = 'user_id'
  ) then
    alter table public.knowledge_services
      add column user_id uuid references auth.users(id) on delete cascade;
  end if;
end $$;

-- category must be TEXT (drop the legacy ENUM if it still exists).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'knowledge_services'
      and column_name  = 'category'
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

-- Coerce any blank categories so NOT NULL never fires on legacy data.
update public.knowledge_services
   set category = 'Skin'
 where category is null or btrim(category) = '';

-- Category sanity check (1..80 chars) — idempotent.
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

create index if not exists idx_knowledge_services_user_id
  on public.knowledge_services(user_id);

create index if not exists idx_knowledge_services_category
  on public.knowledge_services(category);

-- ============================================================
-- 2. knowledge_faqs
-- ============================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'knowledge_faqs'
      and column_name  = 'user_id'
  ) then
    alter table public.knowledge_faqs
      add column user_id uuid references auth.users(id) on delete cascade;
  end if;
end $$;

create index if not exists idx_knowledge_faqs_user_id
  on public.knowledge_faqs(user_id);

-- ============================================================
-- 3. knowledge_guardrails
-- ============================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'knowledge_guardrails'
      and column_name  = 'user_id'
  ) then
    alter table public.knowledge_guardrails
      add column user_id uuid references auth.users(id) on delete cascade;
  end if;

  -- The dashboard Guardrails editor uses `description` + `rule_type` +
  -- `is_active`. Legacy schema only had `body` + `enabled`. Map the old
  -- columns to the new ones, then add any columns that are missing so
  -- older databases don't reject the new INSERTs from the editor.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'knowledge_guardrails'
      and column_name  = 'description'
  ) then
    alter table public.knowledge_guardrails
      add column description text not null default '';
  end if;

  -- Backfill description from body if body has anything and description is empty.
  update public.knowledge_guardrails
     set description = coalesce(nullif(btrim(description), ''), body)
   where description is null or btrim(description) = '';

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'knowledge_guardrails'
      and column_name  = 'rule_type'
  ) then
    alter table public.knowledge_guardrails
      add column rule_type text not null default 'general';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'knowledge_guardrails'
      and column_name  = 'is_active'
  ) then
    alter table public.knowledge_guardrails
      add column is_active boolean not null default true;
  end if;

  -- Mirror enabled -> is_active for back-compat with legacy rows.
  update public.knowledge_guardrails
     set is_active = enabled
   where is_active is distinct from enabled;

  -- rule_type CHECK constraint: only allow the seven categories the
  -- dashboard dropdown exposes (Safety / Pricing / Medical / Booking /
  -- Out of scope / Emergency / General). Drop & re-create idempotently
  -- so prior migrations with a stricter list can be relaxed if needed.
  alter table public.knowledge_guardrails
    drop constraint if exists knowledge_guardrails_rule_type_chk;

  alter table public.knowledge_guardrails
    add constraint knowledge_guardrails_rule_type_chk
    check (
      rule_type in (
        'safety',
        'pricing',
        'medical',
        'booking',
        'out_of_scope',
        'emergency',
        'general'
      )
    );

  -- Coerce any legacy uppercase values to the lowercase canonical form
  -- expected by the CHECK constraint.
  update public.knowledge_guardrails
     set rule_type = lower(btrim(rule_type))
   where rule_type is not null;

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

create index if not exists idx_knowledge_guardrails_user_id
  on public.knowledge_guardrails(user_id);

-- ============================================================
-- 4. updated_at trigger for every KB table
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
-- 5. RLS — clean unified per-user policies on every KB table.
--    Drop every known legacy policy name so this migration is safe to
--    run regardless of which prior migrations landed remotely.
-- ============================================================

alter table public.knowledge_services   enable row level security;
alter table public.knowledge_faqs       enable row level security;
alter table public.knowledge_guardrails enable row level security;

do $$
begin
  -- Drop every policy name that has appeared on knowledge_services.
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

-- knowledge_services
create policy "kb_services_select"
  on public.knowledge_services
  for select to authenticated
  using (user_id is null or user_id = auth.uid());

create policy "kb_services_insert"
  on public.knowledge_services
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "kb_services_update"
  on public.knowledge_services
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "kb_services_delete"
  on public.knowledge_services
  for delete to authenticated
  using (user_id = auth.uid());

-- knowledge_faqs
create policy "kb_faqs_select"
  on public.knowledge_faqs
  for select to authenticated
  using (user_id is null or user_id = auth.uid());

create policy "kb_faqs_insert"
  on public.knowledge_faqs
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "kb_faqs_update"
  on public.knowledge_faqs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "kb_faqs_delete"
  on public.knowledge_faqs
  for delete to authenticated
  using (user_id = auth.uid());

-- knowledge_guardrails
create policy "kb_guardrails_select"
  on public.knowledge_guardrails
  for select to authenticated
  using (user_id is null or user_id = auth.uid());

create policy "kb_guardrails_insert"
  on public.knowledge_guardrails
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "kb_guardrails_update"
  on public.knowledge_guardrails
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "kb_guardrails_delete"
  on public.knowledge_guardrails
  for delete to authenticated
  using (user_id = auth.uid());
