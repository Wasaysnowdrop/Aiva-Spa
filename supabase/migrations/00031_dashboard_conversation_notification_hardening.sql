-- Tenant-safe dashboard conversations, idempotent usage metering, soft-delete,
-- and canonical onboarding notification recipients.

alter table public.leads
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists deleted_at timestamptz;

alter table public.chat_sessions
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists conversation_type text not null default 'internal',
  add column if not exists channel text not null default 'dashboard_internal',
  add column if not exists environment text not null default 'production',
  add column if not exists is_billable boolean not null default false,
  add column if not exists deleted_at timestamptz;

alter table public.notification_logs
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists detail jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.chat_sessions add constraint chat_sessions_conversation_type_check
    check (conversation_type in ('visitor', 'onboarding', 'internal', 'test', 'support'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.chat_sessions add constraint chat_sessions_channel_check
    check (channel in ('website_widget', 'onboarding_assistant', 'dashboard_internal', 'sms', 'email'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.chat_sessions add constraint chat_sessions_environment_check
    check (environment in ('production', 'preview', 'test'));
exception when duplicate_object then null; end $$;

create index if not exists leads_owner_active_idx
  on public.leads (user_id, created_at desc) where deleted_at is null;
create index if not exists chat_sessions_owner_visible_idx
  on public.chat_sessions (user_id, last_message_at desc)
  where deleted_at is null and conversation_type = 'visitor' and channel = 'website_widget';
create index if not exists notification_logs_owner_sent_idx
  on public.notification_logs (user_id, sent_at desc);

-- Recover ownership from durable install/session relationships. Historical
-- sessions without a captured lead remain explicitly internal/non-billable;
-- there was no reliable provenance field before this migration.
update public.chat_sessions session
set user_id = install.user_id
from public.widget_installs install
where session.user_id is null
  and install.widget_key = session.spa_id;

update public.leads lead
set user_id = session.user_id
from public.chat_sessions session
where lead.user_id is null
  and session.lead_id = lead.id
  and session.user_id is not null;

with sole_owner as (
  select (array_agg(distinct user_id))[1] as user_id
  from public.widget_installs
  having count(distinct user_id) = 1
)
update public.leads lead
set user_id = sole_owner.user_id
from sole_owner
where lead.user_id is null;

update public.chat_sessions
set conversation_type = 'visitor',
    channel = 'website_widget',
    environment = 'production',
    is_billable = true
where lead_id is not null
  and user_id is not null;

update public.notification_logs log
set user_id = lead.user_id
from public.leads lead
where log.user_id is null
  and log.lead_id = lead.id
  and lead.user_id is not null;

-- Usage events are the idempotency boundary. A session may create at most one
-- event in a subscription period, and the subscription counter is derived
-- from these rows instead of incremented optimistically in application code.
create table if not exists public.conversation_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  period_start timestamptz not null,
  metered_at timestamptz not null default now(),
  unique (user_id, session_id, period_start)
);

create index if not exists conversation_usage_events_owner_period_idx
  on public.conversation_usage_events (user_id, period_start);

alter table public.conversation_usage_events enable row level security;
drop policy if exists "Users can read own conversation usage" on public.conversation_usage_events;
create policy "Users can read own conversation usage"
  on public.conversation_usage_events for select to authenticated
  using (auth.uid() = user_id);

create or replace function public.meter_chat_session(p_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.chat_sessions%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_count integer := 0;
begin
  select * into v_session
  from public.chat_sessions
  where id = p_session_id;

  if v_session.id is null
     or v_session.user_id is null
     or v_session.deleted_at is not null
     or v_session.conversation_type <> 'visitor'
     or v_session.channel <> 'website_widget'
     or v_session.environment <> 'production'
     or not v_session.is_billable
     or not exists (
       select 1
       from jsonb_array_elements(coalesce(v_session.transcript, '[]'::jsonb)) message
       where message->>'role' = 'visitor' and nullif(btrim(message->>'content'), '') is not null
     ) then
    return 0;
  end if;

  select * into v_subscription
  from public.subscriptions
  where user_id = v_session.user_id
  for update;

  if v_subscription.id is null
     or v_session.created_at < v_subscription.period_start
     or v_session.created_at >= v_subscription.period_end then
    return 0;
  end if;

  insert into public.conversation_usage_events (user_id, session_id, period_start)
  values (v_session.user_id, v_session.id, v_subscription.period_start)
  on conflict (user_id, session_id, period_start) do nothing;

  select count(*)::integer into v_count
  from public.conversation_usage_events
  where user_id = v_session.user_id
    and period_start = v_subscription.period_start;

  update public.subscriptions
  set conversations_used = v_count,
      updated_at = now()
  where id = v_subscription.id;

  return v_count;
end;
$$;

create or replace function public.reconcile_conversation_usage(
  p_user_id uuid,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_before integer := 0;
  v_after integer := 0;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;

  select * into v_subscription
  from public.subscriptions
  where user_id = p_user_id
  for update;

  if v_subscription.id is null then
    return jsonb_build_object('before', 0, 'after', 0, 'dryRun', p_dry_run, 'found', false);
  end if;
  v_before := v_subscription.conversations_used;

  select count(*)::integer into v_after
  from public.chat_sessions session
  where session.user_id = p_user_id
    and session.created_at >= v_subscription.period_start
    and session.created_at < v_subscription.period_end
    and session.deleted_at is null
    and session.conversation_type = 'visitor'
    and session.channel = 'website_widget'
    and session.environment = 'production'
    and session.is_billable
    and exists (
      select 1
      from jsonb_array_elements(coalesce(session.transcript, '[]'::jsonb)) message
      where message->>'role' = 'visitor' and nullif(btrim(message->>'content'), '') is not null
    );

  if not p_dry_run then
    delete from public.conversation_usage_events
    where user_id = p_user_id and period_start = v_subscription.period_start;

    insert into public.conversation_usage_events (user_id, session_id, period_start)
    select p_user_id, session.id, v_subscription.period_start
    from public.chat_sessions session
    where session.user_id = p_user_id
      and session.created_at >= v_subscription.period_start
      and session.created_at < v_subscription.period_end
      and session.deleted_at is null
      and session.conversation_type = 'visitor'
      and session.channel = 'website_widget'
      and session.environment = 'production'
      and session.is_billable
      and exists (
        select 1
        from jsonb_array_elements(coalesce(session.transcript, '[]'::jsonb)) message
        where message->>'role' = 'visitor' and nullif(btrim(message->>'content'), '') is not null
      )
    on conflict (user_id, session_id, period_start) do nothing;

    update public.subscriptions
    set conversations_used = v_after, updated_at = now()
    where id = v_subscription.id;
  end if;

  return jsonb_build_object(
    'before', v_before,
    'after', v_after,
    'dryRun', p_dry_run,
    'found', true
  );
end;
$$;

create or replace function public.soft_delete_lead(p_lead_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;

  update public.leads
  set deleted_at = now(), last_activity_at = now()
  where id = p_lead_id and user_id = v_user_id and deleted_at is null;
  if not found then return false; end if;

  update public.chat_sessions
  set deleted_at = now(), status = 'abandoned', updated_at = now()
  where lead_id = p_lead_id and user_id = v_user_id and deleted_at is null;
  return true;
end;
$$;

create or replace function public.reopen_lead_chat(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;

  select id into v_session_id
  from public.chat_sessions
  where lead_id = p_lead_id
    and user_id = v_user_id
    and deleted_at is null
    and conversation_type = 'visitor'
    and channel = 'website_widget'
  order by last_message_at desc
  limit 1
  for update;

  if v_session_id is null then return null; end if;

  update public.chat_sessions
  set status = 'active', lead_captured = false, updated_at = now()
  where id = v_session_id;
  return v_session_id;
end;
$$;

-- Canonical notification-email upsert, used during onboarding turns and by
-- the auth metadata trigger that runs inside the final publish transaction.
create or replace function public.upsert_notification_email(p_user_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
begin
  if p_user_id is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'INVALID_NOTIFICATION_EMAIL';
  end if;

  insert into public.notification_channels (
    user_id, channel, label, description, enabled, recipients, updated_at
  ) values (
    p_user_id, 'email', 'Email', 'Instant email when a new lead is captured', true,
    jsonb_build_array(v_email), now()
  )
  on conflict (channel, user_id) where user_id is not null
  do update set
    enabled = true,
    label = excluded.label,
    description = excluded.description,
    recipients = (
      select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
      from (
        select distinct lower(btrim(value)) as value
        from jsonb_array_elements_text(
          coalesce(public.notification_channels.recipients, '[]'::jsonb) || excluded.recipients
        ) value
        where nullif(btrim(value), '') is not null
      ) recipients
    ),
    updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.sync_notification_email_from_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  v_email := new.raw_user_meta_data->>'notification_email';
  if v_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    perform public.upsert_notification_email(new.id, v_email);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_notification_email_from_metadata on auth.users;
create trigger sync_notification_email_from_metadata
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.sync_notification_email_from_metadata();

-- Idempotent backfill from structured onboarding metadata only.
with candidates as (
  select id,
    coalesce(
      raw_user_meta_data->>'notification_email',
      raw_user_meta_data #>> '{onboarding_kb,notifications,emailRecipients,0}',
      raw_user_meta_data #>> '{onboarding_kb_draft,notifications,emailRecipients,0}'
    ) as email
  from auth.users
)
select public.upsert_notification_email(id, email)
from candidates
where email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';

-- Replace permissive cross-tenant policies. Public widget writes use the
-- service-role client at the route boundary, so anonymous table access is not
-- required.
drop policy if exists "Authenticated users can read leads" on public.leads;
drop policy if exists "Authenticated users can insert leads" on public.leads;
drop policy if exists "Authenticated users can update leads" on public.leads;
drop policy if exists "Authenticated users can delete leads" on public.leads;
create policy "Users can read own active leads" on public.leads for select to authenticated
  using (auth.uid() = user_id and deleted_at is null);
create policy "Users can insert own leads" on public.leads for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update own leads" on public.leads for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Anon can insert chat_sessions" on public.chat_sessions;
drop policy if exists "Anon can read chat_sessions" on public.chat_sessions;
drop policy if exists "Anon can update chat_sessions" on public.chat_sessions;
drop policy if exists "Authenticated can read chat_sessions" on public.chat_sessions;
drop policy if exists "Authenticated can update chat_sessions" on public.chat_sessions;
create policy "Users can read own visitor chats" on public.chat_sessions for select to authenticated
  using (
    auth.uid() = user_id and deleted_at is null
    and conversation_type = 'visitor' and channel = 'website_widget'
  );
create policy "Users can update own visitor chats" on public.chat_sessions for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read notification_logs" on public.notification_logs;
drop policy if exists "Authenticated users can insert notification_logs" on public.notification_logs;
drop policy if exists "Authenticated users can update notification_logs" on public.notification_logs;
drop policy if exists "Authenticated users can delete notification_logs" on public.notification_logs;
create policy "Users can read own notification logs" on public.notification_logs for select to authenticated
  using (auth.uid() = user_id);

revoke all on function public.meter_chat_session(uuid) from public, anon, authenticated;
revoke all on function public.reconcile_conversation_usage(uuid, boolean) from public, anon;
revoke all on function public.soft_delete_lead(uuid) from public, anon;
revoke all on function public.reopen_lead_chat(uuid) from public, anon;
revoke all on function public.upsert_notification_email(uuid, text) from public, anon, authenticated;
grant execute on function public.meter_chat_session(uuid) to service_role;
grant execute on function public.reconcile_conversation_usage(uuid, boolean) to authenticated, service_role;
grant execute on function public.soft_delete_lead(uuid) to authenticated;
grant execute on function public.reopen_lead_chat(uuid) to authenticated;
grant execute on function public.upsert_notification_email(uuid, text) to service_role;

-- Correct currently inflated counters after the explicit eligibility backfill.
do $$
declare owner record;
begin
  for owner in select user_id from public.subscriptions loop
    perform public.reconcile_conversation_usage(owner.user_id, false);
  end loop;
end $$;
