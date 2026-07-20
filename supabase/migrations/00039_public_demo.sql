-- Public interactive demo data is intentionally isolated from customer data.
-- Every table is service-role only; anonymous visitors access it exclusively
-- through the validated /api/demo/* route handlers.

create table if not exists public.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  scenario_id text not null check (scenario_id in ('medical-spa', 'aesthetic-clinic', 'laser-clinic', 'cosmetic-dermatology')),
  session_token_hash text not null,
  anonymous_session_hash text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'expired', 'blocked')),
  message_count integer not null default 0 check (message_count >= 0),
  ai_request_count integer not null default 0 check (ai_request_count >= 0),
  generated_output_tokens integer not null default 0 check (generated_output_tokens >= 0),
  abuse_count integer not null default 0 check (abuse_count >= 0),
  lead_created boolean not null default false,
  sales_lead_created boolean not null default false,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  last_activity_at timestamptz not null default now(),
  source text not null default 'interactive_demo',
  referrer text,
  campaign jsonb not null default '{}'::jsonb,
  completion_percentage integer not null default 0 check (completion_percentage between 0 and 100),
  current_step text not null default 'scenario',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists demo_sessions_token_hash_idx on public.demo_sessions (session_token_hash);
create index if not exists demo_sessions_started_at_idx on public.demo_sessions (started_at desc);
create index if not exists demo_sessions_expiry_idx on public.demo_sessions (expires_at, last_activity_at);
create index if not exists demo_sessions_scenario_idx on public.demo_sessions (scenario_id, started_at desc);

create table if not exists public.demo_messages (
  id uuid primary key default gen_random_uuid(),
  demo_session_id uuid not null references public.demo_sessions(id) on delete cascade,
  role text not null check (role in ('visitor', 'assistant', 'event')),
  content text not null check (char_length(content) <= 4000),
  client_request_id text,
  response_source text check (response_source in ('deterministic', 'scripted', 'ai', 'fallback', 'system')),
  provider text,
  model text,
  output_tokens integer not null default 0 check (output_tokens >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists demo_messages_request_idx
  on public.demo_messages (demo_session_id, client_request_id)
  where client_request_id is not null and role = 'visitor';
create index if not exists demo_messages_session_idx on public.demo_messages (demo_session_id, created_at);

create table if not exists public.demo_leads (
  id uuid primary key default gen_random_uuid(),
  demo_session_id uuid not null unique references public.demo_sessions(id) on delete cascade,
  lead_type text not null default 'demo_test' check (lead_type = 'demo_test'),
  name text not null,
  email text not null,
  phone text,
  service text not null,
  preferred_date text not null,
  preferred_time text not null,
  notes text,
  consent_given boolean not null default false,
  status text not null default 'new' check (status in ('new', 'contacted', 'booked', 'lost')),
  assigned_to text,
  is_billable boolean not null default false check (is_billable = false),
  environment text not null default 'public_demo' check (environment = 'public_demo'),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists demo_leads_expiry_idx on public.demo_leads (expires_at);

create table if not exists public.demo_sales_leads (
  id uuid primary key default gen_random_uuid(),
  demo_session_id uuid not null unique references public.demo_sessions(id) on delete restrict,
  lead_type text not null default 'aivaspa_sales' check (lead_type = 'aivaspa_sales'),
  source text not null default 'interactive_demo' check (source = 'interactive_demo'),
  full_name text not null,
  business_name text not null,
  work_email text not null,
  phone text,
  website text,
  locations integer not null default 1 check (locations between 1 and 1000),
  monthly_enquiries text not null,
  current_process text not null,
  country_timezone text not null,
  preferred_contact_time text not null,
  consent_given boolean not null check (consent_given = true),
  consented_at timestamptz not null default now(),
  selected_scenario text not null,
  completion_percentage integer not null default 0 check (completion_percentage between 0 and 100),
  important_interactions jsonb not null default '[]'::jsonb,
  campaign jsonb not null default '{}'::jsonb,
  notification_status text not null default 'pending' check (notification_status in ('pending', 'delivered', 'failed')),
  notification_provider_id text,
  notification_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists demo_sales_leads_created_idx on public.demo_sales_leads (created_at desc);

create table if not exists public.demo_events (
  id bigint generated always as identity primary key,
  demo_session_id uuid references public.demo_sessions(id) on delete cascade,
  event_name text not null check (event_name in (
    'DEMO_PAGE_VIEWED', 'DEMO_STARTED', 'DEMO_SCENARIO_SELECTED', 'DEMO_CHAT_OPENED',
    'DEMO_MESSAGE_SENT', 'DEMO_CONSULTATION_STARTED', 'DEMO_TEST_LEAD_CREATED',
    'DEMO_BUSINESS_VIEW_OPENED', 'DEMO_COMPLETED', 'DEMO_SALES_FORM_OPENED',
    'DEMO_SALES_LEAD_SUBMITTED', 'DEMO_BOOK_WALKTHROUGH_CLICKED',
    'DEMO_SIGNUP_CLICKED', 'DEMO_LIMIT_REACHED', 'DEMO_ABUSE_BLOCKED'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists demo_events_name_created_idx on public.demo_events (event_name, created_at desc);
create index if not exists demo_events_session_idx on public.demo_events (demo_session_id, created_at);

-- Tag provider usage without adding it to customer billing or customer AI metrics.
alter table public.ai_usage add column if not exists environment text not null default 'production';
alter table public.ai_usage add column if not exists is_billable boolean not null default true;
alter table public.ai_usage add column if not exists demo_session_id uuid references public.demo_sessions(id) on delete set null;
create index if not exists ai_usage_demo_session_idx on public.ai_usage (demo_session_id) where demo_session_id is not null;

alter table public.demo_sessions enable row level security;
alter table public.demo_messages enable row level security;
alter table public.demo_leads enable row level security;
alter table public.demo_sales_leads enable row level security;
alter table public.demo_events enable row level security;

revoke all on public.demo_sessions from anon, authenticated;
revoke all on public.demo_messages from anon, authenticated;
revoke all on public.demo_leads from anon, authenticated;
revoke all on public.demo_sales_leads from anon, authenticated;
revoke all on public.demo_events from anon, authenticated;

create or replace function public.cleanup_expired_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_sessions integer := 0;
begin
  update public.demo_sessions
  set status = 'expired', updated_at = now()
  where status = 'active'
    and (expires_at <= now() or last_activity_at <= now() - interval '30 minutes');

  delete from public.demo_sessions
  where started_at < now() - interval '7 days'
     or (status = 'expired' and updated_at < now() - interval '24 hours');
  get diagnostics deleted_sessions = row_count;

  return jsonb_build_object('deleted_sessions', deleted_sessions, 'ran_at', now());
end;
$$;

revoke all on function public.cleanup_expired_demo_data() from public, anon, authenticated;
grant execute on function public.cleanup_expired_demo_data() to service_role;

