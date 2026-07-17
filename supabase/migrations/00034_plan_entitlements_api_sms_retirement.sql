-- Canonical plan enforcement, API shutdown, email-only notifications, and tenant-safe team membership.

alter type public.subscription_status add value if not exists 'paused';
alter type public.subscription_status add value if not exists 'payment_failed';

alter table public.subscriptions
  add column if not exists pending_plan public.subscription_plan,
  add column if not exists pending_plan_effective_at timestamptz,
  add column if not exists billing_variant_id text,
  add column if not exists billing_provider text not null default 'lemon_squeezy';

update public.subscriptions
set monthly_quota = case plan::text
  when 'starter' then 300
  when 'growth' then 1500
  when 'pro' then 5000
  else monthly_quota
end;

-- The product API is retired. Preserve audit history, but revoke every credential
-- and remove customer access to the credential table.
update public.api_keys
set revoked_at = coalesce(revoked_at, now());

drop policy if exists "Users can read own api keys" on public.api_keys;
drop policy if exists "Users can insert own api keys" on public.api_keys;
drop policy if exists "Users can update own api keys" on public.api_keys;
drop policy if exists "Users can delete own api keys" on public.api_keys;
revoke all on table public.api_keys from authenticated;

-- Phase 1 of the SMS retirement: stop all new use while preserving delivered
-- notification/reminder history for audit purposes.
update public.notification_channels
set enabled = false, updated_at = now()
where lower(channel) = 'sms';

delete from public.calendar_reminders
where channel = 'sms' and sent_at is null;

update public.calendar_bookings
set reminder_sms_enabled = false
where reminder_sms_enabled is true;

delete from public.integrations_config
where lower(name) like '%twilio%' or lower(name) like '%sms%';

create or replace function public.sync_calendar_booking_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offset integer;
  v_offsets integer[];
  v_send_at timestamptz;
begin
  delete from public.calendar_reminders
  where booking_id = new.id and sent_at is null;

  if new.status not in ('pending','booked','confirmed') or new.start_at <= now() then
    return new;
  end if;

  select s.reminder_offsets_minutes into v_offsets
  from public.calendar_settings s
  where s.user_id = new.user_id and s.spa_id = new.spa_id
  limit 1;
  v_offsets := coalesce(v_offsets, array[1440,60]::integer[]);

  foreach v_offset in array v_offsets loop
    v_send_at := new.start_at - make_interval(mins => v_offset);
    if v_send_at > now()
       and new.reminder_email_enabled
       and nullif(btrim(coalesce(new.visitor_email,'')), '') is not null then
      insert into public.calendar_reminders(user_id, booking_id, channel, recipient, send_at)
      values (new.user_id, new.id, 'email', new.visitor_email, v_send_at)
      on conflict (booking_id, channel, send_at) do nothing;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists sync_calendar_booking_reminders on public.calendar_bookings;
create trigger sync_calendar_booking_reminders
after insert or update of start_at, end_at, status, visitor_email, reminder_email_enabled
on public.calendar_bookings
for each row execute function public.sync_calendar_booking_reminders();

-- Team members were historically global. Make them owner-scoped before enabling
-- Pro team management.
alter table public.team_members
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

with sole_owner as (
  select (array_agg(id))[1] as user_id from auth.users having count(*) = 1
)
update public.team_members member
set user_id = sole_owner.user_id
from sole_owner
where member.user_id is null;

alter table public.team_members drop constraint if exists team_members_email_key;
create unique index if not exists team_members_owner_email_key
  on public.team_members(user_id, lower(email))
  where user_id is not null;
create index if not exists team_members_owner_idx
  on public.team_members(user_id, created_at desc);

drop policy if exists "Authenticated users can read team_members" on public.team_members;
drop policy if exists "Authenticated users can insert team_members" on public.team_members;
drop policy if exists "Authenticated users can update team_members" on public.team_members;
drop policy if exists "Authenticated users can delete team_members" on public.team_members;
create policy "Owners can read own team members"
  on public.team_members for select to authenticated
  using (auth.uid() = user_id);
create policy "Owners can insert own team members"
  on public.team_members for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Owners can update own team members"
  on public.team_members for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owners can delete own team members"
  on public.team_members for delete to authenticated
  using (auth.uid() = user_id);

-- Atomic, idempotent quota enforcement. The database is authoritative even
-- when multiple chat requests arrive concurrently.
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
  v_plan text;
  v_quota integer;
begin
  select * into v_session from public.chat_sessions where id = p_session_id;
  if v_session.id is null
     or v_session.user_id is null
     or v_session.deleted_at is not null
     or v_session.conversation_type <> 'visitor'
     or v_session.channel <> 'website_widget'
     or v_session.environment <> 'production'
     or not v_session.is_billable
     or not exists (
       select 1 from jsonb_array_elements(coalesce(v_session.transcript, '[]'::jsonb)) message
       where message->>'role' = 'visitor'
         and nullif(btrim(message->>'content'), '') is not null
     ) then
    return 0;
  end if;

  select * into v_subscription
  from public.subscriptions
  where user_id = v_session.user_id
  for update;

  if v_subscription.id is null
     or v_subscription.period_end <= now()
     or not (
       v_subscription.status::text in ('active','trialing')
       or (v_subscription.status::text = 'canceled' and v_subscription.period_end > now())
     )
     or v_session.created_at < v_subscription.period_start
     or v_session.created_at >= v_subscription.period_end then
    return 0;
  end if;

  v_plan := case
    when v_subscription.pending_plan is not null
     and v_subscription.pending_plan_effective_at <= now()
      then v_subscription.pending_plan::text
    else v_subscription.plan::text
  end;
  v_quota := case v_plan when 'starter' then 300 when 'growth' then 1500 when 'pro' then 5000 else 0 end;

  select count(*)::integer into v_count
  from public.conversation_usage_events
  where user_id = v_session.user_id
    and period_start = v_subscription.period_start;

  if v_count >= v_quota then
    update public.subscriptions
    set conversations_used = v_count, monthly_quota = v_quota, updated_at = now()
    where id = v_subscription.id;
    return v_count;
  end if;

  insert into public.conversation_usage_events (user_id, session_id, period_start)
  values (v_session.user_id, v_session.id, v_subscription.period_start)
  on conflict (user_id, session_id, period_start) do nothing;

  select count(*)::integer into v_count
  from public.conversation_usage_events
  where user_id = v_session.user_id
    and period_start = v_subscription.period_start;

  update public.subscriptions
  set conversations_used = least(v_count, v_quota),
      monthly_quota = v_quota,
      updated_at = now()
  where id = v_subscription.id;

  return least(v_count, v_quota);
end;
$$;

revoke all on function public.meter_chat_session(uuid) from public;
grant execute on function public.meter_chat_session(uuid) to service_role;
