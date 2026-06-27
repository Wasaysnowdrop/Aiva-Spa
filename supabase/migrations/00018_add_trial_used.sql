-- ============================================================
-- AivaSpa — Add trial_used column to subscriptions
-- ============================================================

-- 1. Add trial_used column
alter table subscriptions
  add column if not exists trial_used boolean default false;

-- 2. Backfill existing rows that have already used their trial
update subscriptions
set trial_used = true
where trial_ends_at is not null
  and (
    (status = 'expired'::subscription_status)
    or (status = 'canceled'::subscription_status)
    or (status = 'trialing'::subscription_status and trial_ends_at < now())
  );

update subscriptions
set trial_used = true
where trial_started_at is not null
  and trial_used = false;

-- 3. RLS: prevent users from modifying trial_used directly
do $$ begin
  drop policy if exists "Users can update own subscription" on subscriptions;

  create policy "Users can update own subscription"
    on subscriptions for update to authenticated
    using (auth.uid() = user_id)
    with check (
      auth.uid() = user_id
      and (
        trial_used is not distinct from (select trial_used from subscriptions where user_id = auth.uid())
      )
    );
end $$;
