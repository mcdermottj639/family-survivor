-- v90: commissioner control for the existing tap-to-sign-in list only.
-- Apply this file alone to an existing league. No member rows change on deploy.
-- Existing tokens, roles, picks, links and name-based recovery are preserved.
create or replace function public.admin_hide_name(p_admin_token text, p_player_id bigint)
returns json language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin_token(p_admin_token) then
    return json_build_object('ok', false, 'error', 'Not an admin.');
  end if;
  update public.players set claimed_at = coalesce(claimed_at, now())
    where id = p_player_id;
  if not found then
    return json_build_object('ok', false, 'error', 'That name is not in the league.');
  end if;
  return json_build_object('ok', true);
end $$;
revoke all on function public.admin_hide_name(text, bigint) from public;
grant execute on function public.admin_hide_name(text, bigint) to anon, authenticated;
