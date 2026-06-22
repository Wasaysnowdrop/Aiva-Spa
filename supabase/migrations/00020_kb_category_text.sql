-- 00020_kb_category_text.sql
-- Allow custom service categories (e.g. "Facials", "Wellness", "Hair Removal")
-- by converting the fixed enum to free-form text, while keeping the existing
-- 4 suggested defaults as plain strings.

do $$
begin
  if exists (
    select 1
    from pg_type
    where typname = 'knowledge_category'
      and pg_type_is_visible(oid)
  ) then
    alter table knowledge_services
      alter column category drop default;

    alter table knowledge_services
      alter column category type text using category::text;

    alter table knowledge_services
      alter column category set default 'Skin';

    alter table knowledge_services
      alter column category set not null;

    drop type knowledge_category;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'knowledge_services_category_length_chk'
  ) then
    alter table knowledge_services
      add constraint knowledge_services_category_length_chk
      check (char_length(btrim(category)) between 1 and 80);
  end if;
end $$;

-- Backfill any blank categories that may have existed before the NOT NULL was enforced.
update knowledge_services
set category = 'Skin'
where category is null or btrim(category) = '';