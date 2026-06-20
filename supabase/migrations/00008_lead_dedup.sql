-- ============================================================
-- 00008 — Lead deduplication & merge
-- ============================================================
-- Adds normalized phone/email columns for fast duplicate lookups
-- (chat + form + phone all landing in the same leads table) and
-- a soft-merge mechanism so we never lose history.

-- 1. Normalized lookup columns
alter table leads
  add column if not exists phone_normalized text not null default '',
  add column if not exists email_normalized text not null default '';

-- 2. Soft-merge columns
alter table leads
  add column if not exists merged_into_id uuid references leads(id) on delete set null,
  add column if not exists merged_at timestamptz,
  add column if not exists merged_from jsonb not null default '[]'::jsonb;

-- 3. Indexes for fast dedup lookups
create index if not exists idx_leads_phone_normalized
  on leads(phone_normalized)
  where phone_normalized <> '';

create index if not exists idx_leads_email_normalized
  on leads(email_normalized)
  where email_normalized <> '';

create index if not exists idx_leads_merged_into_id
  on leads(merged_into_id)
  where merged_into_id is not null;

-- 4. RLS — the columns are covered by the existing "leads" policy,
--    but explicitly allow update of the new merge columns so the
--    server action can soft-merge without elevated privileges.
do $$ begin
  drop policy if exists "Authenticated users can update leads" on leads;
  create policy "Authenticated users can update leads"
    on leads for update to authenticated using (true) with check (true);
exception when others then null;
end $$;

-- 5. Realtime: merged events should also stream to the dashboard
--    so the inbox updates instantly after a merge.
do $$ begin
  begin
    alter publication supabase_realtime add table leads;
  exception when duplicate_object then null;
  end;
end $$;

-- 6. Backfill normalized columns for any existing rows so the
--    lookup behaves the same for legacy leads.
update leads
  set
    phone_normalized = case
      when phone is null or phone = '' then ''
      else right(regexp_replace(phone, '\D', '', 'g'), 10)
    end,
    email_normalized = case
      when email is null or email = '' then ''
      else lower(trim(email))
    end
  where phone_normalized = '' and email_normalized = '';
