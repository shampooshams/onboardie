-- Saved AI Coach conversations, so new hires can pick up where they left off
-- (on any device). Each person can only read and delete their own messages.
-- Safe to run more than once.
create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'coach')),
  text text not null,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists coach_messages_user_created_idx
  on public.coach_messages (user_id, created_at);

grant select, insert, delete on public.coach_messages to authenticated;
grant all on public.coach_messages to service_role;
alter table public.coach_messages enable row level security;

drop policy if exists "Users read their own coach messages" on public.coach_messages;
create policy "Users read their own coach messages"
on public.coach_messages for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users add their own coach messages" on public.coach_messages;
create policy "Users add their own coach messages"
on public.coach_messages for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users delete their own coach messages" on public.coach_messages;
create policy "Users delete their own coach messages"
on public.coach_messages for delete to authenticated
using (user_id = auth.uid());
