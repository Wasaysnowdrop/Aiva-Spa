-- 00011_bubble_logo.sql
-- Add an optional image URL for the launcher bubble. When set, the loader
-- renders the image inside the round bubble instead of the logoInitial
-- letter or the default chat icon. Falls back gracefully to the letter
-- or icon if the image fails to load.

alter table widget_config
  add column if not exists bubble_logo_url text;

-- Safe default: treat NULL as "no image, use logoInitial / icon".
comment on column widget_config.bubble_logo_url is
  'Optional image URL rendered inside the launcher bubble. Falls back to logo_initial or the default chat icon when empty.';
