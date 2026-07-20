-- AivaSpa admin control centre: persisted operations, incidents, and exact AI usage.

create table if not exists public.admin_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  category text not null check (category in ('leads','conversations','bookings','email','ai','subscriptions','security','admin')),
  business_id uuid references auth.users(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  target_type text,
  target_id text,
  status text not null default 'info',
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists admin_events_occurred_idx on public.admin_events(occurred_at desc);
create index if not exists admin_events_category_occurred_idx on public.admin_events(category, occurred_at desc);
create index if not exists admin_events_business_occurred_idx on public.admin_events(business_id, occurred_at desc);

create table if not exists public.admin_incidents (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text unique,
  title text not null,
  severity text not null check (severity in ('critical','high','medium','low')),
  service text not null,
  status text not null default 'open' check (status in ('open','investigating','monitoring','resolved')),
  detected_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  description text not null default '',
  affected_businesses integer not null default 0,
  error_count integer not null default 1,
  assigned_admin uuid references auth.users(id) on delete set null,
  resolution_notes text,
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists admin_incidents_status_detected_idx on public.admin_incidents(status, detected_at desc);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references auth.users(id) on delete set null,
  conversation_id uuid references public.chat_sessions(id) on delete set null,
  request_id text not null unique,
  provider text not null,
  model text not null,
  purpose text not null check (purpose in ('visitor_chat','onboarding','faq_extraction','service_extraction','compliance_check','internal_admin','fallback')),
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  cached_tokens integer not null default 0,
  total_tokens integer not null default 0,
  usage_source text not null check (usage_source in ('exact','estimated')),
  latency_ms integer not null default 0,
  status text not null check (status in ('success','error','fallback')),
  error_code text,
  estimated_cost_usd numeric(14,8) not null default 0,
  price_version text not null,
  pricing_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_created_idx on public.ai_usage(created_at desc);
create index if not exists ai_usage_business_created_idx on public.ai_usage(business_id, created_at desc);
create index if not exists ai_usage_status_created_idx on public.ai_usage(status, created_at desc);

alter table public.notification_logs
  add column if not exists email_type text not null default 'new_lead',
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists delivered_at timestamptz,
  add column if not exists latency_ms integer,
  add column if not exists error_reason text,
  add column if not exists provider_response jsonb not null default '{}'::jsonb;

alter table public.admin_events enable row level security;
alter table public.admin_incidents enable row level security;
alter table public.ai_usage enable row level security;

drop policy if exists "Admins can read admin events" on public.admin_events;
create policy "Admins can read admin events" on public.admin_events for select to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

drop policy if exists "Admins can read incidents" on public.admin_incidents;
create policy "Admins can read incidents" on public.admin_incidents for select to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

drop policy if exists "Admins can read AI usage" on public.ai_usage;
create policy "Admins can read AI usage" on public.ai_usage for select to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

create or replace function public.persist_admin_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_category text := tg_argv[0];
  v_type text := tg_argv[1];
  v_business uuid;
  v_target text;
  v_status text := 'info';
  v_metadata jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'leads' then
    v_business := new.user_id; v_target := new.id::text; v_status := 'success';
    v_metadata := jsonb_build_object('name', new.name, 'service', new.service, 'lead_status', new.status);
  elsif tg_table_name = 'chat_sessions' then
    if new.conversation_type <> 'visitor' or new.environment <> 'production' then return new; end if;
    v_business := new.user_id; v_target := new.id::text;
    v_metadata := jsonb_build_object('session_id', new.session_id, 'conversation_status', new.status, 'lead_captured', new.lead_captured);
  elsif tg_table_name = 'calendar_bookings' then
    v_business := new.user_id; v_target := new.id::text; v_status := case when new.status in ('cancelled','no_show') then 'warning' else 'success' end;
    v_metadata := jsonb_build_object('service', new.service, 'booking_status', new.status, 'start_at', new.start_at);
  elsif tg_table_name = 'notification_logs' then
    if lower(new.channel::text) <> 'email' then return new; end if;
    v_business := new.user_id; v_target := new.id::text; v_status := case when new.status::text = 'failed' then 'error' else 'success' end;
    v_metadata := jsonb_build_object('email_type', new.email_type, 'delivery_status', new.status, 'recipient_hint', regexp_replace(new.recipient, '(^.).*(@.*$)', '\\1***\\2'));
  elsif tg_table_name = 'subscriptions' then
    if tg_op = 'UPDATE' and new.plan = old.plan and new.status = old.status then return new; end if;
    v_business := new.user_id; v_target := new.id::text;
    v_metadata := jsonb_build_object('plan', new.plan, 'subscription_status', new.status, 'previous_plan', case when tg_op = 'UPDATE' then old.plan else null end, 'previous_status', case when tg_op = 'UPDATE' then old.status else null end);
  elsif tg_table_name = 'admin_audit_log' then
    v_target := new.target; v_business := null; v_status := 'info';
    v_metadata := jsonb_build_object('actor_email', new.admin_email, 'action', new.action, 'details', new.metadata);
  else
    return new;
  end if;

  insert into public.admin_events(event_type, category, business_id, user_id, target_type, target_id, status, metadata, occurred_at)
  values (v_type, v_category, v_business, case when tg_table_name = 'admin_audit_log' then new.admin_user_id else v_business end, tg_table_name, v_target, v_status, v_metadata, now());
  return new;
end $$;

drop trigger if exists admin_event_lead_created on public.leads;
create trigger admin_event_lead_created after insert on public.leads for each row execute function public.persist_admin_event('leads','lead.created');
drop trigger if exists admin_event_conversation_started on public.chat_sessions;
create trigger admin_event_conversation_started after insert on public.chat_sessions for each row execute function public.persist_admin_event('conversations','conversation.started');
drop trigger if exists admin_event_booking_created on public.calendar_bookings;
create trigger admin_event_booking_created after insert on public.calendar_bookings for each row execute function public.persist_admin_event('bookings','booking.created');
drop trigger if exists admin_event_email_delivery on public.notification_logs;
create trigger admin_event_email_delivery after insert or update of status on public.notification_logs for each row execute function public.persist_admin_event('email','email.delivery');
drop trigger if exists admin_event_subscription_changed on public.subscriptions;
create trigger admin_event_subscription_changed after insert or update of plan, status on public.subscriptions for each row execute function public.persist_admin_event('subscriptions','subscription.changed');
drop trigger if exists admin_event_admin_action on public.admin_audit_log;
create trigger admin_event_admin_action after insert on public.admin_audit_log for each row execute function public.persist_admin_event('admin','admin.action');

create or replace function public.get_admin_overview_metrics()
returns jsonb language sql security definer set search_path = public, auth stable as $$
  with bounds as (
    select date_trunc('day', now()) as today, date_trunc('day', now()) - interval '1 day' as yesterday
  ), metrics as (
    select
      (select count(*) from auth.users)::int as total_users,
      (select count(distinct user_id) from widget_installs where active)::int as active_businesses,
      (select count(*) from subscriptions where status in ('active','trialing'))::int as active_subscriptions,
      (select count(*) from chat_sessions, bounds where created_at >= bounds.today and conversation_type = 'visitor' and environment = 'production')::int as conversations_today,
      (select count(*) from chat_sessions, bounds where created_at >= bounds.yesterday and created_at < bounds.today and conversation_type = 'visitor' and environment = 'production')::int as conversations_previous,
      (select count(*) from leads, bounds where created_at >= bounds.today and deleted_at is null)::int as leads_today,
      (select count(*) from leads, bounds where created_at >= bounds.yesterday and created_at < bounds.today and deleted_at is null)::int as leads_previous,
      (select count(*) from calendar_bookings, bounds where created_at >= bounds.today)::int as bookings_today,
      (select count(*) from calendar_bookings, bounds where created_at >= bounds.yesterday and created_at < bounds.today)::int as bookings_previous,
      (select count(*) from ai_usage, bounds where created_at >= bounds.today)::int as ai_requests_today,
      (select count(*) from ai_usage, bounds where created_at >= bounds.yesterday and created_at < bounds.today)::int as ai_requests_previous,
      (select count(*) from notification_logs, bounds where sent_at >= bounds.today and lower(channel::text) = 'email')::int as emails_today,
      (select count(*) from notification_logs, bounds where sent_at >= bounds.today and lower(channel::text) = 'email' and status::text = 'delivered')::int as emails_delivered,
      (select count(*) from admin_incidents where status <> 'resolved')::int as open_incidents
  )
  select jsonb_build_object('generatedAt', now(), 'totalUsers', total_users, 'activeBusinesses', active_businesses,
    'activeSubscriptions', active_subscriptions, 'conversationsToday', conversations_today, 'conversationsPrevious', conversations_previous,
    'leadsToday', leads_today, 'leadsPrevious', leads_previous, 'bookingsToday', bookings_today, 'bookingsPrevious', bookings_previous,
    'aiRequestsToday', ai_requests_today, 'aiRequestsPrevious', ai_requests_previous, 'emailsToday', emails_today,
    'emailsDelivered', emails_delivered, 'emailDeliveryRate', case when emails_today = 0 then null else round(emails_delivered::numeric * 100 / emails_today, 1) end,
    'openIncidents', open_incidents) from metrics;
$$;

grant execute on function public.get_admin_overview_metrics() to service_role;

insert into public.admin_settings(key, value) values
('operations', '{"maintenance_mode":false,"support_contact":"support@aivaspa.online","system_announcement":"","default_rate_limit":60,"incident_thresholds":{"ai_failures":5,"email_failures":5,"booking_failures":3}}'::jsonb)
on conflict (key) do nothing;

do $$ begin
  begin alter publication supabase_realtime add table public.admin_events; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.admin_incidents; exception when duplicate_object then null; end;
end $$;

create or replace function public.detect_repeated_admin_failure()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_service text; v_title text; v_threshold integer; v_error_count integer; v_affected integer; v_key text; v_settings jsonb;
begin
  select value into v_settings from public.admin_settings where key = 'operations';
  if tg_table_name = 'ai_usage' then
    if new.status <> 'error' then return new; end if;
    v_service := 'AI provider'; v_title := 'AI request failure rate is elevated';
    v_threshold := coalesce((v_settings #>> '{incident_thresholds,ai_failures}')::integer, 5);
    select count(*), count(distinct business_id) into v_error_count, v_affected from public.ai_usage where status = 'error' and created_at >= now() - interval '15 minutes';
  elsif tg_table_name = 'notification_logs' then
    if lower(new.channel::text) <> 'email' or new.status::text <> 'failed' then return new; end if;
    v_service := 'Resend email'; v_title := 'Email delivery failures are elevated';
    v_threshold := coalesce((v_settings #>> '{incident_thresholds,email_failures}')::integer, 5);
    select count(*), count(distinct user_id) into v_error_count, v_affected from public.notification_logs where lower(channel::text) = 'email' and status::text = 'failed' and sent_at >= now() - interval '15 minutes';
  else return new;
  end if;
  if v_error_count < greatest(2, v_threshold) then return new; end if;
  v_key := lower(replace(v_service, ' ', '_')) || ':repeated_failure';
  insert into public.admin_incidents(dedupe_key, title, severity, service, status, description, affected_businesses, error_count, last_seen_at)
  values (v_key, v_title, case when v_error_count >= v_threshold * 3 then 'critical' when v_error_count >= v_threshold * 2 then 'high' else 'medium' end, v_service, 'open', format('%s failures were recorded in the last 15 minutes.', v_error_count), v_affected, v_error_count, now())
  on conflict (dedupe_key) do update set error_count = excluded.error_count, affected_businesses = excluded.affected_businesses, last_seen_at = now(), updated_at = now(), status = case when admin_incidents.status = 'resolved' and admin_incidents.resolved_at > now() - interval '1 hour' then admin_incidents.status else 'open' end;
  return new;
end $$;

drop trigger if exists detect_ai_usage_incident on public.ai_usage;
create trigger detect_ai_usage_incident after insert on public.ai_usage for each row execute function public.detect_repeated_admin_failure();
drop trigger if exists detect_email_delivery_incident on public.notification_logs;
create trigger detect_email_delivery_incident after insert or update of status on public.notification_logs for each row execute function public.detect_repeated_admin_failure();