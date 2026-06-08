-- guro_huga Supabase realtime state store
-- Run this in the Supabase SQL Editor for the project used by the web app.

create table if not exists public.guro_huga_state (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.guro_huga_state enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.guro_huga_state to anon, authenticated;

drop policy if exists "guro_huga_state_select" on public.guro_huga_state;
drop policy if exists "guro_huga_state_insert" on public.guro_huga_state;
drop policy if exists "guro_huga_state_update" on public.guro_huga_state;

create policy "guro_huga_state_select"
on public.guro_huga_state
for select
to anon, authenticated
using (true);

-- Static GitHub Pages has no server-side secret, so this starter policy allows
-- browser writes with the anon/publishable key. For production HR data, replace
-- this with Supabase Auth policies before opening the link broadly.
create policy "guro_huga_state_insert"
on public.guro_huga_state
for insert
to anon, authenticated
with check (id = 'main');

create policy "guro_huga_state_update"
on public.guro_huga_state
for update
to anon, authenticated
using (id = 'main')
with check (id = 'main');

alter table public.guro_huga_state replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'guro_huga_state'
  ) then
    alter publication supabase_realtime add table public.guro_huga_state;
  end if;
end $$;
