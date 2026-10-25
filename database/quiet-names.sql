-- v91 — quiet names (Jack, 25 Oct 2026)
--
-- Adds one hidden flag, `players.muted`, and exposes it on the roster view so
-- the client can leave a member out of the "Still to pick" chase lists without
-- printing any label next to their name. Nothing else changes: no row is
-- touched by this file, no token, pick, role, link or RPC. Standings, history
-- and Stats still include a muted member exactly as before.
--
-- Deploy THIS file before the v91 client (the client selects `muted`).
-- Safe to re-run: `if not exists` and `create or replace` only. `create or
-- replace view` may only APPEND a column, which is what this does, and it
-- keeps the view's existing grants (SELECT-only for anon/authenticated).
--
-- Setting the flag is a commissioner job in the SQL editor for now:
--   update public.players set muted = true  where display_name = '<name>';
--   update public.players set muted = false where display_name = '<name>';
--
-- Rollback: revert the client first, then
--   create or replace view ... (without muted) is NOT allowed (it would drop a
--   column) — use `drop view` + the schema.sql definition + its grants instead,
--   or simply leave the harmless column in place.

alter table public.players add column if not exists muted boolean not null default false;

create or replace view public.players_public as
  select id, display_name, is_admin, (claimed_at is not null) as claimed, muted
  from public.players;
