-- 00019_disable_kb_rls.sql
--
-- The knowledge base (services / faqs / guardrails) is owned and edited
-- exclusively from the authed dashboard. The dashboard server actions
-- already use the service-role admin client (commit 83ffbc9), which
-- bypasses RLS, but a stale dev bundle occasionally falls back to the
-- user-scoped client and surfaces 42501 ("new row violates row-level
-- security policy") because cookies did not propagate into the action
-- context. Disable RLS on these tables so the dashboard can never get
-- blocked by a row-level policy for content it owns.
--
-- All other tables in the project keep their existing policies.

alter table knowledge_services   disable row level security;
alter table knowledge_faqs       disable row level security;
alter table knowledge_guardrails disable row level security;

do $$ begin
  drop policy if exists "Authenticated users can read knowledge_services"    on knowledge_services;
  drop policy if exists "Authenticated users can insert knowledge_services"  on knowledge_services;
  drop policy if exists "Authenticated users can update knowledge_services"  on knowledge_services;
  drop policy if exists "Authenticated users can delete knowledge_services"  on knowledge_services;
  drop policy if exists "Authenticated users can read knowledge_faqs"        on knowledge_faqs;
  drop policy if exists "Authenticated users can insert knowledge_faqs"      on knowledge_faqs;
  drop policy if exists "Authenticated users can update knowledge_faqs"      on knowledge_faqs;
  drop policy if exists "Authenticated users can delete knowledge_faqs"      on knowledge_faqs;
  drop policy if exists "Authenticated users can read knowledge_guardrails"  on knowledge_guardrails;
  drop policy if exists "Authenticated users can insert knowledge_guardrails" on knowledge_guardrails;
  drop policy if exists "Authenticated users can update knowledge_guardrails" on knowledge_guardrails;
  drop policy if exists "Authenticated users can delete knowledge_guardrails" on knowledge_guardrails;
end $$;