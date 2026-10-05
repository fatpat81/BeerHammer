-- -----------------------------------------------------------------------------
-- BeerHammer - Identity: callsign#tag profiles, private login links, lockout
-- -----------------------------------------------------------------------------

-- Public profile. The callsign + tag is the user's public handle (Captain Titus#4821).
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  callsign      text not null check (callsign ~ '^[A-Za-z0-9 _-]{3,24}$'),
  callsign_key  text generated always as (lower(callsign)) stored,
  tag           smallint not null check (tag between 1000 and 9999),
  created_at    timestamptz not null default now(),
  unique (callsign_key, tag)
);

alter table public.profiles enable row level security;

-- Handles are public (they appear on the board and in the inbox).
-- Clients can never insert or update profiles; only the Edge Functions can.
drop policy if exists "profiles are readable by everyone" on public.profiles;
create policy "profiles are readable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.profiles from anon, authenticated;

-- Private login data: synthetic email + lockout state. No policies on purpose:
-- with RLS on and no policy, only the service role (Edge Functions) can touch it.
create table if not exists public.auth_links (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  login_email      text not null unique,
  failed_attempts  int  not null default 0,
  locked_until     timestamptz
);

alter table public.auth_links enable row level security;
revoke all on public.auth_links from anon, authenticated;

-- Atomically record a failed passcode. Locks the account after p_max failures.
create or replace function public.bh_register_failure(p_user uuid, p_max int, p_lock interval)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_locked timestamptz;
begin
  update public.auth_links
     set failed_attempts = case when failed_attempts + 1 >= p_max then 0 else failed_attempts + 1 end,
         locked_until    = case when failed_attempts + 1 >= p_max then now() + p_lock else locked_until end
   where user_id = p_user
  returning locked_until into v_locked;
  return v_locked;
end;
$$;

create or replace function public.bh_reset_failures(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.auth_links set failed_attempts = 0, locked_until = null where user_id = p_user;
$$;

revoke execute on function public.bh_register_failure(uuid, int, interval) from public, anon, authenticated;
revoke execute on function public.bh_reset_failures(uuid)                  from public, anon, authenticated;
grant  execute on function public.bh_register_failure(uuid, int, interval) to service_role;
grant  execute on function public.bh_reset_failures(uuid)                  to service_role;
