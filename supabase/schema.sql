-- ---------------------------------------------------------------------------
-- Trade Journal — Supabase schema
--
-- Run this ONCE in your Supabase project:
--   Dashboard → SQL Editor → New query → paste all of this → Run.
--
-- It creates the tables the app syncs to and a Storage bucket for chart
-- images. Single-user, NO LOGIN: every row uses user_id = 'me' and the
-- policies let the app's anon key read and write everything. Anyone who has
-- the site's anon key could too — fine for a private personal journal, but
-- don't store anything secret here.
-- ---------------------------------------------------------------------------

-- === Tables =================================================================

create table if not exists public.entries (
  user_id    text    not null default 'me',
  date       text    not null,              -- YYYY-MM-DD, one row per trading day
  data       jsonb,                         -- the full JournalEntry (null when deleted)
  updated_at bigint  not null,              -- epoch millis, drives last-write-wins
  deleted    boolean not null default false,-- soft-delete tombstone
  primary key (user_id, date)
);

-- A day is an ordered stack of blocks: each is either typed text or an image.
create table if not exists public.blocks (
  user_id      text    not null default 'me',
  id           text    not null,            -- client-generated block id
  entry_date   text    not null,
  type         text    not null,            -- 'text' | 'image'
  "order"      int     not null default 0,
  text         text,                        -- text blocks
  caption      text,                        -- image blocks
  created_at   bigint  not null,
  updated_at   bigint  not null,
  storage_path text,                        -- path in the journal-images bucket (image blocks)
  deleted      boolean not null default false,
  primary key (user_id, id)
);

-- Pair journal (Narrative Training): one row per week / day, stored whole as jsonb.
create table if not exists public.pweeks (
  user_id    text    not null default 'me',
  id         text    not null,              -- `${pair}|${weekStart}`
  data       jsonb,
  updated_at bigint  not null,
  deleted    boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.pdays (
  user_id    text    not null default 'me',
  id         text    not null,              -- `${pair}|${weekStart}|${dow}`
  data       jsonb,
  updated_at bigint  not null,
  deleted    boolean not null default false,
  primary key (user_id, id)
);

-- Pasted charts on week/day pages; the image itself lives in Storage.
create table if not exists public.shots (
  user_id      text    not null default 'me',
  id           text    not null,
  owner        text    not null,            -- week:<pair>:<ws> | day:<pair>:<ws>:<dow>
  slot         text    not null,
  "order"      int     not null default 0,
  caption      text,
  created_at   bigint  not null,
  updated_at   bigint  not null,
  storage_path text,
  deleted      boolean not null default false,
  primary key (user_id, id)
);

-- Sync pulls rows newer than a cursor, so index the timestamp.
create index if not exists entries_updated_at_idx on public.entries (user_id, updated_at);
create index if not exists blocks_updated_at_idx  on public.blocks  (user_id, updated_at);
create index if not exists pweeks_updated_at_idx  on public.pweeks  (user_id, updated_at);
create index if not exists pdays_updated_at_idx   on public.pdays   (user_id, updated_at);
create index if not exists shots_updated_at_idx   on public.shots   (user_id, updated_at);

-- === Row Level Security =====================================================

alter table public.entries enable row level security;
alter table public.blocks  enable row level security;
alter table public.pweeks  enable row level security;
alter table public.pdays   enable row level security;
alter table public.shots   enable row level security;

drop policy if exists "own entries" on public.entries;
create policy "own entries" on public.entries
  for all using (true) with check (true);

drop policy if exists "own blocks" on public.blocks;
create policy "own blocks" on public.blocks
  for all using (true) with check (true);

drop policy if exists "own pweeks" on public.pweeks;
create policy "own pweeks" on public.pweeks
  for all using (true) with check (true);

drop policy if exists "own pdays" on public.pdays;
create policy "own pdays" on public.pdays
  for all using (true) with check (true);

drop policy if exists "own shots" on public.shots;
create policy "own shots" on public.shots
  for all using (true) with check (true);

-- === Realtime ===============================================================
-- Lets other devices get pushed changes live. Safe to re-run.
do $$
declare t text;
begin
  foreach t in array array['entries','blocks','pweeks','pdays','shots'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- === Storage bucket for chart images ========================================

insert into storage.buckets (id, name, public)
values ('journal-images', 'journal-images', false)
on conflict (id) do nothing;

-- No login: the app may read/write/delete any image in this bucket.
drop policy if exists "own image objects read"   on storage.objects;
drop policy if exists "own image objects write"  on storage.objects;
drop policy if exists "own image objects delete" on storage.objects;

create policy "own image objects read" on storage.objects
  for select using (
    bucket_id = 'journal-images'
  );

create policy "own image objects write" on storage.objects
  for insert with check (
    bucket_id = 'journal-images'
  );

create policy "own image objects delete" on storage.objects
  for delete using (
    bucket_id = 'journal-images'
  );
