-- Owner-approved family-trust recovery. No identity, token or pick writes.
-- Existing links and all existing RPC signatures remain unchanged.
create or replace function public.recover_player(p_name text)
returns json language plpgsql stable security definer set search_path = '' as $$
declare v public.players%rowtype; n integer;
begin
  if p_name is null or length(btrim(p_name)) = 0 or length(p_name) > 200 then
    return json_build_object('ok', false, 'error', 'Please type your name.');
  end if;
  select count(*) into n from public.players p
    where lower(btrim(regexp_replace(p.display_name, '[[:space:]]+', ' ', 'g')))
        = lower(btrim(regexp_replace(p_name, '[[:space:]]+', ' ', 'g')));
  if n <> 1 then
    return json_build_object('ok', false, 'error', 'Could not restore that name. Use your own link or ask the commissioner.');
  end if;
  select * into v from public.players p
    where lower(btrim(regexp_replace(p.display_name, '[[:space:]]+', ' ', 'g')))
        = lower(btrim(regexp_replace(p_name, '[[:space:]]+', ' ', 'g')));
  -- Server-side exclusion: never return an admin credential through recovery.
  -- to_jsonb supports a future archived column without requiring that upgrade.
  if v.is_admin or v.claimed_at is null or coalesce((to_jsonb(v)->>'archived')::boolean, false) then
    return json_build_object('ok', false, 'error', 'Could not restore that name. Use your own link or ask the commissioner.');
  end if;
  return json_build_object('ok', true, 'token', v.token);
end $$;
revoke all on function public.recover_player(text) from public;
grant execute on function public.recover_player(text) to anon, authenticated;
