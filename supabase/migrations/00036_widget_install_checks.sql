-- Persist safe widget installation checks and align lead RLS with canonical team permissions.

create table if not exists public.widget_install_checks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references auth.users(id) on delete cascade,
  widget_id text not null,
  checked_url text not null,
  status text not null check (status in ('installed','not_found','unreachable','blocked','invalid','timeout','unsupported_redirect','mismatch','incomplete')),
  script_found boolean not null default false,
  widget_id_matched boolean not null default false,
  failure_reason text,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists widget_install_checks_business_widget_idx
  on public.widget_install_checks(business_id, widget_id, checked_at desc);
create index if not exists team_members_business_user_active_idx
  on public.team_members(business_id, member_user_id)
  where status = 'active';

alter table public.widget_install_checks enable row level security;
drop policy if exists "Team managers can read widget checks" on public.widget_install_checks;
create policy "Team managers can read widget checks"
  on public.widget_install_checks for select to authenticated
  using (public.is_team_manager(business_id, auth.uid()));

create or replace function public.prune_widget_install_checks(
  p_business_id uuid,
  p_widget_id text,
  p_keep integer default 5
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_keep < 1 or p_keep > 25 then raise exception 'INVALID_KEEP_COUNT'; end if;
  delete from public.widget_install_checks check_row
  where check_row.id in (
    select ranked.id from (
      select id, row_number() over (order by checked_at desc, created_at desc) as row_number
      from public.widget_install_checks
      where business_id = p_business_id and widget_id = p_widget_id
    ) ranked
    where ranked.row_number > p_keep
  );
end;
$$;
revoke all on function public.prune_widget_install_checks(uuid, text, integer) from public;
grant execute on function public.prune_widget_install_checks(uuid, text, integer) to service_role;

create or replace function public.can_read_workspace_lead(
  p_business_id uuid,
  p_assigned_member_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and (
    p_business_id = p_user_id
    or exists (
      select 1 from public.team_members member
      where member.business_id = p_business_id
        and member.member_user_id = p_user_id
        and member.status = 'active'
        and (
          member.role in ('Owner', 'Manager', 'Receptionist')
          or (member.role = 'Staff' and member.id = p_assigned_member_id)
        )
    )
  );
$$;

create or replace function public.can_update_workspace_lead(
  p_business_id uuid,
  p_assigned_member_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and (
    p_business_id = p_user_id
    or exists (
      select 1 from public.team_members member
      where member.business_id = p_business_id
        and member.member_user_id = p_user_id
        and member.status = 'active'
        and (
          member.role in ('Owner', 'Manager')
          or (member.role = 'Staff' and member.id = p_assigned_member_id)
        )
    )
  );
$$;

revoke all on function public.can_read_workspace_lead(uuid, uuid, uuid) from public;
revoke all on function public.can_update_workspace_lead(uuid, uuid, uuid) from public;
grant execute on function public.can_read_workspace_lead(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.can_update_workspace_lead(uuid, uuid, uuid) to authenticated, service_role;

drop policy if exists "Users can read own active leads" on public.leads;
drop policy if exists "Users can insert own leads" on public.leads;
drop policy if exists "Users can update own leads" on public.leads;
drop policy if exists "Workspace members can read active leads" on public.leads;
drop policy if exists "Workspace managers can insert leads" on public.leads;
drop policy if exists "Workspace members can update permitted leads" on public.leads;

create policy "Workspace members can read active leads"
  on public.leads for select to authenticated
  using (deleted_at is null and public.can_read_workspace_lead(user_id, assigned_to, auth.uid()));
create policy "Workspace managers can insert leads"
  on public.leads for insert to authenticated
  with check (public.is_team_manager(user_id, auth.uid()));
create policy "Workspace members can update permitted leads"
  on public.leads for update to authenticated
  using (deleted_at is null and public.can_update_workspace_lead(user_id, assigned_to, auth.uid()))
  with check (public.can_update_workspace_lead(user_id, assigned_to, auth.uid()));