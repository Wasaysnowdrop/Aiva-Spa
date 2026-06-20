-- ============================================================
-- AivaSpa — API keys, Webhooks, and Webhook delivery log
-- ============================================================

-- 1. api_keys
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default array['leads:read','leads:write']::text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_keys_user on api_keys(user_id);
create index if not exists idx_api_keys_hash on api_keys(key_hash);

-- 2. webhooks
create table if not exists webhooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  secret text not null,
  events text[] not null default array['lead.created','lead.updated']::text[],
  active boolean not null default true,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_webhooks_user on webhooks(user_id);
create index if not exists idx_webhooks_active on webhooks(active);

-- 3. webhook_deliveries (audit / retry log)
create table if not exists webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references webhooks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,
  payload jsonb not null,
  response_status integer,
  response_body text,
  attempt integer not null default 1,
  duration_ms integer,
  success boolean not null default false,
  error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhook_deliveries_webhook on webhook_deliveries(webhook_id);
create index if not exists idx_webhook_deliveries_user on webhook_deliveries(user_id);
create index if not exists idx_webhook_deliveries_created on webhook_deliveries(created_at desc);

-- 4. RLS
alter table api_keys enable row level security;
alter table webhooks enable row level security;
alter table webhook_deliveries enable row level security;

do $$ begin
  drop policy if exists "Users can read own api keys" on api_keys;
  drop policy if exists "Users can insert own api keys" on api_keys;
  drop policy if exists "Users can update own api keys" on api_keys;
  drop policy if exists "Users can delete own api keys" on api_keys;

  drop policy if exists "Users can read own webhooks" on webhooks;
  drop policy if exists "Users can insert own webhooks" on webhooks;
  drop policy if exists "Users can update own webhooks" on webhooks;
  drop policy if exists "Users can delete own webhooks" on webhooks;

  drop policy if exists "Users can read own webhook deliveries" on webhooks;
  drop policy if exists "Service can write webhook deliveries" on webhooks;

  create policy "Users can read own api keys"
    on api_keys for select to authenticated using (auth.uid() = user_id);
  create policy "Users can insert own api keys"
    on api_keys for insert to authenticated with check (auth.uid() = user_id);
  create policy "Users can update own api keys"
    on api_keys for update to authenticated using (auth.uid() = user_id);
  create policy "Users can delete own api keys"
    on api_keys for delete to authenticated using (auth.uid() = user_id);

  create policy "Users can read own webhooks"
    on webhooks for select to authenticated using (auth.uid() = user_id);
  create policy "Users can insert own webhooks"
    on webhooks for insert to authenticated with check (auth.uid() = user_id);
  create policy "Users can update own webhooks"
    on webhooks for update to authenticated using (auth.uid() = user_id);
  create policy "Users can delete own webhooks"
    on webhooks for delete to authenticated using (auth.uid() = user_id);

  create policy "Users can read own webhook deliveries"
    on webhook_deliveries for select to authenticated
    using (auth.uid() = user_id);
  create policy "Service can write webhook deliveries"
    on webhook_deliveries for insert to authenticated
    with check (auth.uid() = user_id);
end $$;
