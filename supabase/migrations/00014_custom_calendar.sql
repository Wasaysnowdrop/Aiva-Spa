-- Custom Calendar (replaces Google Calendar integration)
-- 00014_custom_calendar.sql

-- Per-spa calendar settings: working hours, slot duration, buffer, reminder offsets
create table if not exists calendar_settings (
  id uuid primary key default gen_random_uuid(),
  spa_id text not null unique,
  booking_duration_minutes integer not null default 30,
  buffer_minutes integer not null default 15,
  working_hours jsonb not null default '{
    "tz": "America/Los_Angeles",
    "schedule": [
      {"day": 0, "open": false, "from": "09:00", "to": "17:00"},
      {"day": 1, "open": true,  "from": "09:00", "to": "19:00"},
      {"day": 2, "open": true,  "from": "09:00", "to": "19:00"},
      {"day": 3, "open": true,  "from": "09:00", "to": "19:00"},
      {"day": 4, "open": true,  "from": "09:00", "to": "19:00"},
      {"day": 5, "open": true,  "from": "09:00", "to": "19:00"},
      {"day": 6, "open": true,  "from": "09:00", "to": "17:00"}
    ]
  }'::jsonb,
  reminder_offsets_minutes integer[] not null default array[1440, 60]::integer[],
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_calendar_settings_spa on calendar_settings(spa_id);

-- Bookings created either by widget /api/calendar/book or auto-derived from a lead
create table if not exists calendar_bookings (
  id uuid primary key default gen_random_uuid(),
  spa_id text not null,
  lead_id uuid null references leads(id) on delete set null,
  source text not null default 'widget' check (source in ('widget', 'api', 'lead', 'manual')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes integer not null default 30,
  service text not null default 'Consultation',
  notes text null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed', 'no_show')),
  cancelled_at timestamptz null,
  cancel_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_calendar_bookings_spa_start on calendar_bookings(spa_id, start_at);
create index if not exists idx_calendar_bookings_lead on calendar_bookings(lead_id);
create index if not exists idx_calendar_bookings_status on calendar_bookings(status);
create index if not exists idx_calendar_bookings_start_at on calendar_bookings(start_at);

-- Reminders queued for a booking. The reminder worker (or our /api/calendar/reminders
-- cron endpoint) flips `sent_at` once delivered.
create table if not exists calendar_reminders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references calendar_bookings(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  recipient text not null,
  send_at timestamptz not null,
  sent_at timestamptz null,
  error text null,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_calendar_reminders_pending on calendar_reminders(send_at) where sent_at is null;
create index if not exists idx_calendar_reminders_booking on calendar_reminders(booking_id);

-- RLS: authenticated users can do everything on these tables; the service role
-- (used by the widget APIs) bypasses RLS entirely. This mirrors how the rest
-- of the app gates owner-only data.
alter table calendar_settings enable row level security;
alter table calendar_bookings enable row level security;
alter table calendar_reminders enable row level security;

do $$ begin
  drop policy if exists "Authenticated can read calendar_settings" on calendar_settings;
  drop policy if exists "Authenticated can write calendar_settings" on calendar_settings;
  drop policy if exists "Authenticated can read calendar_bookings" on calendar_bookings;
  drop policy if exists "Authenticated can write calendar_bookings" on calendar_bookings;
  drop policy if exists "Authenticated can read calendar_reminders" on calendar_reminders;
  drop policy if exists "Authenticated can write calendar_reminders" on calendar_reminders;

  create policy "Authenticated can read calendar_settings" on calendar_settings for select to authenticated using (true);
  create policy "Authenticated can write calendar_settings" on calendar_settings for insert to authenticated with check (true);
  create policy "Authenticated can write calendar_settings update" on calendar_settings for update to authenticated using (true);
  create policy "Authenticated can write calendar_settings delete" on calendar_settings for delete to authenticated using (true);

  create policy "Authenticated can read calendar_bookings" on calendar_bookings for select to authenticated using (true);
  create policy "Authenticated can write calendar_bookings" on calendar_bookings for insert to authenticated with check (true);
  create policy "Authenticated can write calendar_bookings update" on calendar_bookings for update to authenticated using (true);
  create policy "Authenticated can write calendar_bookings delete" on calendar_bookings for delete to authenticated using (true);

  create policy "Authenticated can read calendar_reminders" on calendar_reminders for select to authenticated using (true);
  create policy "Authenticated can write calendar_reminders" on calendar_reminders for insert to authenticated with check (true);
  create policy "Authenticated can write calendar_reminders update" on calendar_reminders for update to authenticated using (true);
  create policy "Authenticated can write calendar_reminders delete" on calendar_reminders for delete to authenticated using (true);
end $$;

-- Realtime: stream booking/reminder changes to the dashboard
do $$
begin
  begin alter publication supabase_realtime add table calendar_bookings; exception when others then null; end;
  begin alter publication supabase_realtime add table calendar_reminders; exception when others then null; end;
  begin alter publication supabase_realtime add table calendar_settings; exception when others then null; end;
end $$;
