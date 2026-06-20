-- 00009_extended_kb.sql
-- Add extended_kb JSONB column to widget_config so the visitor-facing AI
-- has access to the full Setup Assistant knowledge base (brand voice,
-- disclaimers, booking policy, business context). The Setup Assistant writes
-- this column on finalize; the chat engine reads it on every prompt build.
-- The legacy columns (welcome_message, consent_text, working_hours) remain
-- the source of truth for those three fields at runtime — extended_kb is
-- authoritative for the rest.

alter table widget_config
  add column if not exists extended_kb jsonb;

-- Optional: a sane default so existing rows don't break SELECTs that touch it.
alter table widget_config
  alter column extended_kb set default '{}'::jsonb;

-- Make sure realtime / read paths keep working.
-- (The widget_config table is already in the publication per migration 00001
--  comments; if yours isn't, uncomment the next line.)
-- alter publication supabase_realtime add table widget_config;
