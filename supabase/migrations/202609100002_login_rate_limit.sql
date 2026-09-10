create table public.login_rate_limits (
  attempt_key text primary key, attempts integer not null default 1, expires_at timestamptz not null default now() + interval '6 minutes'
);
alter table public.login_rate_limits enable row level security;
revoke all on public.login_rate_limits from anon, authenticated;
create or replace function public.register_login_attempt(attempt_key text) returns integer language plpgsql security definer set search_path = '' as $$
declare current_attempts integer;
begin
  delete from public.login_rate_limits where expires_at < now();
  insert into public.login_rate_limits(attempt_key) values(register_login_attempt.attempt_key)
  on conflict(attempt_key) do update set attempts=public.login_rate_limits.attempts+1
  returning attempts into current_attempts;
  return current_attempts;
end; $$;
revoke all on function public.register_login_attempt(text) from public, anon, authenticated;
grant execute on function public.register_login_attempt(text) to service_role;
