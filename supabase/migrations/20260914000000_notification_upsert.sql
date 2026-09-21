begin;

-- Supabase/PostgREST upsert onConflict=dedupe_key cannot infer the existing
-- partial index. PostgreSQL UNIQUE already permits multiple NULL values.
-- Keep the existing index; add the compatible target without changing data.
create unique index if not exists notifications_dedupe_upsert_idx
  on public.notifications(dedupe_key);

create or replace function public.commerce_schema_version()
returns integer
language sql
immutable
security definer set search_path = public
as $$
  select 5;
$$;

revoke all on function public.commerce_schema_version() from public, anon, authenticated;
grant execute on function public.commerce_schema_version() to service_role;

commit;
