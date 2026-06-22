-- Enable Supabase Realtime for knowledge base tables so the dashboard
-- knowledge-base editor receives live INSERT/UPDATE/DELETE events from
-- other browser sessions (and the same tab after a save, as a safety net).
--
-- The original schema (00001_initial_schema.sql) had these lines commented
-- out, which is why the dashboard's useRealtimeSubscription never received
-- changes for knowledge_services / knowledge_faqs / knowledge_guardrails.

do $$
begin
  begin alter publication supabase_realtime add table knowledge_services;
  exception when duplicate_object then null;
  end;

  begin alter publication supabase_realtime add table knowledge_faqs;
  exception when duplicate_object then null;
  end;

  begin alter publication supabase_realtime add table knowledge_guardrails;
  exception when duplicate_object then null;
  end;
end $$;

-- Set REPLICA IDENTITY FULL so UPDATE/DELETE payloads include the full row
-- (and the previous row values), matching what the client expects.
alter table knowledge_services   replica identity full;
alter table knowledge_faqs       replica identity full;
alter table knowledge_guardrails replica identity full;