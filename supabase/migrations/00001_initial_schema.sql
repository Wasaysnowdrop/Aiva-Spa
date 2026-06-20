-- ============================================================
-- AivaSpa — Complete Schema Migration
-- ============================================================

-- 0. Extensions
create extension if not exists "pgcrypto";

-- 1. Enums
do $$ begin
  create type lead_status as enum ('new', 'contacted', 'booked', 'lost');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type lead_source as enum ('Website Chat', 'Mobile', 'Direct Link');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type team_role as enum ('Owner', 'Manager', 'Staff', 'Receptionist');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type team_member_status as enum ('active', 'invited', 'suspended');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type knowledge_category as enum ('Injectables', 'Skin', 'Body', 'Laser');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type faq_category as enum ('General', 'Pricing', 'Booking', 'Safety', 'Hours');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type notification_channel as enum ('Email', 'SMS');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type notification_status as enum ('delivered', 'pending', 'failed');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type widget_position as enum ('bottom-right', 'bottom-left');
exception when duplicate_object then null;
end $$;

-- 2. Tables

-- 2a. spa_settings (single-row-per-spa config)
create table if not exists spa_settings (
  id uuid primary key default gen_random_uuid(),
  spa_name text not null default '',
  website text not null default '',
  owner_name text not null default '',
  owner_email text not null default '',
  address text not null default '',
  plan text not null default 'Pro · $149/mo',
  payment_method text not null default 'Visa ending in 4242',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2b. team_members
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  role team_role not null default 'Staff',
  status team_member_status not null default 'active',
  last_active_at timestamptz,
  avatar_color text not null default '#8A8F98',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2c. knowledge_services
create table if not exists knowledge_services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category knowledge_category not null,
  description text not null default '',
  pricing_rule text not null default '',
  duration text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2d. knowledge_faqs
create table if not exists knowledge_faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null default '',
  category faq_category not null default 'General',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 2e. knowledge_guardrails
create table if not exists knowledge_guardrails (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2f. widget_config (single-row config)
create table if not exists widget_config (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null default 'Glow Med Spa',
  logo_initial text not null default 'G',
  primary_color text not null default '#E2E54B',
  position widget_position not null default 'bottom-right',
  welcome_message text not null default 'Hi! Are you looking to book a consultation or ask about a treatment?',
  proactive_enabled boolean not null default true,
  proactive_delay_seconds integer not null default 8,
  proactive_message text not null default 'Still browsing? I can answer questions or set up a consultation in seconds.',
  show_branding boolean not null default true,
  collect_email boolean not null default true,
  collect_phone boolean not null default true,
  consent_text text not null default 'By chatting, you agree to our privacy policy. We''ll only contact you about your inquiry.',
  working_hours jsonb not null default '{
    "enabled": false,
    "tz": "America/Los_Angeles",
    "schedule": [
      {"day": "Mon", "open": false, "from": "09:00", "to": "19:00"},
      {"day": "Tue", "open": true, "from": "09:00", "to": "19:00"},
      {"day": "Wed", "open": true, "from": "09:00", "to": "19:00"},
      {"day": "Thu", "open": true, "from": "09:00", "to": "19:00"},
      {"day": "Fri", "open": true, "from": "09:00", "to": "19:00"},
      {"day": "Sat", "open": true, "from": "09:00", "to": "17:00"},
      {"day": "Sun", "open": true, "from": "11:00", "to": "16:00"}
    ]
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2g. leads
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  email text not null default '',
  service text not null default 'Botox',
  preferred_time text not null default 'Not specified',
  status lead_status not null default 'new',
  source lead_source not null default 'Website Chat',
  source_url text not null default '/',
  after_hours boolean not null default false,
  notes text,
  transcript jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  assigned_to uuid references team_members(id) on delete set null,
  consent_given boolean not null default false
);

-- 2h. notification_logs
create table if not exists notification_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  lead_name text not null default '',
  channel notification_channel not null,
  recipient text not null,
  status notification_status not null default 'pending',
  sent_at timestamptz not null default now()
);

-- 2i. audit_logs
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_name text not null,
  action text not null,
  created_at timestamptz not null default now()
);

