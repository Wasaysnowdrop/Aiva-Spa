-- 00002 was applied to the remote database before the local repo was
-- pruned of older migrations. Schema is already in production; this is
-- a no-op placeholder so the Supabase migration history stays in sync.
select 1;
