begin;

create table if not exists public.admin_sessions (
  session_hash text primary key check (session_hash ~ '^[0-9a-f]{64}$'),
  role text not null default 'admin' check (role = 'admin'),
  mfa_verified boolean not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '2 hours 1 minute')
);
alter table public.admin_sessions enable row level security;
revoke all on table public.admin_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_sessions to service_role;

create or replace function public.register_admin_session(
  session_hash_value text, expires_at_value timestamptz,
  mfa_verified_value boolean, previous_hash_value text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  -- Credential verification happens in the server before this privileged RPC.
  -- Reauthentication rotates this browser's session in the same transaction.
  insert into public.admin_sessions(session_hash, expires_at, mfa_verified)
    values (session_hash_value, expires_at_value, mfa_verified_value);
  update public.admin_sessions set revoked_at = coalesce(revoked_at, now())
    where session_hash = previous_hash_value;
  -- Only expired authority is pruned; an unexpired revoked token stays revoked.
  delete from public.admin_sessions where expires_at < now() - interval '7 days';
end;
$$;

create or replace function public.is_admin_session_active(session_hash_value text, require_mfa boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admin_sessions
    where session_hash = session_hash_value and role = 'admin'
      and revoked_at is null and expires_at > now()
      and (not require_mfa or mfa_verified));
$$;

create or replace function public.revoke_admin_session(session_hash_value text)
returns boolean language sql security definer set search_path = public as $$
  with revoked as (
    update public.admin_sessions set revoked_at = now()
      where session_hash = session_hash_value and revoked_at is null
      returning session_hash
  ) select exists(select 1 from revoked);
$$;

revoke all on function public.register_admin_session(text, timestamptz, boolean, text) from public, anon, authenticated;
revoke all on function public.is_admin_session_active(text, boolean) from public, anon, authenticated;
revoke all on function public.revoke_admin_session(text) from public, anon, authenticated;
grant execute on function public.register_admin_session(text, timestamptz, boolean, text) to service_role;
grant execute on function public.is_admin_session_active(text, boolean) to service_role;
grant execute on function public.revoke_admin_session(text) to service_role;

create or replace function public.commerce_schema_version()
returns integer language sql immutable security definer set search_path = public as $$ select 6; $$;
revoke all on function public.commerce_schema_version() from public, anon, authenticated;
grant execute on function public.commerce_schema_version() to service_role;

commit;
