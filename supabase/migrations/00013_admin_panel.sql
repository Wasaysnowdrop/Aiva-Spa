-- Admin panel: feature flags, kill switches, admin audit log
create table if not exists admin_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  admin_email text not null,
  action text not null,
  target text null,
  metadata jsonb not null default '{}'::jsonb,
  ip text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_created_at on admin_audit_log(created_at desc);
create index if not exists idx_admin_audit_log_admin on admin_audit_log(admin_user_id);

alter table admin_settings enable row level security;
alter table admin_audit_log enable row level security;

-- Only service role can read/write these; the admin pages go through the admin client.
drop policy if exists "Admins manage admin_settings" on admin_settings;
create policy "Admins manage admin_settings" on admin_settings
  for all to authenticated
  using (
    exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (u.raw_app_meta_data ->> 'is_admin')::boolean = true
    )
  )
  with check (
    exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (u.raw_app_meta_data ->> 'is_admin')::boolean = true
    )
  );

drop policy if exists "Admins manage admin_audit_log" on admin_audit_log;
create policy "Admins manage admin_audit_log" on admin_audit_log
  for all to authenticated
  using (
    exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (u.raw_app_meta_data ->> 'is_admin')::boolean = true
    )
  )
  with check (
    exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and (u.raw_app_meta_data ->> 'is_admin')::boolean = true
    )
  );

-- Default feature flags
insert into admin_settings (key, value) values
  ('feature_flags', '{
    "public_signup": true,
    "custom_calendar": true,
    "api_v1_leads": true,
    "webhooks": true,
    "lead_capture": true,
    "ai_chat": true,
    "trial_popup": true
  }'::jsonb),
  ('kill_switches', '{
    "block_all_widgets": false,
    "force_mock_llm": false,
    "disable_email_notifications": false,
    "disable_sms_notifications": false,
    "disable_webhook_delivery": false
  }'::jsonb),
  ('llm_caps', '{
    "max_tokens_per_request": 1500,
    "max_requests_per_minute_per_spa": 60,
    "monthly_token_budget": 5000000
  }'::jsonb)
on conflict (key) do nothing;

-- Realtime: enable for the most-watched tables so the admin live feed works
do $$
begin
  begin alter publication supabase_realtime add table leads; exception when others then null; end;
  begin alter publication supabase_realtime add table chat_sessions; exception when others then null; end;
  begin alter publication supabase_realtime add table webhook_deliveries; exception when others then null; end;
  begin alter publication supabase_realtime add table notification_logs; exception when others then null; end;
  begin alter publication supabase_realtime add table api_keys; exception when others then null; end;
  begin alter publication supabase_realtime add table webhooks; exception when others then null; end;
  begin alter publication supabase_realtime add table subscriptions; exception when others then null; end;
end $$;
