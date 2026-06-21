-- ============================================================
-- AivaSpa — White-label / custom domains (agency plan)
-- ============================================================
--
-- An owner on the Pro/Agency plan can map a custom domain (e.g.
-- `chat.clientsspa.com`) to their widget. The proxy looks up the host
-- header, finds the matching active row, and resolves the right
-- spaId. The widget then loads the owner's normal widget_config and
-- the chat works exactly as on aivaspa.online.

create extension if not exists pgcrypto;

create table if not exists custom_domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spa_id text not null,
  domain text not null unique,
  status text not null default 'pending' check (status in ('pending', 'active', 'disabled')),
  verification_token text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  verified_at timestamptz null,
  last_checked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_custom_domains_user_id on custom_domains(user_id);
create index if not exists idx_custom_domains_spa_id on custom_domains(spa_id);
create index if not exists idx_custom_domains_status on custom_domains(status);

alter table custom_domains enable row level security;

do $$ begin
  drop policy if exists "Users can read own custom domains" on custom_domains;
  drop policy if exists "Users can insert own custom domains" on custom_domains;
  drop policy if exists "Users can update own custom domains" on custom_domains;
  drop policy if exists "Users can delete own custom domains" on custom_domains;
  drop policy if exists "Public can read active custom domain" on custom_domains;

  create policy "Users can read own custom domains"
    on custom_domains for select to authenticated
    using (auth.uid() = user_id);
  create policy "Users can insert own custom domains"
    on custom_domains for insert to authenticated
    with check (auth.uid() = user_id);
  create policy "Users can update own custom domains"
    on custom_domains for update to authenticated
    using (auth.uid() = user_id);
  create policy "Users can delete own custom domains"
    on custom_domains for delete to authenticated
    using (auth.uid() = user_id);
  create policy "Public can read active custom domain"
    on custom_domains for select to anon, authenticated
    using (status = 'active');
end $$;
