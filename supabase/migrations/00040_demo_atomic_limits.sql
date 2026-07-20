-- Atomic server-side reservation keeps concurrent anonymous requests from
-- bypassing per-session message and token caps.
create or replace function public.reserve_demo_message(
  p_session_id uuid,
  p_token_hash text,
  p_request_id text,
  p_message text,
  p_max_messages integer default 12,
  p_max_output_tokens integer default 2000,
  p_active_minutes integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.demo_sessions%rowtype;
  v_duplicate public.demo_messages%rowtype;
begin
  select * into v_session
  from public.demo_sessions
  where id = p_session_id and session_token_hash = p_token_hash
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_session');
  end if;

  select * into v_duplicate
  from public.demo_messages
  where demo_session_id = p_session_id and role = 'visitor' and client_request_id = p_request_id
  limit 1;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if v_session.status in ('expired', 'blocked')
     or v_session.expires_at <= now()
     or v_session.last_activity_at <= now() - interval '30 minutes' then
    update public.demo_sessions set status = 'expired', updated_at = now() where id = p_session_id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if v_session.status = 'completed'
     or v_session.message_count >= p_max_messages
     or v_session.generated_output_tokens >= p_max_output_tokens
     or v_session.started_at <= now() - make_interval(mins => p_active_minutes) then
    update public.demo_sessions
    set status = 'completed', current_step = 'complete',
        completion_percentage = greatest(completion_percentage, 75), updated_at = now()
    where id = p_session_id;
    return jsonb_build_object('ok', false, 'reason', 'limit_reached');
  end if;

  insert into public.demo_messages (demo_session_id, role, content, client_request_id)
  values (p_session_id, 'visitor', p_message, p_request_id);

  update public.demo_sessions
  set message_count = message_count + 1,
      last_activity_at = now(),
      current_step = case when current_step = 'scenario' then 'chat' else current_step end,
      completion_percentage = greatest(completion_percentage, 25),
      updated_at = now()
  where id = p_session_id;

  return jsonb_build_object('ok', true, 'duplicate', false, 'message_count', v_session.message_count + 1);
end;
$$;

revoke all on function public.reserve_demo_message(uuid, text, text, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_demo_message(uuid, text, text, text, integer, integer, integer) to service_role;

