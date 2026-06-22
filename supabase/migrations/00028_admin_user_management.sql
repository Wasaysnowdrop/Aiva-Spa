-- Admin user management: ban list with reason / history.
-- The actual ban flag lives in auth.users.app_metadata.banned (set via
-- admin.auth.updateUserById) so it's reachable from a Supabase JWT and
-- the proxy.ts middleware can short-circuit banned users without a
-- per-request DB lookup. This table is the durable record of WHO banned
-- WHOM, WHEN, and WHY.
create table if not exists banned_users (
  user_id uuid primary key,
  email text null,
  reason text null,
  banned_by uuid null,
  banned_by_email text null,
  banned_at timestamptz not null default now(),
  unbanned_at timestamptz null,
  unbanned_by uuid null,
  unbanned_by_email text null
);

create index if not exists idx_banned_users_banned_at on banned_users(banned_at desc);
create index if not exists idx_banned_users_active on banned_users(user_id) where unbanned_at is null;

alter table banned_users enable row level security;

-- Only service role can read/write; the admin panel goes through the admin client.
drop policy if exists "Admins manage banned_users" on banned_users;
create policy "Admins manage banned_users" on banned_users
  for all to authenticated
  using (
    exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (u.raw_app_meta_data ->> 'is_admin')::boolean = true
    )
  )
  with check (
    exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (u.raw_app_meta_data ->> 'is_admin')::boolean = true
    )
  );
