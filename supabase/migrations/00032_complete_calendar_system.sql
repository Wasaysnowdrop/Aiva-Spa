-- Complete tenant-owned calendar system.
-- Reuses the existing custom calendar tables and adds ownership, richer
-- booking metadata, automatic lead synchronisation, reminder scheduling,
-- and strict row-level security.

alter table public.calendar_settings
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.calendar_bookings
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists conversation_id uuid references public.chat_sessions(id) on delete set null,
  add column if not exists visitor_name text,
  add column if not exists visitor_email text,
  add column if not exists visitor_phone text,
  add column if not exists timezone text not null default 'UTC',
  add column if not exists reminder_email_enabled boolean not null default true,
  add column if not exists reminder_sms_enabled boolean not null default true;

alter table public.calendar_reminders
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

update public.calendar_settings s
set user_id = (
  select wi.user_id
  from public.widget_installs wi
  where wi.widget_key = s.spa_id
  order by wi.created_at
  limit 1
)
where s.user_id is null;

update public.calendar_bookings b
set user_id = coalesce(
  (select l.user_id from public.leads l where l.id = b.lead_id),
  (select wi.user_id from public.widget_installs wi where wi.widget_key = b.spa_id order by wi.created_at limit 1)
)
where b.user_id is null;

update public.calendar_reminders r
set user_id = b.user_id
from public.calendar_bookings b
where r.booking_id = b.id and r.user_id is null;

alter table public.calendar_settings alter column user_id set not null;
alter table public.calendar_bookings alter column user_id set not null;
alter table public.calendar_reminders alter column user_id set not null;

alter table public.calendar_bookings
  drop constraint if exists calendar_bookings_status_check,
  drop constraint if exists calendar_bookings_source_check;

alter table public.calendar_bookings
  add constraint calendar_bookings_status_check
    check (status in ('pending','booked','confirmed','completed','cancelled','no_show')),
  add constraint calendar_bookings_source_check
    check (source in ('widget','api','lead','manual','imported','follow_up')),
  add constraint calendar_bookings_time_order_check check (end_at > start_at),
  add constraint calendar_bookings_duration_check check (duration_minutes between 5 and 1440);

create index if not exists idx_calendar_settings_user on public.calendar_settings(user_id);
create index if not exists idx_calendar_bookings_user_start on public.calendar_bookings(user_id, start_at);
create index if not exists idx_calendar_bookings_user_status on public.calendar_bookings(user_id, status);
create index if not exists idx_calendar_bookings_conversation on public.calendar_bookings(conversation_id);
create index if not exists idx_calendar_reminders_user_send on public.calendar_reminders(user_id, send_at);
create unique index if not exists calendar_bookings_one_active_per_lead
  on public.calendar_bookings(user_id, lead_id)
  where lead_id is not null and status not in ('completed','cancelled','no_show');
create unique index if not exists calendar_reminders_booking_channel_send
  on public.calendar_reminders(booking_id, channel, send_at);

create or replace function public.validate_calendar_booking_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spa_owner uuid;
  v_lead record;
  v_conversation_owner uuid;
