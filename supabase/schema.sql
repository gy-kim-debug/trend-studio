-- Run once in your Supabase SQL editor.
create table if not exists public.card_drafts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  brand text not null,
  source_urls jsonb not null default '[]'::jsonb,
  slides jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz not null default now()
);

create index if not exists card_drafts_created_at_idx on public.card_drafts(created_at desc);
alter table public.card_drafts enable row level security;
-- No client policies: access is exclusively via authenticated server API.
