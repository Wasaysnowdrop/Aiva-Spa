-- ============================================================
-- AivaSpa — Subscriptions, Trials, and Usage Quotas
-- ============================================================

-- 1. Enums
do $$ begin
  create type subscription_plan as enum ('starter', 'growth', 'pro', 'scale');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type subscription_status as enum ('trialing', 'active', 'canceled', 'expired');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type subscription_interval as enum ('monthly', 'yearly');
exception when duplicate_object then null;
end $$;

-- 2. subscriptions table — one row per user (auth.users)
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  plan subscription_plan not null default 'starter',
  status subscription_status not null default 'trialing',
  billing_interval subscription_interval not null default 'monthly',
  monthly_quota integer not null default 300,
  conversations_used integer not null default 0,
  period_start timestamptz not null default now(),
  period_end timestamptz not null default now() + interval '14 days',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  trial_popup_dismissed_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_id on subscriptions(user_id);
create index if not exists idx_subscriptions_status on subscriptions(status);
create index if not exists idx_subscriptions_period_end on subscriptions(period_end);

-- 3. RLS
alter table subscriptions enable row level security;

do $$ begin
  drop policy if exists "Users can read own subscription" on subscriptions;
  drop policy if exists "Users can insert own subscription" on subscriptions;
  drop policy if exists "Users can update own subscription" on subscriptions;

  create policy "Users can read own subscription"
    on subscriptions for select to authenticated
    using (auth.uid() = user_id);
  create policy "Users can insert own subscription"
    on subscriptions for insert to authenticated
    with check (auth.uid() = user_id);
  create policy "Users can update own subscription"
    on subscriptions for update to authenticated
    using (auth.uid() = user_id);
end $$;