begin
  select wi.user_id into v_spa_owner
  from public.widget_installs wi
  where wi.widget_key = new.spa_id
  order by wi.created_at
  limit 1;

  if new.user_id is null then new.user_id := v_spa_owner; end if;
  if v_spa_owner is null or v_spa_owner <> new.user_id then
    raise exception using errcode = '42501', message = 'BOOKING_SPA_OWNERSHIP_MISMATCH';
  end if;

  if new.lead_id is not null then
    select l.user_id, l.name, l.email, l.phone, l.service into v_lead
    from public.leads l
    where l.id = new.lead_id and l.deleted_at is null;
    if v_lead.user_id is null or v_lead.user_id <> new.user_id then
      raise exception using errcode = '42501', message = 'BOOKING_LEAD_OWNERSHIP_MISMATCH';
    end if;
    new.visitor_name := coalesce(nullif(btrim(new.visitor_name), ''), v_lead.name);
    new.visitor_email := coalesce(nullif(btrim(new.visitor_email), ''), nullif(btrim(v_lead.email), ''));
    new.visitor_phone := coalesce(nullif(btrim(new.visitor_phone), ''), nullif(btrim(v_lead.phone), ''));
    new.service := coalesce(nullif(btrim(new.service), ''), v_lead.service, 'Consultation');
  end if;

  if new.conversation_id is not null then
    select c.user_id into v_conversation_owner
    from public.chat_sessions c where c.id = new.conversation_id;
    if v_conversation_owner is null or v_conversation_owner <> new.user_id then
      raise exception using errcode = '42501', message = 'BOOKING_CONVERSATION_OWNERSHIP_MISMATCH';
    end if;
  end if;

  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception using errcode = '22023', message = 'INVALID_BOOKING_TIMEZONE';
  end if;

  if new.status = 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
  else
    new.cancelled_at := null;
    new.cancel_reason := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_calendar_booking_owner on public.calendar_bookings;
create trigger validate_calendar_booking_owner
before insert or update on public.calendar_bookings
for each row execute function public.validate_calendar_booking_owner();

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
    if v_send_at > now() and new.reminder_email_enabled and nullif(btrim(coalesce(new.visitor_email,'')), '') is not null then
      insert into public.calendar_reminders(user_id, booking_id, channel, recipient, send_at)
      values (new.user_id, new.id, 'email', new.visitor_email, v_send_at)
      on conflict (booking_id, channel, send_at) do nothing;
    end if;
    if v_send_at > now() and new.reminder_sms_enabled and nullif(btrim(coalesce(new.visitor_phone,'')), '') is not null then
      insert into public.calendar_reminders(user_id, booking_id, channel, recipient, send_at)
      values (new.user_id, new.id, 'sms', new.visitor_phone, v_send_at)
      on conflict (booking_id, channel, send_at) do nothing;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists sync_calendar_booking_reminders on public.calendar_bookings;
create trigger sync_calendar_booking_reminders
after insert or update of start_at, end_at, status, visitor_email, visitor_phone,
  reminder_email_enabled, reminder_sms_enabled
on public.calendar_bookings
for each row execute function public.sync_calendar_booking_reminders();

create or replace function public.try_parse_calendar_timestamp(p_value text)
returns timestamptz
language plpgsql
immutable
set search_path = public
as $$
begin
  return p_value::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function public.sync_lead_calendar_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spa_id text;
  v_start timestamptz;
  v_duration integer := 30;
  v_timezone text := 'UTC';
  v_conversation_id uuid;
  v_booking_id uuid;
