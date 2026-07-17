-- Secure team invitations, accepted memberships, and tenant-scoped audit history.

alter table public.team_members
  add column if not exists business_id uuid references auth.users(id) on delete cascade,
  add column if not exists member_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists joined_at timestamptz;

update public.team_members
set business_id = user_id
where business_id is null and user_id is not null;

create index if not exists team_members_business_idx
  on public.team_members(business_id, status, created_at desc);
create unique index if not exists team_members_business_user_key
  on public.team_members(business_id, member_user_id)
  where member_user_id is not null;

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null default 'Your workspace',
  email text not null,
  normalized_email text generated always as (lower(btrim(email))) stored,
  name text,
  role public.team_role not null,
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  delivery_error text,
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  sent_at timestamptz,
  last_sent_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists team_invitations_pending_unique
  on public.team_invitations(business_id, normalized_email)
  where status = 'pending';
create index if not exists team_invitations_business_idx
  on public.team_invitations(business_id, status, created_at desc);
create index if not exists team_invitations_token_idx
  on public.team_invitations(token_hash) where status = 'pending';

alter table public.audit_logs
  add column if not exists business_id uuid references auth.users(id) on delete cascade,
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists category text,
  add column if not exists target_type text,
  add column if not exists target_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'success';

update public.audit_logs
set business_id = user_id,
    actor_user_id = user_id
where business_id is null
  and user_id is not null
  and exists (
    select 1 from auth.users where auth.users.id = public.audit_logs.user_id
  );

-- Preserve readable history in the existing single-owner installation.
with sole_owner as (
  select (array_agg(id))[1] as user_id from auth.users having count(*) = 1
)
update public.audit_logs log
set business_id = sole_owner.user_id
from sole_owner
where log.business_id is null;

create index if not exists audit_logs_business_created_idx
  on public.audit_logs(business_id, created_at desc);
create index if not exists audit_logs_business_category_idx
  on public.audit_logs(business_id, category, created_at desc);

