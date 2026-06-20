-- ============================================================
-- 00010 — Active session expiry
-- ============================================================
-- Previously a chat_session was marked 'active' on first message
-- and stayed that way forever, so the "Live right now" counter
-- on the dashboard drifted higher and higher as test/demo/embed
-- sessions accumulated.
--
-- This migration:
--   1. Defines "active" as "had a message in the last 30 minutes".
--   2. Backfills: any session with status='active' and no message
--      in 30+ minutes is flipped to 'abandoned'.
--   3. Adds expire_chat_sessions() so the same flip can be run on
--      a schedule (or on-demand from the server) without keeping
--      a long-lived "active" status on the row.
--   4. Adds a covering index for the live "active in last 5 min"
--      count used by the dashboard.

create or replace function public.expire_chat_sessions(
  threshold_minutes integer default 30
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update chat_sessions
    set status = 'abandoned',
        updated_at = now()
    where status = 'active'
      and last_message_at < now() - make_interval(mins => threshold_minutes);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

do $$ begin
  grant execute on function public.expire_chat_sessions(integer) to service_role;
exception when others then null;
end $$;

select public.expire_chat_sessions(30);

create index if not exists idx_chat_sessions_active_recent
  on chat_sessions (last_message_at desc)
  where status = 'active';
