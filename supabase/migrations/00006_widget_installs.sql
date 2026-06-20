-- ============================================================
-- AivaSpa — Widget Installs (per-domain tracking + plan limits)
-- ============================================================

create table if not exists widget_installs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  widget_key text not null unique,
  domain text not null,
  label text not null default '',
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, domain)
);

create index if not exists idx_widget_installs_user_id on widget_installs(user_id);
create index if not exists idx_widget_installs_active on widget_installs(active);
create index if not exists idx_widget_installs_last_seen on widget_installs(last_seen_at);

alter table widget_installs enable row level security;

do $$ begin
  drop policy if exists "Users can read own widget installs" on widget_installs;
  drop policy if exists "Users can insert own widget installs" on widget_installs;
  drop policy if exists "Users can update own widget installs" on widget_installs;
  drop policy if exists "Users can delete own widget installs" on widget_installs;
  drop policy if exists "Public can read widget install by key" on widget_installs;

  create policy "Users can read own widget installs"
    on widget_installs for select to authenticated
    using (auth.uid() = user_id);
  create policy "Users can insert own widget installs"
    on widget_installs for insert to authenticated
    with check (auth.uid() = user_id);
  create policy "Users can update own widget installs"
    on widget_installs for update to authenticated
    using (auth.uid() = user_id);
  create policy "Users can delete own widget installs"
    on widget_installs for delete to authenticated
    using (auth.uid() = user_id);
  create policy "Public can read widget install by key"
    on widget_installs for select to anon, authenticated
    using (true);
end $$;