create or replace function public.is_team_manager(
  p_business_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and (
    p_user_id = p_business_id
    or exists (
      select 1 from public.team_members member
      where member.business_id = p_business_id
        and member.member_user_id = p_user_id
        and member.status = 'active'
        and member.role in ('Owner', 'Manager')
    )
  );
$$;

revoke all on function public.is_team_manager(uuid, uuid) from public;
grant execute on function public.is_team_manager(uuid, uuid) to authenticated, service_role;

alter table public.team_invitations enable row level security;
alter table public.team_members enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Owners can read own team members" on public.team_members;
drop policy if exists "Owners can insert own team members" on public.team_members;
drop policy if exists "Owners can update own team members" on public.team_members;
drop policy if exists "Owners can delete own team members" on public.team_members;
drop policy if exists "Team members can read workspace members" on public.team_members;
drop policy if exists "Team managers can insert members" on public.team_members;
drop policy if exists "Team managers can update members" on public.team_members;
drop policy if exists "Team managers can delete members" on public.team_members;

create policy "Team members can read workspace members"
  on public.team_members for select to authenticated
  using (
    public.is_team_manager(business_id, auth.uid())
    or member_user_id = auth.uid()
  );
create policy "Team managers can insert members"
  on public.team_members for insert to authenticated
  with check (public.is_team_manager(business_id, auth.uid()));
create policy "Team managers can update members"
  on public.team_members for update to authenticated
  using (public.is_team_manager(business_id, auth.uid()))
  with check (public.is_team_manager(business_id, auth.uid()));
create policy "Team managers can delete members"
  on public.team_members for delete to authenticated
  using (public.is_team_manager(business_id, auth.uid()));

drop policy if exists "Team managers can read invitations" on public.team_invitations;
drop policy if exists "Team managers can create invitations" on public.team_invitations;
drop policy if exists "Team managers can update invitations" on public.team_invitations;
drop policy if exists "Team managers can delete invitations" on public.team_invitations;
create policy "Team managers can read invitations"
  on public.team_invitations for select to authenticated
  using (public.is_team_manager(business_id, auth.uid()));
create policy "Team managers can create invitations"
  on public.team_invitations for insert to authenticated
  with check (public.is_team_manager(business_id, auth.uid()));
create policy "Team managers can update invitations"
  on public.team_invitations for update to authenticated
  using (public.is_team_manager(business_id, auth.uid()))
  with check (public.is_team_manager(business_id, auth.uid()));
create policy "Team managers can delete invitations"
  on public.team_invitations for delete to authenticated
  using (public.is_team_manager(business_id, auth.uid()));

drop policy if exists "Authenticated users can read audit_logs" on public.audit_logs;
drop policy if exists "Authenticated users can insert audit_logs" on public.audit_logs;
drop policy if exists "Team managers can read audit logs" on public.audit_logs;
create policy "Team managers can read audit logs"
  on public.audit_logs for select to authenticated
  using (public.is_team_manager(business_id, auth.uid()));

create or replace function public.accept_team_invitation(
  p_token_hash text,
  p_accepting_user_id uuid,
  p_accepting_email text,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.team_invitations%rowtype;
  v_member_id uuid;
begin
  if p_accepting_user_id is null or nullif(btrim(p_accepting_email), '') is null then
    raise exception 'INVITE_AUTH_REQUIRED';
  end if;

  select * into v_invite
  from public.team_invitations
  where token_hash = p_token_hash
  for update;

  if v_invite.id is null then raise exception 'INVITE_INVALID'; end if;
  if v_invite.status = 'accepted' then raise exception 'INVITE_ACCEPTED'; end if;
  if v_invite.status = 'revoked' then raise exception 'INVITE_REVOKED'; end if;
  if v_invite.status <> 'pending' then raise exception 'INVITE_INVALID'; end if;
  if v_invite.expires_at <= now() then
    update public.team_invitations
    set status = 'expired', updated_at = now()
    where id = v_invite.id;
    raise exception 'INVITE_EXPIRED';
  end if;
  if lower(btrim(p_accepting_email)) <> v_invite.normalized_email then
    raise exception 'INVITE_EMAIL_MISMATCH';
  end if;
  if exists (
    select 1 from public.team_members
    where business_id = v_invite.business_id
      and member_user_id = p_accepting_user_id
  ) then
    raise exception 'MEMBER_EXISTS';
  end if;

  insert into public.team_members (
    business_id, user_id, member_user_id, name, email, role, status,
    invited_by, joined_at, last_active_at
  ) values (
    v_invite.business_id, v_invite.business_id, p_accepting_user_id,
    coalesce(nullif(btrim(v_invite.name), ''), split_part(v_invite.email, '@', 1)),
    v_invite.normalized_email, v_invite.role, 'active', v_invite.invited_by,
    now(), now()
  ) returning id into v_member_id;

  update public.team_invitations
  set status = 'accepted', accepted_at = now(), accepted_by = p_accepting_user_id,
      updated_at = now()
  where id = v_invite.id;

  insert into public.audit_logs (
    business_id, actor_user_id, user_id, user_name, action, category,
    target_type, target_id, metadata, status
  ) values (
    v_invite.business_id, p_accepting_user_id, p_accepting_user_id,
    coalesce(nullif(btrim(p_actor_name), ''), split_part(p_accepting_email, '@', 1)),
    'TEAM_INVITE_ACCEPTED', 'team', 'team_member', v_member_id::text,
    jsonb_build_object('email', v_invite.normalized_email, 'role', v_invite.role::text),
    'success'
  );

  return jsonb_build_object(
    'businessId', v_invite.business_id,
    'memberId', v_member_id,
    'role', v_invite.role::text
  );
end;
$$;

revoke all on function public.accept_team_invitation(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.accept_team_invitation(text, uuid, text, text) to service_role;

