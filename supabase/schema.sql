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

-- Trend discovery records, including a reviewable five-slide draft.
create table if not exists public.trend_candidates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  summary text not null,
  why_now text not null,
  buzz_score integer not null check (buzz_score between 0 and 100),
  value_score integer not null check (value_score between 0 and 100),
  source_urls jsonb not null default '[]'::jsonb,
  draft jsonb not null,
  collected_on date not null,
  fingerprint text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists trend_candidates_created_at_idx on public.trend_candidates(created_at desc);
create index if not exists trend_candidates_collected_on_idx on public.trend_candidates(collected_on);
alter table public.trend_candidates enable row level security;
-- No public client policies. Only the authenticated server can read/write.
