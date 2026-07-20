-- Seed the live activity stream with recent persisted history. Idempotent via
-- target/type existence checks so repair pushes cannot duplicate events.

insert into public.admin_events(event_type, category, business_id, user_id, target_type, target_id, status, metadata, occurred_at)
select 'lead.created', 'leads', l.user_id, l.user_id, 'leads', l.id::text, 'success', jsonb_build_object('name', l.name, 'service', l.service, 'lead_status', l.status), l.created_at
from public.leads l
where l.created_at >= now() - interval '30 days' and l.deleted_at is null
  and not exists (select 1 from public.admin_events e where e.event_type = 'lead.created' and e.target_type = 'leads' and e.target_id = l.id::text);

insert into public.admin_events(event_type, category, business_id, user_id, target_type, target_id, status, metadata, occurred_at)
select 'conversation.started', 'conversations', c.user_id, c.user_id, 'chat_sessions', c.id::text, 'info', jsonb_build_object('session_id', c.session_id, 'conversation_status', c.status, 'lead_captured', c.lead_captured), c.created_at
from public.chat_sessions c
where c.created_at >= now() - interval '30 days' and c.conversation_type = 'visitor' and c.environment = 'production' and c.deleted_at is null
  and not exists (select 1 from public.admin_events e where e.event_type = 'conversation.started' and e.target_type = 'chat_sessions' and e.target_id = c.id::text);

insert into public.admin_events(event_type, category, business_id, user_id, target_type, target_id, status, metadata, occurred_at)
select 'booking.created', 'bookings', b.user_id, b.user_id, 'calendar_bookings', b.id::text, case when b.status in ('cancelled','no_show') then 'warning' else 'success' end, jsonb_build_object('service', b.service, 'booking_status', b.status, 'start_at', b.start_at), b.created_at
from public.calendar_bookings b
where b.created_at >= now() - interval '30 days'
  and not exists (select 1 from public.admin_events e where e.event_type = 'booking.created' and e.target_type = 'calendar_bookings' and e.target_id = b.id::text);

insert into public.admin_events(event_type, category, business_id, user_id, target_type, target_id, status, metadata, occurred_at)
select 'email.delivery', 'email', n.user_id, n.user_id, 'notification_logs', n.id::text, case when n.status::text = 'failed' then 'error' else 'success' end, jsonb_build_object('email_type', n.email_type, 'delivery_status', n.status, 'recipient_hint', regexp_replace(n.recipient, '(^.).*(@.*$)', '\1***\2')), n.sent_at
from public.notification_logs n
where n.sent_at >= now() - interval '30 days' and lower(n.channel::text) = 'email'
  and not exists (select 1 from public.admin_events e where e.event_type = 'email.delivery' and e.target_type = 'notification_logs' and e.target_id = n.id::text);

insert into public.admin_events(event_type, category, business_id, user_id, target_type, target_id, status, metadata, occurred_at)
select 'subscription.changed', 'subscriptions', s.user_id, s.user_id, 'subscriptions', s.id::text, 'info', jsonb_build_object('plan', s.plan, 'subscription_status', s.status), s.updated_at
from public.subscriptions s
where not exists (select 1 from public.admin_events e where e.event_type = 'subscription.changed' and e.target_type = 'subscriptions' and e.target_id = s.id::text);

insert into public.admin_events(event_type, category, user_id, target_type, target_id, status, metadata, occurred_at)
select 'admin.action', 'admin', a.admin_user_id, 'admin_audit_log', a.id::text, 'info', jsonb_build_object('actor_email', a.admin_email, 'action', a.action, 'details', a.metadata), a.created_at
from public.admin_audit_log a
where a.created_at >= now() - interval '90 days'
  and not exists (select 1 from public.admin_events e where e.event_type = 'admin.action' and e.target_type = 'admin_audit_log' and e.target_id = a.id::text);