begin
  if new.user_id is null then return new; end if;

  if new.deleted_at is not null or new.status = 'lost' then
    update public.calendar_bookings
    set status = 'cancelled', cancelled_at = now(),
        cancel_reason = case when new.deleted_at is not null then 'Lead deleted' else 'Lead marked lost' end
    where user_id = new.user_id and lead_id = new.id
      and status not in ('completed','cancelled','no_show');
    return new;
  end if;

  if new.status <> 'booked' then return new; end if;
  if coalesce(new.preferred_time, '') !~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}' then
    return new;
  end if;

  v_start := public.try_parse_calendar_timestamp(new.preferred_time);
  if v_start is null then return new; end if;
  select wi.widget_key into v_spa_id
  from public.widget_installs wi
  where wi.user_id = new.user_id
  order by wi.created_at
  limit 1;
  if v_spa_id is null then return new; end if;

  select s.booking_duration_minutes,
         coalesce(s.working_hours->>'tz', 'UTC')
  into v_duration, v_timezone
  from public.calendar_settings s
  where s.user_id = new.user_id and s.spa_id = v_spa_id
  limit 1;
  v_duration := coalesce(v_duration, 30);
  v_timezone := coalesce(v_timezone, 'UTC');

  select c.id into v_conversation_id
  from public.chat_sessions c
  where c.user_id = new.user_id and c.lead_id = new.id
    and c.conversation_type = 'visitor'
  order by c.created_at desc
  limit 1;

  select b.id into v_booking_id
  from public.calendar_bookings b
  where b.user_id = new.user_id and b.lead_id = new.id
    and b.status not in ('completed','cancelled','no_show')
  order by b.created_at desc
  limit 1;

  if v_booking_id is not null then
    update public.calendar_bookings
    set start_at = v_start,
        end_at = v_start + make_interval(mins => v_duration),
        duration_minutes = v_duration,
        service = new.service,
        visitor_name = new.name,
        visitor_email = nullif(btrim(new.email), ''),
        visitor_phone = nullif(btrim(new.phone), ''),
        conversation_id = coalesce(v_conversation_id, conversation_id),
        timezone = v_timezone,
        status = 'booked'
    where id = v_booking_id;
  else
    insert into public.calendar_bookings(
      user_id, spa_id, lead_id, conversation_id, source, start_at, end_at,
      duration_minutes, service, visitor_name, visitor_email, visitor_phone,
      timezone, status
    ) values (
      new.user_id, v_spa_id, new.id, v_conversation_id, 'lead', v_start,
      v_start + make_interval(mins => v_duration), v_duration, new.service,
      new.name, nullif(btrim(new.email), ''), nullif(btrim(new.phone), ''),
      v_timezone, 'booked'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists sync_lead_calendar_booking on public.leads;
create trigger sync_lead_calendar_booking
after insert or update of status, preferred_time, deleted_at, service, name, email, phone
on public.leads
for each row execute function public.sync_lead_calendar_booking();

-- Replace the original cross-tenant policies with owner-scoped policies.
drop policy if exists "Authenticated can read calendar_settings" on public.calendar_settings;
drop policy if exists "Authenticated can write calendar_settings" on public.calendar_settings;
drop policy if exists "Authenticated can write calendar_settings update" on public.calendar_settings;
drop policy if exists "Authenticated can write calendar_settings delete" on public.calendar_settings;
create policy "Users can read own calendar settings" on public.calendar_settings for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own calendar settings" on public.calendar_settings for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own calendar settings" on public.calendar_settings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own calendar settings" on public.calendar_settings for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Authenticated can read calendar_bookings" on public.calendar_bookings;
drop policy if exists "Authenticated can write calendar_bookings" on public.calendar_bookings;
drop policy if exists "Authenticated can write calendar_bookings update" on public.calendar_bookings;
drop policy if exists "Authenticated can write calendar_bookings delete" on public.calendar_bookings;
create policy "Users can read own calendar bookings" on public.calendar_bookings for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own calendar bookings" on public.calendar_bookings for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own calendar bookings" on public.calendar_bookings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own calendar bookings" on public.calendar_bookings for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Authenticated can read calendar_reminders" on public.calendar_reminders;
drop policy if exists "Authenticated can write calendar_reminders" on public.calendar_reminders;
drop policy if exists "Authenticated can write calendar_reminders update" on public.calendar_reminders;
drop policy if exists "Authenticated can write calendar_reminders delete" on public.calendar_reminders;
create policy "Users can read own calendar reminders" on public.calendar_reminders for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own calendar reminders" on public.calendar_reminders for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own calendar reminders" on public.calendar_reminders for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own calendar reminders" on public.calendar_reminders for delete to authenticated using (auth.uid() = user_id);

revoke all on function public.validate_calendar_booking_owner() from public, anon, authenticated;
revoke all on function public.sync_calendar_booking_reminders() from public, anon, authenticated;
revoke all on function public.sync_lead_calendar_booking() from public, anon, authenticated;
revoke all on function public.try_parse_calendar_timestamp(text) from public, anon, authenticated;
