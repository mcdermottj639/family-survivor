-- database/shelf.sql — take a member out of the league without losing them.
-- ---------------------------------------------------------------------------
-- v93 (10 Nov 2026). The commissioner asked for a member who had left to be
-- gone from the app entirely, but kept in case they come back. Archive and the
-- quiet list both leave the person in the roster the app downloads, so neither
-- is "gone". A shelved member is MOVED out of public.players / public.picks
-- into this private schema: the app never receives the row, so no screen,
-- count, recap, grid or Stats line can show it, and no client change is
-- needed. Their personal link stops resolving while they are shelved and works
-- again, unchanged, the moment they are restored (same id, same token).
--
-- The schema is not exposed by the API and no client role can read it.
-- Run in the Supabase SQL editor only. Never from the app.

create schema if not exists survivor_shelf;
revoke all on schema survivor_shelf from public, anon, authenticated;

create table if not exists survivor_shelf.players (
  id bigint primary key,
  display_name text not null,
  token text not null,
  is_admin boolean not null,
  claimed_at timestamptz,
  created_at timestamptz not null,
  shelved_at timestamptz not null default now()
);
create table if not exists survivor_shelf.picks (
  id bigint primary key,
  player_id bigint not null references survivor_shelf.players(id) on delete cascade,
  season int not null,
  week int not null,
  team text not null,
  kickoff timestamptz,
  entered_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
alter table survivor_shelf.players enable row level security;
alter table survivor_shelf.picks enable row level security;
revoke all on all tables in schema survivor_shelf from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- TO SHELVE member N (never the commissioner). Copy first, check, then remove.
--
--   insert into survivor_shelf.players (id, display_name, token, is_admin, claimed_at, created_at)
--     select id, display_name, token, is_admin, claimed_at, created_at from public.players where id = N;
--   insert into survivor_shelf.picks (id, player_id, season, week, team, kickoff, entered_by, created_at, updated_at)
--     select id, player_id, season, week, team, kickoff, entered_by, created_at, updated_at from public.picks where player_id = N;
--   -- confirm the shelf holds 1 player and every one of their picks, THEN:
--   delete from public.picks where player_id = N;
--   delete from public.players where id = N;
--
-- TO RESTORE member N. Same id and token, so their old link works again.
-- First check nobody has since joined under the same name.
--
--   begin;
--   insert into public.players (id, display_name, token, is_admin, claimed_at, created_at)
--     overriding system value
--     select id, display_name, token, is_admin, claimed_at, created_at from survivor_shelf.players where id = N;
--   insert into public.picks (id, player_id, season, week, team, kickoff, entered_by, created_at, updated_at)
--     overriding system value
--     select id, player_id, season, week, team, kickoff, entered_by, created_at, updated_at from survivor_shelf.picks where player_id = N;
--   delete from survivor_shelf.players where id = N;   -- cascades to the shelved picks
--   commit;
