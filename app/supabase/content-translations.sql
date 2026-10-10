-- Saved translations of published role content (e.g. English notes shown in
-- German), so each role is translated once per language instead of on every
-- page view. A translation is replaced automatically when the role changes.
-- Everyone in the company can read and save translations of their company's
-- roles. Safe to run more than once.
create table if not exists public.role_content_translations (
  role_content_id uuid not null references public.role_content(id) on delete cascade,
  lang text not null check (lang in ('en', 'de')),
  source_hash text not null,
  sections jsonb not null,
  created_at timestamptz not null default now(),
  primary key (role_content_id, lang)
);

grant select, insert, update on public.role_content_translations to authenticated;
grant all on public.role_content_translations to service_role;
alter table public.role_content_translations enable row level security;

drop policy if exists "Company members read role translations" on public.role_content_translations;
create policy "Company members read role translations"
on public.role_content_translations for select to authenticated
using (exists (
  select 1 from public.role_content rc
  where rc.id = role_content_id and rc.company_id = public.current_company_id()
));

drop policy if exists "Company members save role translations" on public.role_content_translations;
create policy "Company members save role translations"
on public.role_content_translations for insert to authenticated
with check (exists (
  select 1 from public.role_content rc
  where rc.id = role_content_id and rc.company_id = public.current_company_id()
));

drop policy if exists "Company members update role translations" on public.role_content_translations;
create policy "Company members update role translations"
on public.role_content_translations for update to authenticated
using (exists (
  select 1 from public.role_content rc
  where rc.id = role_content_id and rc.company_id = public.current_company_id()
))
with check (exists (
  select 1 from public.role_content rc
  where rc.id = role_content_id and rc.company_id = public.current_company_id()
));
