create or replace function public.register_login_attempt(attempt_key text) returns integer
language plpgsql security definer set search_path = '' as $$
declare current_attempts integer;
begin
  delete from public.login_rate_limits where expires_at < now();
  insert into public.login_rate_limits(attempt_key) values(register_login_attempt.attempt_key)
  on conflict on constraint login_rate_limits_pkey
  do update set attempts=public.login_rate_limits.attempts+1
  returning public.login_rate_limits.attempts into current_attempts;
  return current_attempts;
end; $$;
revoke all on function public.register_login_attempt(text) from public, anon, authenticated;
grant execute on function public.register_login_attempt(text) to service_role;
