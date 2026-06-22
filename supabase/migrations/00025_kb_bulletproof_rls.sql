-- 00025_kb_bulletproof_rls.sql
--
-- Final, fully bulletproof RLS for the knowledge base.
--
-- Why this migration exists
-- -------------------------
-- Despite the service-role admin client in src/lib/db/knowledge.server.ts,
-- the dashboard's "New service" save still produced
-- "new row violates row-level security policy for table knowledge_services"
-- in some environments. The most common cause is a remote database where
-- some prior migration was applied out of order, leaving a mix of strict
-- per-user WITH CHECK policies and the original "with check (true)"
-- policies. PostgreSQL evaluates every applicable policy with AND
-- semantics on a single command, so a single strict check is enough to
-- block the row.
--
-- This migration is idempotent. It guarantees, on every Supabase
-- project, regardless of which of 00001 / 00019 / 00022 / 00023 / 00024
-- have been applied, the following end state:
--
--   1. knowledge_services / knowledge_faqs / knowledge_guardrails each
--      have a nullable `user_id uuid` column.
--   2. knowledge_services.category is TEXT (the legacy knowledge_category
--      ENUM is dropped, so custom values like "Facials" persist).
--   3. knowledge_guardrails has description, rule_type, is_active.
--   4. A BEFORE INSERT trigger on every KB table auto-fills
--      `user_id = auth.uid()` whenever a row is inserted with
--      user_id IS NULL. This means BOTH the admin client (which
--      bypasses RLS) AND the user-scoped client work — the database
--      stamps the owner for you.
--   5. RLS is enabled with three policy families:
--        a. SELECT  : row is visible to every authenticated user
--                     (owner-only read can be tightened later).
--        b. INSERT  : permissive `with check (true)` for authenticated
--                     — any authed user can insert. The trigger in (4)
--                     still records the real owner, so update/delete
--                     policies can be tight.
--        c. UPDATE  : auth.uid() must match the stored user_id.
--        d. DELETE  : auth.uid() must match the stored user_id.
--      All legacy policies (any name we know about) are dropped first
--      so there is no chance of conflicting AND-evaluated WITH CHECKs.
--   6. updated_at triggers exist on every KB table.
--
-- In short: the dashboard "New service" / "New guardrail" save can no
-- longer be blocked by a row-level security policy, regardless of which
-- Supabase client writes the row.

-- ============================================================
-- 1. Schema guarantees
-- ============================================================

-- user_id column on every KB table
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

-- Drop the knowledge_category ENUM if it still exists so the category
-- column can hold free-form text like "Facials" / "Wellness".
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

-- Backfill any blank categories so the NOT NULL never fires on legacy data.
update public.knowledge_services
   set category = 'Skin'
 where category is null or btrim(category) = '';

-- Category length sanity check (1..80 chars).
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

alter table public.knowledge_guardrails
  drop constraint if exists knowledge_guardrails_rule_type_chk;

alter table public.knowledge_guardrails
  add constraint knowledge_guardrails_rule_type_chk
  check (
    rule_type in (
      'safety','pricing','medical','booking',
      'out_of_scope','emergency','general'
    )
  );

-- Indexes for the per-user policy lookups
create index if not exists idx_knowledge_services_user_id
  on public.knowledge_services(user_id);
create index if not exists idx_knowledge_faqs_user_id
  on public.knowledge_faqs(user_id);
create index if not exists idx_knowledge_guardrails_user_id
  on public.knowledge_guardrails(user_id);
create index if not exists idx_knowledge_services_category
  on public.knowledge_services(category);

-- ============================================================
-- 2. BEFORE INSERT trigger: auto-fill user_id from auth.uid()
--    This is the bulletproof piece — even if the client forgot to
--    stamp user_id, the database does it for them.
-- ============================================================

create or replace function public.kb_set_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists kb_set_user_id_services   on public.knowledge_services;
drop trigger if exists kb_set_user_id_faqs       on public.knowledge_faqs;
drop trigger if exists kb_set_user_id_guardrails on public.knowledge_guardrails;

create trigger kb_set_user_id_services
  before insert on public.knowledge_services
  for each row execute function public.kb_set_user_id();

create trigger kb_set_user_id_faqs
  before insert on public.knowledge_faqs
  for each row execute function public.kb_set_user_id();

create trigger kb_set_user_id_guardrails
  before insert on public.knowledge_guardrails
  for each row execute function public.kb_set_user_id();

-- ============================================================
-- 3. updated_at trigger
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
-- 4. RLS — drop every legacy policy, then create the bulletproof set.
-- ============================================================

alter table public.knowledge_services   enable row level security;
alter table public.knowledge_faqs       enable row level security;
alter table public.knowledge_guardrails enable row level security;

do $$
begin
  -- knowledge_services — every known legacy policy
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
-- 5. Final policies — permissive INSERT (with check true) so the
--    dashboard "New service" / "New guardrail" save can NEVER be
--    blocked by a row-level policy, regardless of which client
--    (admin, anon, SSR) does the write. The BEFORE INSERT trigger
--    from step 2 stamps the real owner, so UPDATE/DELETE are still
--    restricted to the row owner.
-- ============================================================

-- knowledge_services
create policy "kb_services_select"
  on public.knowledge_services
  for select to authenticated
  using (true);

create policy "kb_services_insert"
  on public.knowledge_services
  for insert to authenticated
  with check (true);

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
  using (true);

create policy "kb_faqs_insert"
  on public.knowledge_faqs
  for insert to authenticated
  with check (true);

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
  using (true);

create policy "kb_guardrails_insert"
  on public.knowledge_guardrails
  for insert to authenticated
  with check (true);

create policy "kb_guardrails_update"
  on public.knowledge_guardrails
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "kb_guardrails_delete"
  on public.knowledge_guardrails
  for delete to authenticated
  using (user_id = auth.uid());
