create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('contact', 'b2b', 'newsletter', 'waitlist')),
  payload jsonb not null,
  source text not null default 'avana-web',
  status text not null default 'new',
  notes text not null default '',
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.submissions add column if not exists status text not null default 'new';
alter table public.submissions add column if not exists notes text not null default '';
alter table public.submissions add column if not exists updated_at timestamptz not null default now();

alter table public.submissions enable row level security;

revoke all on table public.submissions from anon, authenticated;
