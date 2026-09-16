-- STAGED ONLY: requires explicit approval before applying to the live league.
-- Apply only after explicit live-database approval and isolated testing.
-- Privacy cutover is intentionally excluded: legacy clients must keep reading
-- their own upcoming picks using the unchanged existing endpoint. Never run against Sports-Hub's database.
-- Existing personal tokens are preserved. No results table is introduced.
begin;
create schema if not exists survivor_private;
revoke all on schema survivor_private from public, anon, authenticated;
create extension if not exists http with schema extensions;
create extension if not exists pg_cron;

create table if not exists survivor_private.recovery_snapshots (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(), reason text not null, payload jsonb not null
);
create table if not exists survivor_private.schedule (
  season int not null, week int not null check(week between 1 and 18),
  team text not null, event_id text not null, kickoff timestamptz not null,
  fetched_at timestamptz not null default now(), primary key(season,week,team)
);
create table if not exists survivor_private.pick_audit (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default clock_timestamp(), player_id bigint not null,
  season int not null, week int not null, operation text not null,
  actor text not null, actor_id bigint, old_row jsonb, new_row jsonb
);
alter table survivor_private.recovery_snapshots enable row level security;
alter table survivor_private.schedule enable row level security;
alter table survivor_private.pick_audit enable row level security;
revoke all on all tables in schema survivor_private from public, anon, authenticated;

create or replace function survivor_private.snapshot(p_reason text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  insert into survivor_private.recovery_snapshots(reason,payload)
  select p_reason, jsonb_build_object(
    'players',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.players p),
    'picks',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.picks p),
    'functions',(select jsonb_object_agg(proname,pg_get_functiondef(oid)) from pg_proc where pronamespace='public'::regnamespace),
    'policies',(select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname='public'))
  returning id into v_id;
  return v_id;
end $$;
select survivor_private.snapshot('before-season-protection');

alter table public.players add column if not exists archived boolean not null default false;
create or replace view public.players_public as
select id,display_name,is_admin,(claimed_at is not null) as claimed,archived from public.players;

-- This is a private, fixed-host fetch. A browser cannot supply the schedule,
-- destination URL, or authoritative kickoff. Keep old rows on feed failure.
create or replace function survivor_private.refresh_schedule(p_season int,p_week int) returns int
language plpgsql security definer set search_path = '' as $$
declare response extensions.http_response; payload jsonb; ev jsonb; competitor jsonb;
  abbr text; n int; expected int; incoming jsonb := '[]';
