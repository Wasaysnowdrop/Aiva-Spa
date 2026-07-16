-- Atomic, idempotent onboarding knowledge-base publishing.
-- The category CHECK constraint is intentionally left intact: its seven values
-- are the application contract and are validated again inside this function.

alter table public.knowledge_services
  alter column category set default 'Other';

alter table public.knowledge_services
  add column if not exists normalized_name text;

update public.knowledge_services
set normalized_name = lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
where normalized_name is null
   or normalized_name <> lower(regexp_replace(btrim(name), '\s+', ' ', 'g'));

-- Retain the newest owner-scoped row before enforcing retry-safe uniqueness.
with ranked as (
  select id,
         row_number() over (
           partition by user_id, normalized_name
           order by updated_at desc nulls last, created_at desc nulls last, id desc
         ) as row_number
  from public.knowledge_services
  where user_id is not null
)
delete from public.knowledge_services service
using ranked
where service.id = ranked.id
  and ranked.row_number > 1;

alter table public.knowledge_services
  alter column normalized_name set not null;

create or replace function public.set_knowledge_service_normalized_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.name := regexp_replace(btrim(new.name), '\s+', ' ', 'g');
  new.normalized_name := lower(new.name);
  return new;
end;
$$;

drop trigger if exists knowledge_services_normalized_name on public.knowledge_services;
create trigger knowledge_services_normalized_name
before insert or update of name on public.knowledge_services
for each row execute function public.set_knowledge_service_normalized_name();

create unique index if not exists knowledge_services_owner_normalized_name_key
  on public.knowledge_services (user_id, normalized_name)
  where user_id is not null;

