-- Enforce ownership through the related widget install and booking rows too,
-- rather than trusting a caller-supplied user_id alone.

create or replace function public.validate_calendar_settings_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.widget_installs wi
    where wi.widget_key = new.spa_id
      and wi.user_id = new.user_id
  ) then
    raise exception using errcode = '42501', message = 'CALENDAR_SETTINGS_SPA_OWNERSHIP_MISMATCH';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_calendar_settings_owner on public.calendar_settings;
create trigger validate_calendar_settings_owner
before insert or update on public.calendar_settings
for each row execute function public.validate_calendar_settings_owner();

create or replace function public.validate_calendar_reminder_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_owner uuid;
begin
  select b.user_id into v_booking_owner
  from public.calendar_bookings b
  where b.id = new.booking_id;

  if v_booking_owner is null or v_booking_owner <> new.user_id then
    raise exception using errcode = '42501', message = 'CALENDAR_REMINDER_BOOKING_OWNERSHIP_MISMATCH';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_calendar_reminder_owner on public.calendar_reminders;
create trigger validate_calendar_reminder_owner
before insert or update on public.calendar_reminders
for each row execute function public.validate_calendar_reminder_owner();

revoke all on function public.validate_calendar_settings_owner() from public, anon, authenticated;
revoke all on function public.validate_calendar_reminder_owner() from public, anon, authenticated;