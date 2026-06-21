-- ============================================================
-- AivaSpa — Per-owner notification channels (RLS + unique key)
-- ============================================================
--
-- Migration 00017 added a `user_id` column to `notification_channels`
-- but did NOT change either of:
--
--   (a) the global UNIQUE(channel) constraint, which still limits the
--       table to one row per channel kind app-wide. That makes multi-
--       tenant owner-scoping impossible: the second user to sign up
--       can't have their own email channel.
--   (b) the permissive RLS policies (`using (true)`) on
--       notification_channels, which let every authenticated user read
--       and write every other owner's channels.
--
-- This migration fixes both. It is backward-compatible with legacy NULL-
-- user_id rows:
--
--   * Legacy NULL-user_id rows survive (they can be claimed by the next
--     owner-scope write via the `is("user_id", null)` predicate in the
--     application code).
--   * Dispatch treats NULL-user_id rows as global fallback for the rare
--     case where the owner scoping hasn't been migrated yet (see
--     src/lib/notifications/dispatch.ts).

-- 1. Drop the global UNIQUE(channel) constraint.
alter table notification_channels
  drop constraint if exists notification_channels_channel_key;

-- 2. Add a partial unique index so that, per user, you can have at most
--    one row per channel kind. NULL user_id rows are treated as
--    "legacy/global" and are NOT constrained by this index (so the
--    legacy global row survives).
create unique index if not exists uniq_notification_channels_channel_user
  on notification_channels(channel, user_id)
  where user_id is not null;

-- 3. Drop the permissive RLS policies from 00001.
do $$ begin
  drop policy if exists "Authenticated users can read notification_channels"
    on notification_channels;
  drop policy if exists "Authenticated users can insert notification_channels"
    on notification_channels;
  drop policy if exists "Authenticated users can update notification_channels"
    on notification_channels;
  drop policy if exists "Authenticated users can delete notification_channels"
    on notification_channels;
exception when others then null;
end $$;

-- 4. Replace them with owner-scoped policies.
--    Service-role writes (used by the dispatch background path) bypass
--    RLS automatically; authed users can only touch their own rows.
create policy "Users can read own notification_channels"
  on notification_channels for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own notification_channels"
  on notification_channels for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own notification_channels"
  on notification_channels for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own notification_channels"
  on notification_channels for delete to authenticated
  using (auth.uid() = user_id);

-- 5. Backfill: claim any legacy NULL-user_id rows for any user that
--    already has a spa_settings row (i.e. a real owner), preferring the
--    owner of the most recent spa_settings row. This is idempotent and
--    a no-op once every legacy row has been claimed.
do $$
declare
  claimed_count int := 0;
  r record;
begin
  for r in
    select nc.id
      from notification_channels nc
     where nc.user_id is null
       and exists (select 1 from spa_settings ss where ss.user_id is not null)
     limit 1
  loop
    -- Assign the legacy row to the most-recently-created spa_settings
    -- owner so a single owner can claim it. Other owners will create
    -- fresh per-user rows.
    update notification_channels
       set user_id = (
         select user_id from spa_settings
          where user_id is not null
          order by created_at desc nulls last
          limit 1
       ),
       updated_at = now()
     where id = r.id
       and user_id is null;
    get diagnostics claimed_count = row_count;
  end loop;
  raise notice 'notification owner-scope: claimed % legacy row(s)', claimed_count;
exception when others then
  raise notice 'notification owner-scope backfill skipped: %', sqlerrm;
end $$;
