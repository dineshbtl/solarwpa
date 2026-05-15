-- Unified activity logs for warehouse/installations

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  message text not null,
  actor_id text,
  actor_name text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_entity
  on public.activity_logs (entity_type, entity_id, created_at desc);

alter table public.activity_logs enable row level security;

drop policy if exists "activity_logs_select_authenticated" on public.activity_logs;
create policy "activity_logs_select_authenticated"
  on public.activity_logs
  for select
  to authenticated
  using (true);

drop policy if exists "activity_logs_insert_authenticated" on public.activity_logs;
create policy "activity_logs_insert_authenticated"
  on public.activity_logs
  for insert
  to authenticated
  with check (true);