create or replace function public.publish_onboarding_knowledge_base(
  p_user_id uuid,
  p_services jsonb,
  p_faqs jsonb,
  p_guardrails jsonb,
  p_widget jsonb,
  p_settings jsonb,
  p_user_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_services integer := 0;
  v_faqs integer := 0;
  v_guardrails integer := 0;
  v_widget_updated boolean := false;
  v_settings_updated boolean := false;
  v_widget_id uuid;
  v_settings_id uuid;
  v_affected integer := 0;
  v_stage text := 'authentication';
  v_error_detail text;
  v_error_hint text;
begin
  raise log 'PUBLISH_STARTED user_id=% operation=publish_onboarding_knowledge_base', p_user_id;

  if p_user_id is null then
    raise exception using errcode = '22023', message = 'PUBLISH_USER_REQUIRED';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception using errcode = '22023', message = 'PUBLISH_USER_NOT_FOUND';
  end if;
  raise log 'PUBLISH_AUTH_VALIDATED user_id=%', p_user_id;

  v_stage := 'services_validation';
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_services, '[]'::jsonb))
      as service(name text, category text)
    where nullif(btrim(service.name), '') is null
       or service.category is null
       or service.category not in (
         'Injectables',
         'Laser Treatments',
         'Facials',
         'Skin Rejuvenation',
         'Body Treatments',
         'Wellness',
         'Other'
       )
  ) then
    raise exception using errcode = '22023', message = 'INVALID_SERVICE_CATEGORY';
  end if;
  raise log 'PUBLISH_SERVICES_VALIDATED user_id=%', p_user_id;

  v_stage := 'services_upsert';
  with source_services as (
    select distinct on (lower(regexp_replace(btrim(service.name), '\s+', ' ', 'g')))
      regexp_replace(btrim(service.name), '\s+', ' ', 'g') as name,
      lower(regexp_replace(btrim(service.name), '\s+', ' ', 'g')) as normalized_name,
      service.category,
      coalesce(service.description, '') as description,
      coalesce(service.pricing_rule, '') as pricing_rule,
      coalesce(service.duration, '') as duration,
      coalesce(service.active, true) as active
    from jsonb_to_recordset(coalesce(p_services, '[]'::jsonb))
      as service(
        name text,
        category text,
        description text,
        pricing_rule text,
        duration text,
        active boolean
      )
    where nullif(btrim(service.name), '') is not null
    order by lower(regexp_replace(btrim(service.name), '\s+', ' ', 'g')), service.name
  ), upserted as (
    insert into public.knowledge_services (
      user_id, name, normalized_name, category, description,
      pricing_rule, duration, active, updated_at
    )
    select
      p_user_id, name, normalized_name, category, description,
      pricing_rule, duration, active, now()
    from source_services
    on conflict (user_id, normalized_name) where user_id is not null
    do update set
      name = excluded.name,
      category = excluded.category,
      description = excluded.description,
      pricing_rule = excluded.pricing_rule,
      duration = excluded.duration,
      active = excluded.active,
      updated_at = now()
    returning id
  )
  select count(*)::integer into v_services from upserted;

  delete from public.knowledge_services existing
  where existing.user_id = p_user_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_services, '[]'::jsonb)) as service(name text)
      where lower(regexp_replace(btrim(service.name), '\s+', ' ', 'g')) = existing.normalized_name
    );
  raise log 'PUBLISH_SERVICES_SAVED user_id=% rows=%', p_user_id, v_services;

  v_stage := 'faqs';
  delete from public.knowledge_faqs where user_id = p_user_id;
  insert into public.knowledge_faqs (user_id, question, answer, category, updated_at)
  select
    p_user_id,
    faq.question,
    coalesce(faq.answer, ''),
    coalesce(faq.category, 'General')::public.faq_category,
    now()
  from jsonb_to_recordset(coalesce(p_faqs, '[]'::jsonb))
    as faq(question text, answer text, category text)
  where nullif(btrim(faq.question), '') is not null;
  get diagnostics v_faqs = row_count;
  raise log 'PUBLISH_FAQS_SAVED user_id=% rows=%', p_user_id, v_faqs;

  v_stage := 'policies';
  delete from public.knowledge_guardrails where user_id = p_user_id;
  insert into public.knowledge_guardrails (
    user_id, title, body, description, rule_type, enabled, is_active, updated_at
  )
  select
    p_user_id,
    guardrail.title,
    coalesce(guardrail.body, guardrail.description, ''),
    coalesce(guardrail.description, guardrail.body, ''),
    coalesce(guardrail.rule_type, 'general'),
    coalesce(guardrail.enabled, true),
    coalesce(guardrail.is_active, guardrail.enabled, true),
    now()
  from jsonb_to_recordset(coalesce(p_guardrails, '[]'::jsonb))
    as guardrail(
      title text,
      body text,
      description text,
      rule_type text,
      enabled boolean,
      is_active boolean
    )
  where nullif(btrim(guardrail.title), '') is not null;
  get diagnostics v_guardrails = row_count;
  raise log 'PUBLISH_POLICIES_SAVED user_id=% rows=%', p_user_id, v_guardrails;

  v_stage := 'brand_voice';
  select id into v_widget_id
  from public.widget_config
  order by created_at asc
  limit 1
  for update;

  if v_widget_id is null then
    insert into public.widget_config (
      brand_name, logo_initial, primary_color, position, welcome_message,
      proactive_enabled, proactive_delay_seconds, proactive_message,
      show_branding, collect_email, collect_phone, consent_text,
      working_hours, extended_kb, updated_at
    ) values (
      coalesce(p_widget->>'brand_name', 'Your Med Spa'),
      coalesce(p_widget->>'logo_initial', 'M'),
      coalesce(p_widget->>'primary_color', '#E2E54B'),
      coalesce(p_widget->>'position', 'bottom-right')::public.widget_position,
      coalesce(p_widget->>'welcome_message', 'Hi! How can I help?'),
      coalesce((p_widget->>'proactive_enabled')::boolean, true),
      coalesce((p_widget->>'proactive_delay_seconds')::integer, 8),
      coalesce(p_widget->>'proactive_message', 'Still browsing? I can help.'),
      coalesce((p_widget->>'show_branding')::boolean, true),
      coalesce((p_widget->>'collect_email')::boolean, true),
      coalesce((p_widget->>'collect_phone')::boolean, true),
      coalesce(p_widget->>'consent_text', ''),
      coalesce(p_widget->'working_hours', '{}'::jsonb),
      p_widget->'extended_kb',
      now()
    );
  else
    update public.widget_config
    set brand_name = coalesce(p_widget->>'brand_name', brand_name),
        logo_initial = coalesce(p_widget->>'logo_initial', logo_initial),
        welcome_message = coalesce(p_widget->>'welcome_message', welcome_message),
        consent_text = coalesce(p_widget->>'consent_text', consent_text),
        working_hours = coalesce(p_widget->'working_hours', working_hours),
        extended_kb = coalesce(p_widget->'extended_kb', extended_kb),
        updated_at = now()
    where id = v_widget_id;
  end if;
  v_widget_updated := true;
  raise log 'PUBLISH_BRAND_VOICE_SAVED user_id=%', p_user_id;

  v_stage := 'business_settings';
  select id into v_settings_id
  from public.spa_settings
  order by created_at asc
  limit 1
  for update;

  if v_settings_id is not null then
    update public.spa_settings
    set spa_name = coalesce(nullif(p_settings->>'spa_name', ''), spa_name),
        website = coalesce(nullif(p_settings->>'website', ''), website),
        address = coalesce(nullif(p_settings->>'address', ''), address),
        updated_at = now()
    where id = v_settings_id;
    v_settings_updated := true;
  end if;

  v_stage := 'publish_status';
  update auth.users
  set raw_user_meta_data = coalesce(p_user_metadata, '{}'::jsonb),
      updated_at = now()
  where id = p_user_id;
  get diagnostics v_affected = row_count;
  if v_affected <> 1 then
    raise exception using errcode = 'P0001', message = 'PUBLISH_METADATA_FAILED';
  end if;
  raise log 'PUBLISH_NOTIFICATIONS_SAVED user_id=%', p_user_id;
  raise log 'PUBLISH_STATUS_UPDATED user_id=%', p_user_id;

  return jsonb_build_object(
    'services', v_services,
    'faqs', v_faqs,
    'guardrails', v_guardrails,
    'widgetUpdated', v_widget_updated,
    'settingsUpdated', v_settings_updated
  );
exception when others then
  get stacked diagnostics
    v_error_detail = pg_exception_detail,
    v_error_hint = pg_exception_hint;
  raise log 'PUBLISH_FAILED user_id=% stage=% code=% message=% detail=% hint=%',
    p_user_id, v_stage, sqlstate, sqlerrm, v_error_detail, v_error_hint;
  raise log 'PUBLISH_ROLLED_BACK user_id=% stage=%', p_user_id, v_stage;
  raise exception using
    errcode = sqlstate,
    message = format('PUBLISH_STAGE=%s; %s', v_stage, sqlerrm),
    detail = v_error_detail,
    hint = v_error_hint;
end;
$$;

revoke all on function public.publish_onboarding_knowledge_base(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.publish_onboarding_knowledge_base(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;

comment on function public.publish_onboarding_knowledge_base(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) is 'Atomically publishes an owner KB, widget/settings values, and onboarding metadata.';