-- 2j. integrations_config
create table if not exists integrations_config (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  status text not null default 'available',
  icon text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2k. notification_channels (who gets notified how)
create table if not exists notification_channels (
  id uuid primary key default gen_random_uuid(),
  channel text not null unique,
  label text not null,
  description text not null default '',
  enabled boolean not null default false,
  recipients jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Indexes
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_created_at on leads(created_at);
create index if not exists idx_leads_assigned_to on leads(assigned_to);
create index if not exists idx_leads_service on leads(service);
create index if not exists idx_notification_logs_lead_id on notification_logs(lead_id);
create index if not exists idx_notification_logs_sent_at on notification_logs(sent_at);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at);
create index if not exists idx_knowledge_faqs_category on knowledge_faqs(category);
create index if not exists idx_team_members_role on team_members(role);
create index if not exists idx_team_members_status on team_members(status);

-- 4. Enable Row Level Security
alter table spa_settings enable row level security;
alter table team_members enable row level security;
alter table knowledge_services enable row level security;
alter table knowledge_faqs enable row level security;
alter table knowledge_guardrails enable row level security;
alter table widget_config enable row level security;
alter table leads enable row level security;
alter table notification_logs enable row level security;
alter table audit_logs enable row level security;
alter table integrations_config enable row level security;
alter table notification_channels enable row level security;

-- 5. RLS Policies (dropped first so re-runs are safe)

do $$ begin
  drop policy if exists "Authenticated users can read spa_settings" on spa_settings;
  drop policy if exists "Authenticated users can insert spa_settings" on spa_settings;
  drop policy if exists "Authenticated users can update spa_settings" on spa_settings;
  drop policy if exists "Authenticated users can read team_members" on team_members;
  drop policy if exists "Authenticated users can insert team_members" on team_members;
  drop policy if exists "Authenticated users can update team_members" on team_members;
  drop policy if exists "Authenticated users can delete team_members" on team_members;
  drop policy if exists "Authenticated users can read knowledge_services" on knowledge_services;
  drop policy if exists "Authenticated users can insert knowledge_services" on knowledge_services;
  drop policy if exists "Authenticated users can update knowledge_services" on knowledge_services;
  drop policy if exists "Authenticated users can delete knowledge_services" on knowledge_services;
  drop policy if exists "Authenticated users can read knowledge_faqs" on knowledge_faqs;
  drop policy if exists "Authenticated users can insert knowledge_faqs" on knowledge_faqs;
  drop policy if exists "Authenticated users can update knowledge_faqs" on knowledge_faqs;
  drop policy if exists "Authenticated users can delete knowledge_faqs" on knowledge_faqs;
  drop policy if exists "Authenticated users can read knowledge_guardrails" on knowledge_guardrails;
  drop policy if exists "Authenticated users can insert knowledge_guardrails" on knowledge_guardrails;
  drop policy if exists "Authenticated users can update knowledge_guardrails" on knowledge_guardrails;
  drop policy if exists "Authenticated users can delete knowledge_guardrails" on knowledge_guardrails;
  drop policy if exists "Authenticated users can read widget_config" on widget_config;
  drop policy if exists "Authenticated users can insert widget_config" on widget_config;
  drop policy if exists "Authenticated users can update widget_config" on widget_config;
  drop policy if exists "Authenticated users can read leads" on leads;
  drop policy if exists "Authenticated users can insert leads" on leads;
  drop policy if exists "Authenticated users can update leads" on leads;
  drop policy if exists "Authenticated users can delete leads" on leads;
  drop policy if exists "Authenticated users can read notification_logs" on notification_logs;
  drop policy if exists "Authenticated users can insert notification_logs" on notification_logs;
  drop policy if exists "Authenticated users can update notification_logs" on notification_logs;
  drop policy if exists "Authenticated users can delete notification_logs" on notification_logs;
  drop policy if exists "Authenticated users can read audit_logs" on audit_logs;
  drop policy if exists "Authenticated users can insert audit_logs" on audit_logs;
  drop policy if exists "Authenticated users can read integrations_config" on integrations_config;
  drop policy if exists "Authenticated users can insert integrations_config" on integrations_config;
  drop policy if exists "Authenticated users can update integrations_config" on integrations_config;
  drop policy if exists "Authenticated users can read notification_channels" on notification_channels;
  drop policy if exists "Authenticated users can insert notification_channels" on notification_channels;
  drop policy if exists "Authenticated users can update notification_channels" on notification_channels;

  create policy "Authenticated users can read spa_settings" on spa_settings for select to authenticated using (true);
  create policy "Authenticated users can insert spa_settings" on spa_settings for insert to authenticated with check (true);
  create policy "Authenticated users can update spa_settings" on spa_settings for update to authenticated using (true);
  create policy "Authenticated users can read team_members" on team_members for select to authenticated using (true);
  create policy "Authenticated users can insert team_members" on team_members for insert to authenticated with check (true);
  create policy "Authenticated users can update team_members" on team_members for update to authenticated using (true);
  create policy "Authenticated users can delete team_members" on team_members for delete to authenticated using (true);
  create policy "Authenticated users can read knowledge_services" on knowledge_services for select to authenticated using (true);
  create policy "Authenticated users can insert knowledge_services" on knowledge_services for insert to authenticated with check (true);
  create policy "Authenticated users can update knowledge_services" on knowledge_services for update to authenticated using (true);
  create policy "Authenticated users can delete knowledge_services" on knowledge_services for delete to authenticated using (true);
  create policy "Authenticated users can read knowledge_faqs" on knowledge_faqs for select to authenticated using (true);
  create policy "Authenticated users can insert knowledge_faqs" on knowledge_faqs for insert to authenticated with check (true);
  create policy "Authenticated users can update knowledge_faqs" on knowledge_faqs for update to authenticated using (true);
  create policy "Authenticated users can delete knowledge_faqs" on knowledge_faqs for delete to authenticated using (true);
  create policy "Authenticated users can read knowledge_guardrails" on knowledge_guardrails for select to authenticated using (true);
  create policy "Authenticated users can insert knowledge_guardrails" on knowledge_guardrails for insert to authenticated with check (true);
  create policy "Authenticated users can update knowledge_guardrails" on knowledge_guardrails for update to authenticated using (true);
  create policy "Authenticated users can delete knowledge_guardrails" on knowledge_guardrails for delete to authenticated using (true);
  create policy "Authenticated users can read widget_config" on widget_config for select to authenticated using (true);
  create policy "Authenticated users can insert widget_config" on widget_config for insert to authenticated with check (true);
  create policy "Authenticated users can update widget_config" on widget_config for update to authenticated using (true);
  create policy "Authenticated users can read leads" on leads for select to authenticated using (true);
  create policy "Authenticated users can insert leads" on leads for insert to authenticated with check (true);
  create policy "Authenticated users can update leads" on leads for update to authenticated using (true);
  create policy "Authenticated users can delete leads" on leads for delete to authenticated using (true);
  create policy "Authenticated users can read notification_logs" on notification_logs for select to authenticated using (true);
  create policy "Authenticated users can insert notification_logs" on notification_logs for insert to authenticated with check (true);
  create policy "Authenticated users can update notification_logs" on notification_logs for update to authenticated using (true);
  create policy "Authenticated users can delete notification_logs" on notification_logs for delete to authenticated using (true);
  create policy "Authenticated users can read audit_logs" on audit_logs for select to authenticated using (true);
  create policy "Authenticated users can insert audit_logs" on audit_logs for insert to authenticated with check (true);
  create policy "Authenticated users can read integrations_config" on integrations_config for select to authenticated using (true);
  create policy "Authenticated users can insert integrations_config" on integrations_config for insert to authenticated with check (true);
  create policy "Authenticated users can update integrations_config" on integrations_config for update to authenticated using (true);
  create policy "Authenticated users can read notification_channels" on notification_channels for select to authenticated using (true);
  create policy "Authenticated users can insert notification_channels" on notification_channels for insert to authenticated with check (true);
  create policy "Authenticated users can update notification_channels" on notification_channels for update to authenticated using (true);
end $$;

-- 6. Enable real-time (supabase-realtime publication)
-- Note: Run these separately in the Supabase dashboard under Database > Replication
-- or via:
-- begin;
--   drop publication if exists supabase_realtime;
--   create publication supabase_realtime;
-- commit;
-- alter publication supabase_realtime add table leads;
-- alter publication supabase_realtime add table team_members;
-- alter publication supabase_realtime add table knowledge_services;
-- alter publication supabase_realtime add table knowledge_faqs;
-- alter publication supabase_realtime add table knowledge_guardrails;
-- alter publication supabase_realtime add table widget_config;
-- alter publication supabase_realtime add table notification_logs;
-- alter publication supabase_realtime add table spa_settings;
-- alter publication supabase_realtime add table audit_logs;
-- alter publication supabase_realtime add table integrations_config;
-- alter publication supabase_realtime add table notification_channels;

-- 7. Seed data: core reference rows (only if team_members empty)
do $$
begin
  if not exists (select 1 from team_members limit 1) then
    insert into spa_settings (spa_name, website, owner_name, owner_email, address)
    values ('Glow Med Spa', 'https://glowmedspa.com', 'Alex Morgan', 'alex@glowmedspa.com', '123 Brannan St, San Francisco, CA 94107');
    insert into team_members (id, name, email, phone, role, status, last_active_at, avatar_color) values
      ('00000000-0000-0000-0000-000000000001', 'Alex Morgan', 'alex@glowmedspa.com', '(415) 555-0100', 'Owner', 'active', now(), '#E2E54B'),
      ('00000000-0000-0000-0000-000000000002', 'Priya Shah', 'priya@glowmedspa.com', '(415) 555-0101', 'Manager', 'active', now() - interval '2 hours', '#5E6AD2'),
      ('00000000-0000-0000-0000-000000000003', 'Jordan Reyes', 'jordan@glowmedspa.com', '(415) 555-0102', 'Staff', 'active', now() - interval '1 day', '#22D3EE'),
      ('00000000-0000-0000-0000-000000000004', 'Sam Carter', 'sam@glowmedspa.com', '(415) 555-0103', 'Receptionist', 'invited', null, '#34D399');
    insert into knowledge_services (name, category, description, pricing_rule, duration) values
      ('Botox', 'Injectables', 'Neuromodulator for fine lines and wrinkles. Results in 3–7 days, last 3–4 months.', 'Per unit, confirmed at consultation', '20 min'),
      ('Dermal Fillers', 'Injectables', 'Hyaluronic acid fillers for lips, cheeks, jawline. Last 6–18 months depending on product.', 'Per syringe, confirmed at consultation', '30 min'),
      ('Laser Hair Removal', 'Laser', 'Permanent hair reduction. Most areas need 6–8 sessions.', 'Per session / per package', '15–45 min'),
      ('HydraFacial', 'Skin', 'Deep cleansing, exfoliation, extraction, and hydration. No downtime.', 'Per session', '50 min'),
      ('Signature Facial', 'Skin', 'Classic European-style facial. Customized to your skin type.', 'Per session', '50 min'),
      ('Microneedling', 'Skin', 'Collagen induction therapy. Improves texture, scars, fine lines.', 'Per session / per package of 3', '60 min'),
      ('Chemical Peels', 'Skin', 'Light to medium peels for tone, sun damage, and texture.', 'Per peel, depth-dependent', '30–45 min'),
      ('CoolSculpting', 'Body', 'Non-invasive fat reduction. No downtime.', 'Per cycle, confirmed at consultation', '35–60 min/cycle'),
      ('EmSculpt', 'Body', 'Muscle building and fat reduction. Non-invasive.', 'Per session / per package of 4', '30 min');
    insert into knowledge_faqs (question, answer, category) values
      ('Do you offer Botox?', 'Yes, we offer Botox for forehead lines, crow''s feet, and frown lines. Pricing is per unit and confirmed at consultation by a licensed provider.', 'General'),
      ('How much does Botox cost?', 'Pricing depends on the number of units needed. A licensed provider confirms exact pricing during your consultation.', 'Pricing'),
      ('How do I book a consultation?', 'Share your name, phone, email, and preferred time here in chat. Our team will confirm the appointment within 1 business hour.', 'Booking'),
      ('What are your hours?', 'Tuesday–Friday 9 AM–7 PM, Saturday 9 AM–5 PM, Sunday 11 AM–4 PM. Closed Monday.', 'Hours'),
      ('Is laser hair removal permanent?', 'It provides permanent hair reduction. Most clients need 6–8 sessions for optimal results. Maintenance sessions may be needed.', 'General'),
      ('Is there downtime after microneedling?', 'Most clients experience mild redness for 24–48 hours. You can usually return to normal activities the next day.', 'Safety'),
      ('Do you offer payment plans?', 'Yes, we offer Cherry financing for treatments over $500. Ask at your consultation.', 'Pricing'),
      ('What should I do before a chemical peel?', 'Avoid retinol, exfoliants, and sun exposure for 5–7 days before your peel. We''ll send full pre-care instructions after booking.', 'Safety');
    insert into knowledge_guardrails (title, body, enabled) values
      ('Never quote firm prices', 'Always defer to a licensed provider during consultation.', true),
      ('No medical advice or diagnoses', 'Refuse to assess conditions, recommend treatments for symptoms, or guarantee outcomes.', true),
      ('Show disclaimer on first message', 'Display: "Information provided is general; a licensed provider confirms treatment suitability and pricing."', true),
      ('Capture explicit consent', 'Ask for permission to store contact details and reference the privacy policy.', true),
      ('Refuse out-of-scope topics', 'Graceful fallback: ''A team member can help with that — let me take your details.''', true),
      ('Auto-handoff to staff', 'Hand off to a human if the visitor requests it or asks pricing/medical questions twice.', false);
    insert into widget_config (brand_name) values ('Glow Med Spa');
    insert into integrations_config (name, description, status, icon) values
      ('Twilio SMS', 'Send and receive SMS via your business number.', 'connected', '💬'),
      ('SendGrid Email', 'Reliable transactional email delivery.', 'connected', '✉️'),
      ('Calendly', 'Embed a Calendly booking link in the chat.', 'available', '📅'),
      ('Zapier', 'Push leads to 6,000+ apps via webhooks.', 'available', '⚡'),
      ('HubSpot', 'Sync leads as contacts in your CRM.', 'available', '🟧');
    insert into notification_channels (channel, label, description, enabled, recipients) values
      ('email', 'Email', 'Instant email when a new lead is captured', true, '["alex@glowmedspa.com", "priya@glowmedspa.com", "jordan@glowmedspa.com"]'),
      ('sms', 'SMS', 'Instant SMS to mobile numbers (Twilio)', true, '["(415) 555-0100", "(415) 555-0101"]'),
      ('daily_summary', 'Daily summary', 'Every morning at 8 AM, get a recap of yesterday''s leads', false, '["alex@glowmedspa.com"]');
  end if;
end $$;
