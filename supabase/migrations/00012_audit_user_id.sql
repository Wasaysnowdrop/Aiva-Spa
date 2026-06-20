-- Add user_id to audit_logs for better forensics
alter table audit_logs add column if not exists user_id uuid null;
create index if not exists idx_audit_logs_user_id on audit_logs(user_id);
