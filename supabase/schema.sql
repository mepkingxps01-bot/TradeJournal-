-- ---------------------------------------------------------------------------
-- Trade Journal — Supabase schema
--
-- Run this ONCE in your Supabase project:
--   Dashboard → SQL Editor → New query → paste all of this → Run.
--
-- It creates the two tables the app syncs to, a private Storage bucket for
-- chart images, and Row-Level-Security policies so each signed-in user can
-- only ever see and change their own rows. The anon key shipped in the web app
-- is safe precisely because of these policies.
-- ---------------------------------------------------------------------------

-- === Tables =================================================================

create table if not exists public.entries (
  user_id    uuid    not null references auth.users (id) on delete cascade,
  date       text    not null,              -- YYYY-MM-DD, one row per trading day
  data       jsonb,                         -- the full JournalEntry (null when deleted)
  updated_at bigint  not null,              -- epoch millis, drives last-write-wins
  deleted    boolean not null default false,-- soft-delete tombstone
  primary key (user_id, date)
);

create table if not exists public.images (
  user_id      uuid    not null references auth.users (id) on delete cascade,
  id           text    not null,            -- client-generated image id
  entry_date   text    not null,
  section      text    not null,
  caption      text    not null default '',
  "order"      int     not null default 0,
  created_at   bigint  not null,
  updated_at   bigint  not null,
  storage_path text,                        -- path in the journal-images bucket
  deleted      boolean not null default false,
  primary key (user_id, id)
);

-- Sync pulls rows newer than a cursor, so index the timestamp.
create index if not exists entries_updated_at_idx on public.entries (user_id, updated_at);
create index if not exists images_updated_at_idx  on public.images  (user_id, updated_at);

-- === Row Level Security =====================================================

alter table public.entries enable row level security;
alter table public.images  enable row level security;

drop policy if exists "own entries" on public.entries;
create policy "own entries" on public.entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own images" on public.images;
create policy "own images" on public.images
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- === Realtime ===============================================================
-- Lets other devices get pushed changes live.
alter publication supabase_realtime add table public.entries;
alter publication supabase_realtime add table public.images;

-- === Storage bucket for chart images ========================================

insert into storage.buckets (id, name, public)
values ('journal-images', 'journal-images', false)
on conflict (id) do nothing;

-- Each user's images live under a folder named after their user id, so the
-- first path segment must equal their uid.
drop policy if exists "own image objects read"   on storage.objects;
drop policy if exists "own image objects write"  on storage.objects;
drop policy if exists "own image objects delete" on storage.objects;

create policy "own image objects read" on storage.objects
  for select using (
    bucket_id = 'journal-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own image objects write" on storage.objects
  for insert with check (
    bucket_id = 'journal-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own image objects delete" on storage.objects
  for delete using (
    bucket_id = 'journal-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
