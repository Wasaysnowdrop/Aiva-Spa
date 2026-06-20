-- ============================================================
-- 00003_chat_sessions.sql
-- Live, real-time visitor chat sessions (one row per browser session).
-- Updated on every chat turn so the dashboard can subscribe via Supabase
-- Realtime and see the conversation unfold live — not just after a lead
-- is captured.
-- ============================================================

create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  spa_id text not null default 'default',
  transcript jsonb not null default '[]'::jsonb,
  message_count integer not null default 0,
  last_message text not null default '',
  last_role text not null default 'visitor',
  last_message_at timestamptz not null default now(),
  source_url text not null default '/',
  after_hours boolean not null default false,
  visitor_name text,
  lead_captured boolean not null default false,
  lead_id uuid references leads(id) on delete set null,
  consent_given boolean not null default false,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_chat_sessions_session_id on chat_sessions(session_id);
create index if not exists idx_chat_sessions_last_message_at on chat_sessions(last_message_at desc);
create index if not exists idx_chat_sessions_lead_captured on chat_sessions(lead_captured);
create index if not exists idx_chat_sessions_status on chat_sessions(status);

-- Auto-update updated_at on row changes
create or replace function set_updated_at_chat_sessions()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_chat_sessions_updated_at on chat_sessions;
create trigger trg_chat_sessions_updated_at
  before update on chat_sessions
  for each row execute function set_updated_at_chat_sessions();

alter table chat_sessions enable row level security;

-- Public can insert/update their own chat session (server uses service role
-- key for writes; the anon key is used for realtime SELECT in the widget).
drop policy if exists "Public can read chat_sessions" on chat_sessions;
drop policy if exists "Service role can write chat_sessions" on chat_sessions;
drop policy if exists "Anon can upsert chat_sessions" on chat_sessions;
drop policy if exists "Authenticated can read chat_sessions" on chat_sessions;
drop policy if exists "Authenticated can update chat_sessions" on chat_sessions;

create policy "Authenticated can read chat_sessions"
  on chat_sessions for select to authenticated using (true);
create policy "Anon can read chat_sessions"
  on chat_sessions for select to anon using (true);
create policy "Anon can insert chat_sessions"
  on chat_sessions for insert to anon with check (true);
create policy "Anon can update chat_sessions"
  on chat_sessions for update to anon using (true) with check (true);
create policy "Authenticated can update chat_sessions"
  on chat_sessions for update to authenticated using (true) with check (true);

-- Add to the supabase_realtime publication so dashboard clients receive
-- postgres_changes events for this table.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table chat_sessions;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