begin
  if p_season not between 2026 and 2100 or p_week not between 1 and 18 then raise exception 'Invalid season/week'; end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','8000');
  select * into response from extensions.http_get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates='||p_season||'&seasontype=2&week='||p_week);
  if response.status <> 200 then raise exception 'Schedule feed unavailable'; end if;
  payload := response.content::jsonb;
  for ev in select value from jsonb_array_elements(payload->'events') loop
    for competitor in select value from jsonb_array_elements(ev#>'{competitions,0,competitors}') loop
      abbr := competitor#>>'{team,abbreviation}';
      abbr := case abbr when 'WAS' then 'WSH' when 'JAC' then 'JAX' when 'LA' then 'LAR' when 'SD' then 'LAC' when 'OAK' then 'LV' when 'STL' then 'LAR' else abbr end;
      if abbr is null or ev->>'date' is null then raise exception 'Incomplete schedule'; end if;
      incoming := incoming || jsonb_build_array(jsonb_build_object('team',abbr,'event_id',ev->>'id','kickoff',ev->>'date'));
    end loop;
  end loop;
  n := jsonb_array_length(incoming);
  select count(*) into expected from survivor_private.schedule where season=p_season and week=p_week;
  if n < 24 or n > 32 or n % 2 <> 0 or (p_week<=2 and n<>32) or n<expected
     or n<>(select count(distinct value->>'team') from jsonb_array_elements(incoming)) then
    raise exception 'Incomplete or duplicate schedule; keeping prior schedule';
  end if;
  insert into survivor_private.schedule(season,week,team,event_id,kickoff,fetched_at)
  select p_season,p_week,value->>'team',value->>'event_id',(value->>'kickoff')::timestamptz,now() from jsonb_array_elements(incoming)
  on conflict(season,week,team) do update set event_id=excluded.event_id,kickoff=excluded.kickoff,fetched_at=excluded.fetched_at;
  return n;
end $$;

-- Seed and validate the entire season BEFORE replacing any live write path.
-- Any unavailable week aborts the transaction and leaves the old API intact.
select survivor_private.refresh_schedule(2026,w) from generate_series(1,18) w;
do $$ begin
  if exists(select 1 from public.picks p left join survivor_private.schedule s
    on (s.season,s.week,s.team)=(p.season,p.week,p.team) where s.team is null) then
    raise exception 'A saved pick has no matching trusted schedule; stop and investigate';
  end if;
end $$;

create or replace function survivor_private.audit_pick() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into survivor_private.pick_audit(player_id,season,week,operation,actor,actor_id,old_row,new_row)
  values(coalesce(new.player_id,old.player_id),coalesce(new.season,old.season),coalesce(new.week,old.week),tg_op,
    coalesce(nullif(current_setting('survivor.actor',true),''),'database-maintenance'),
    nullif(current_setting('survivor.actor_id',true),'')::bigint,
    case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
  return coalesce(new,old);
end $$;
drop trigger if exists survivor_pick_audit on public.picks;
create trigger survivor_pick_audit after insert or update or delete on public.picks
for each row execute function survivor_private.audit_pick();

create or replace function survivor_private.write_pick(p_actor bigint,p_player bigint,p_week int,p_team text,p_admin boolean)
returns json language plpgsql security definer set search_path = '' as $$
declare old_pick public.picks%rowtype; canonical timestamptz; old_canonical timestamptz;
  is_archived boolean; v_season int := 2026;
begin
  if p_week is null or p_week not between 1 and 18 then return json_build_object('ok',false,'error','Bad week.'); end if;
  -- Lock the player, not just a possibly absent pick. This serializes submit,
  -- replace, clear and no-repeat checks for all weeks for this member.
  select archived into is_archived from public.players where id=p_player for update;
  if not found or is_archived then return json_build_object('ok',false,'error','This entry is not active. Ask the commissioner.'); end if;
  select * into old_pick from public.picks where player_id=p_player and season=v_season and week=p_week;
  if found then
    select kickoff into old_canonical from survivor_private.schedule where season=v_season and week=p_week and team=old_pick.team;
    if old_canonical is null or least(old_canonical,old_pick.kickoff)<=clock_timestamp() then
      return json_build_object('ok',false,'error','That week is locked because your game has started.');
    end if;
  end if;
  if p_team is not null then
    select kickoff into canonical from survivor_private.schedule where season=v_season and week=p_week and team=p_team;
    if canonical is null then return json_build_object('ok',false,'error','That team has no verified game this week. Try again shortly.'); end if;
    if canonical<=clock_timestamp() then return json_build_object('ok',false,'error','That game has already started.'); end if;
  end if;
  perform set_config('survivor.actor',case when p_admin then 'commissioner' else 'member' end,true);
  perform set_config('survivor.actor_id',p_actor::text,true);
  if p_team is null then
    delete from public.picks where player_id=p_player and season=v_season and week=p_week;
  else
    insert into public.picks(player_id,season,week,team,kickoff,entered_by)
    values(p_player,v_season,p_week,p_team,canonical,case when p_admin then 'admin' else 'self' end)
    on conflict on constraint one_pick_per_week do update set team=excluded.team,kickoff=excluded.kickoff,
      entered_by=excluded.entered_by,updated_at=clock_timestamp();
  end if;
  return json_build_object('ok',true);
exception when unique_violation then return json_build_object('ok',false,'error','That team has already been used this season.');
end $$;

-- Preserve old request signatures and personal URLs. Ignore client kickoffs.
create or replace function public.submit_pick(p_token text,p_week int,p_team text,p_kickoff timestamptz default null)
returns json language plpgsql security definer set search_path = '' as $$
declare who bigint;
begin
  select id into who from public.players where token=p_token;
  if who is null then return json_build_object('ok',false,'error','Unknown link.'); end if;
  if p_team is null then return json_build_object('ok',false,'error','Choose a team.'); end if;
  return survivor_private.write_pick(who,who,p_week,p_team,false);
end $$;
create or replace function public.clear_pick(p_token text,p_week int)
returns json language plpgsql security definer set search_path = '' as $$
declare who bigint;
begin
  select id into who from public.players where token=p_token;
  if who is null then return json_build_object('ok',false,'error','Unknown link.'); end if;
  return survivor_private.write_pick(who,who,p_week,null,false);
end $$;
create or replace function public.admin_set_pick(p_admin_token text,p_player_id bigint,p_week int,p_team text,p_kickoff timestamptz default null)
returns json language plpgsql security definer set search_path = '' as $$
declare who bigint;
begin
  select id into who from public.players where token=p_admin_token and is_admin and not archived;
  if who is null then return json_build_object('ok',false,'error','Not an admin.'); end if;
  return survivor_private.write_pick(who,p_player_id,p_week,p_team,true);
end $$;

create or replace function public.admin_archive_player(p_admin_token text,p_player_id bigint,p_archived boolean)
returns json language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin_token(p_admin_token) then return json_build_object('ok',false,'error','Not an admin.'); end if;
  if exists(select 1 from public.players where id=p_player_id and is_admin) then
    return json_build_object('ok',false,'error','Commissioner entries cannot be archived.');
  end if;
  perform survivor_private.snapshot('before-member-archive');
  update public.players set archived=p_archived where id=p_player_id;
  return json_build_object('ok',true);
end $$;
create or replace function public.admin_del_player(p_admin_token text,p_player_id bigint)
returns json language sql security definer set search_path = '' as $$
  select public.admin_archive_player(p_admin_token,p_player_id,true);
$$;
create or replace function public.admin_pick_history(p_admin_token text)
returns table(player_id bigint,week int,created_at timestamptz,actor text,old_team text,new_team text)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin_token(p_admin_token) then raise exception 'Not an admin'; end if;
  return query select a.player_id,a.week,a.created_at,a.actor,a.old_row->>'team',a.new_row->>'team'
  from survivor_private.pick_audit a order by a.id desc limit 500;
end $$;
create or replace function public.league_health(p_admin_token text)
returns json language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin_token(p_admin_token) then raise exception 'Not an admin'; end if;
  return json_build_object('version',2,'hidden_picks_enforced',false,'schedule_updated',(select min(fetched_at) from survivor_private.schedule where kickoff>now()),
    'last_backup',(select max(created_at) from survivor_private.recovery_snapshots),
    'audit_entries',(select count(*) from survivor_private.pick_audit));
end $$;

-- Do NOT tighten the existing picks SELECT policy in this release. Older
-- open pages do not send a personal token on reads; concealing future rows
-- would conceal the member's own pick too. The family's unchanged process
-- takes precedence. Browser concealment remains a trust-based convention.
revoke execute on function public.is_admin_token(text) from public,anon,authenticated;
revoke all on all functions in schema survivor_private from public,anon,authenticated;
revoke all on all sequences in schema survivor_private from public,anon,authenticated;
revoke all on all tables in schema survivor_private from public,anon,authenticated;
revoke all on function public.league_health(text),public.admin_pick_history(text),public.admin_archive_player(text,bigint,boolean) from public;
grant execute on function public.league_health(text),public.admin_pick_history(text),public.admin_archive_player(text,bigint,boolean) to anon,authenticated;

-- Backend jobs run without someone opening the app. These are retained
-- recovery copies in the SAME database, not an off-site disaster backup.
select cron.schedule('survivor-daily-recovery','17 8 * * *',
  $$select survivor_private.snapshot('daily'); delete from survivor_private.recovery_snapshots where reason='daily' and created_at<now()-interval '90 days';$$);
select cron.schedule('survivor-schedule-refresh','7 * * * *',
  $$select survivor_private.refresh_schedule(2026,w) from generate_series(1,18) w where exists(select 1 from survivor_private.schedule where season=2026 and week=w and kickoff between now()-interval '1 day' and now()+interval '15 days');$$);
notify pgrst,'reload schema';
commit;
