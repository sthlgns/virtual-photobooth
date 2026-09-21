-- Virtual Photobooth — Supabase schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- ─────────────────────────────────────────────────────────────
-- Table: rooms
-- ─────────────────────────────────────────────────────────────
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{5}$'),
  status text not null default 'waiting'
    check (status in ('waiting', 'ready', 'in_session', 'completed')),
  host_connected boolean not null default false,
  guest_connected boolean not null default false,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create index if not exists rooms_code_idx on public.rooms (code);
create index if not exists rooms_last_active_idx on public.rooms (last_active_at);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- The app is fully anonymous (no auth), so access is scoped only by
-- knowledge of a room's 5-digit code at the application layer. Policies
-- below allow the anon key to read/write rooms, which is required since
-- there is no signed-in user to scope rows to.
-- ─────────────────────────────────────────────────────────────
alter table public.rooms enable row level security;

create policy "anyone can read rooms" on public.rooms
  for select using (true);

create policy "anyone can create rooms" on public.rooms
  for insert with check (true);

create policy "anyone can update rooms" on public.rooms
  for update using (true);

-- ─────────────────────────────────────────────────────────────
-- Storage bucket for finished strips (optional cloud backup of downloads)
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('strips', 'strips', true)
on conflict (id) do nothing;

create policy "anyone can upload strips" on storage.objects
  for insert with check (bucket_id = 'strips');

create policy "anyone can read strips" on storage.objects
  for select using (bucket_id = 'strips');

-- ─────────────────────────────────────────────────────────────
-- Housekeeping: expire empty/inactive rooms
-- Call this periodically (e.g. via pg_cron, or a Vercel Cron Job hitting an
-- API route) to delete rooms nobody is in and that have gone stale.
-- ─────────────────────────────────────────────────────────────
create or replace function public.expire_inactive_rooms() returns void as $$
  delete from public.rooms
  where not host_connected
    and not guest_connected
    and last_active_at < now() - interval '20 minutes';
$$ language sql;

-- If the pg_cron extension is enabled on your project, schedule it with:
-- select cron.schedule('expire-inactive-rooms', '*/10 * * * *', 'select public.expire_inactive_rooms();');
