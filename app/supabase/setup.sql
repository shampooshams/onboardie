-- Onboardie: complete database setup.
-- Paste this whole file into Supabase → SQL Editor and click Run, once, on an empty project.
-- It is the files in migrations/ combined in order, inside one transaction:
-- if anything fails, nothing is applied and it can safely be run again.

begin;

-- ============================================================
-- migrations/20260821095133_134960ed-80fd-4c84-8cc6-a94e9104da98.sql
-- ============================================================

CREATE TABLE public.coach_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  topic text not null,
  hire_name text,
  created_at timestamptz not null default now()
);
GRANT ALL ON public.coach_questions TO service_role;
ALTER TABLE public.coach_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.company_update (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text,
  link_url text,
  updated_at timestamptz not null default now()
);
GRANT ALL ON public.company_update TO service_role;
ALTER TABLE public.company_update ENABLE ROW LEVEL SECURITY;

INSERT INTO public.company_update (title, image_url, link_url) VALUES
('Q3 kickoff: our new mid-market playbook is live', null, 'https://www.notion.so');

-- ============================================================
-- migrations/20260828135218_ee830672-2555-46c2-9aa2-23f1e2d53d31.sql
-- ============================================================

CREATE TABLE public.ai_failure_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature text NOT NULL,
  reason text NOT NULL,
  status_code integer,
  detail text,
  content_length integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_failure_log TO service_role;

ALTER TABLE public.ai_failure_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages AI failure diagnostics"
  ON public.ai_failure_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- migrations/20260828140702_6951d4fc-6a8b-4a75-9ee8-91c282944f8d.sql
-- ============================================================

CREATE TYPE public.app_role AS ENUM ('new_hire','manager');

CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role_title text NOT NULL DEFAULT '',
  email text,
  start_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role_title, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role_title', ''),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN NEW.raw_user_meta_data->>'app_role' = 'manager' THEN 'manager'::public.app_role
         ELSE 'new_hire'::public.app_role END
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- migrations/20260828140728_428c38cc-ffc5-45d8-a4f2-3fe5d25054a9.sql
-- ============================================================

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM anon, authenticated;

CREATE POLICY "Service role manages coach questions" ON public.coach_questions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages company update" ON public.company_update FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- migrations/20260828140748_59194774-a118-44fa-a53a-eb0ad7a89824.sql
-- ============================================================

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC;

-- ============================================================
-- migrations/20260910205809_3f6ba1fa-5814-4381-bb6e-fd11e6dfe835.sql
-- ============================================================

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email_domain text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE POLICY "Members can view their own company"
ON public.companies FOR SELECT TO authenticated
USING (id = public.current_company_id());

CREATE OR REPLACE FUNCTION public.company_for_email(_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _domain text;
  _id uuid;
BEGIN
  _domain := lower(nullif(split_part(coalesce(_email, ''), '@', 2), ''));
  IF _domain IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id INTO _id FROM public.companies WHERE email_domain = _domain;
  IF _id IS NULL THEN
    INSERT INTO public.companies (name, email_domain)
    VALUES (initcap(split_part(_domain, '.', 1)), _domain)
    ON CONFLICT (email_domain) DO UPDATE SET updated_at = now()
    RETURNING id INTO _id;
  END IF;
  RETURN _id;
END;
$$;

UPDATE public.profiles p
SET company_id = public.company_for_email(p.email)
WHERE p.company_id IS NULL AND p.email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role_title, email, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role_title', ''),
    NEW.email,
    public.company_for_email(NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN NEW.raw_user_meta_data->>'app_role' = 'manager' THEN 'manager'::public.app_role
         ELSE 'new_hire'::public.app_role END
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TABLE public.role_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role text NOT NULL,
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_content TO authenticated;
GRANT ALL ON public.role_content TO service_role;
ALTER TABLE public.role_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view their company role content"
ON public.role_content FOR SELECT TO authenticated
USING (company_id = public.current_company_id());

CREATE POLICY "Company managers can create role content"
ON public.role_content FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Company managers can update role content"
ON public.role_content FOR UPDATE TO authenticated
USING (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'manager'))
WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Company managers can delete role content"
ON public.role_content FOR DELETE TO authenticated
USING (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER role_content_touch_updated_at
BEFORE UPDATE ON public.role_content
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER companies_touch_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.coach_questions ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.coach_questions DROP COLUMN hire_name;

GRANT SELECT ON public.coach_questions TO authenticated;

CREATE POLICY "Company managers can read their company questions"
ON public.coach_questions FOR SELECT TO authenticated
USING (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'manager'));

ALTER TABLE public.company_update ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

GRANT SELECT, INSERT, UPDATE ON public.company_update TO authenticated;

CREATE POLICY "Company members can view their company update"
ON public.company_update FOR SELECT TO authenticated
USING (company_id = public.current_company_id());

CREATE POLICY "Company managers can create their company update"
ON public.company_update FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Company managers can update their company update"
ON public.company_update FOR UPDATE TO authenticated
USING (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'manager'))
WITH CHECK (company_id = public.current_company_id() AND public.has_role(auth.uid(), 'manager'));

-- ============================================================
-- migrations/20260910210331_f4c131b8-ab02-4661-9531-97d29f2579cb.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_free_email_domain(_domain text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(coalesce(_domain, '')) IN (
    'gmail.com','googlemail.com','outlook.com','hotmail.com','hotmail.de','live.com',
    'yahoo.com','yahoo.de','icloud.com','me.com','gmx.de','gmx.net','gmx.com',
    'web.de','t-online.de','protonmail.com','proton.me','aol.com','mail.com','yandex.com'
  );
$$;

CREATE OR REPLACE FUNCTION public.company_for_user(_email text, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _domain text;
  _id uuid;
BEGIN
  _domain := lower(nullif(split_part(coalesce(_email, ''), '@', 2), ''));
  IF _domain IS NULL THEN
    INSERT INTO public.companies (name, email_domain) VALUES ('My company', NULL) RETURNING id INTO _id;
    RETURN _id;
  END IF;

  IF public.is_free_email_domain(_domain) THEN
    -- Personal mailbox: give this account its own private company, never shared.
    INSERT INTO public.companies (name, email_domain)
    VALUES (initcap(split_part(coalesce(_email, ''), '@', 1)) || '''s company', NULL)
    RETURNING id INTO _id;
    RETURN _id;
  END IF;

  SELECT id INTO _id FROM public.companies WHERE email_domain = _domain;
  IF _id IS NULL THEN
    INSERT INTO public.companies (name, email_domain)
    VALUES (initcap(split_part(_domain, '.', 1)), _domain)
    ON CONFLICT (email_domain) DO UPDATE SET updated_at = now()
    RETURNING id INTO _id;
  END IF;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role_title, email, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role_title', ''),
    NEW.email,
    public.company_for_user(NEW.email, NEW.id)
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN NEW.raw_user_meta_data->>'app_role' = 'manager' THEN 'manager'::public.app_role
         ELSE 'new_hire'::public.app_role END
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  _p record;
BEGIN
  FOR _p IN
    SELECT p.id, p.email
    FROM public.profiles p
    JOIN public.companies c ON c.id = p.company_id
    WHERE c.email_domain IS NOT NULL AND public.is_free_email_domain(c.email_domain)
  LOOP
    UPDATE public.profiles SET company_id = public.company_for_user(_p.email, _p.id) WHERE id = _p.id;
  END LOOP;
END $$;

DELETE FROM public.companies c
WHERE c.email_domain IS NOT NULL
  AND public.is_free_email_domain(c.email_domain)
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.company_id = c.id);

DROP FUNCTION IF EXISTS public.company_for_email(text);

-- ============================================================
-- migrations/20260910210357_61968895-5708-4ffe-852b-e0f4a6a35478.sql
-- ============================================================

REVOKE ALL ON FUNCTION public.company_for_user(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_free_email_domain(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- ============================================================
-- migrations/20260910210538_a3849d66-155d-4d7d-a556-1ae5f80ebf67.sql
-- ============================================================

DROP POLICY "Company managers can create role content" ON public.role_content;
DROP POLICY "Company managers can update role content" ON public.role_content;
DROP POLICY "Company managers can delete role content" ON public.role_content;

CREATE POLICY "Company members can create role content"
ON public.role_content FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company_id());

CREATE POLICY "Company members can update role content"
ON public.role_content FOR UPDATE TO authenticated
USING (company_id = public.current_company_id())
WITH CHECK (company_id = public.current_company_id());

CREATE POLICY "Company members can delete role content"
ON public.role_content FOR DELETE TO authenticated
USING (company_id = public.current_company_id());

DROP POLICY "Company managers can read their company questions" ON public.coach_questions;
CREATE POLICY "Company members can read their company questions"
ON public.coach_questions FOR SELECT TO authenticated
USING (company_id = public.current_company_id());

DROP POLICY "Company managers can create their company update" ON public.company_update;
DROP POLICY "Company managers can update their company update" ON public.company_update;

CREATE POLICY "Company members can create their company update"
ON public.company_update FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company_id());

CREATE POLICY "Company members can update their company update"
ON public.company_update FOR UPDATE TO authenticated
USING (company_id = public.current_company_id())
WITH CHECK (company_id = public.current_company_id());

-- ============================================================
-- migrations/20260911210027_0552f479-5cc1-4322-946e-4983532ecd06.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, role_title, email, company_id, start_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role_title', ''),
    NEW.email,
    public.company_for_user(NEW.email, NEW.id),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'start_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
        THEN (NEW.raw_user_meta_data->>'start_date')::date
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN NEW.raw_user_meta_data->>'app_role' = 'manager' THEN 'manager'::public.app_role
         ELSE 'new_hire'::public.app_role END
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- migrations/20260912211853_d882727c-95b2-415a-bf75-509daedf74c3.sql
-- ============================================================

CREATE TABLE public.role_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role text NOT NULL,
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_revision boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (company_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_drafts TO authenticated;
GRANT ALL ON public.role_drafts TO service_role;

ALTER TABLE public.role_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view their company drafts" ON public.role_drafts
  FOR SELECT TO authenticated USING (company_id = public.current_company_id());
CREATE POLICY "Company members can create drafts" ON public.role_drafts
  FOR INSERT TO authenticated WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "Company members can update drafts" ON public.role_drafts
  FOR UPDATE TO authenticated USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());
CREATE POLICY "Company members can delete drafts" ON public.role_drafts
  FOR DELETE TO authenticated USING (company_id = public.current_company_id());

CREATE TRIGGER role_drafts_touch_updated_at BEFORE UPDATE ON public.role_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- migrations/20260917202948_6dcfd9b4-5c12-49c9-aa39-40f0f54a5fc3.sql
-- ============================================================

-- Readable, unambiguous code generator (no O/0/I/1)
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _code text;
  _i int;
BEGIN
  LOOP
    _code := 'ONB-';
    FOR _i IN 1..6 LOOP
      _code := _code || substr(_alphabet, 1 + floor(random() * length(_alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.companies WHERE invite_code = _code);
  END LOOP;
  RETURN _code;
END;
$$;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS invite_code text;

UPDATE public.companies SET invite_code = public.generate_invite_code() WHERE invite_code IS NULL;

ALTER TABLE public.companies ALTER COLUMN invite_code SET NOT NULL;
ALTER TABLE public.companies ALTER COLUMN invite_code SET DEFAULT public.generate_invite_code();

CREATE UNIQUE INDEX IF NOT EXISTS companies_invite_code_key ON public.companies (invite_code);

-- Joins the signed-in account to the company owning the given code.
CREATE OR REPLACE FUNCTION public.join_company_by_code(_code text)
RETURNS TABLE (company_id uuid, company_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT c.id, c.name INTO _id, _name
  FROM public.companies c
  WHERE upper(regexp_replace(c.invite_code, '\s', '', 'g'))
      = upper(regexp_replace(coalesce(_code, ''), '\s', '', 'g'));

  IF _id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles SET company_id = _id, updated_at = now() WHERE id = auth.uid();

  RETURN QUERY SELECT _id, _name;
END;
$$;

-- Reads the invite code of the caller's own company only.
CREATE OR REPLACE FUNCTION public.my_company_invite()
RETURNS TABLE (company_id uuid, company_name text, invite_code text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.invite_code
  FROM public.companies c
  WHERE c.id = public.current_company_id();
$$;

GRANT EXECUTE ON FUNCTION public.join_company_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_company_invite() TO authenticated;

-- ============================================================
-- migrations/20260917203008_94374922-501e-4029-8602-17bcb17e1d53.sql
-- ============================================================

REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_company_by_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_company_invite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_company_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_company_invite() TO authenticated;

-- ============================================================
-- migrations/20260917203057_f41b2774-c520-4c5d-8740-8af66440acf5.sql
-- ============================================================

CREATE TABLE public.company_docs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_docs TO authenticated;
GRANT ALL ON public.company_docs TO service_role;

ALTER TABLE public.company_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view their company documents"
  ON public.company_docs FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Company members can add company documents"
  ON public.company_docs FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id());

CREATE POLICY "Company members can update company documents"
  ON public.company_docs FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

CREATE POLICY "Company members can delete company documents"
  ON public.company_docs FOR DELETE TO authenticated
  USING (company_id = public.current_company_id());

CREATE TRIGGER company_docs_touch_updated_at
  BEFORE UPDATE ON public.company_docs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX company_docs_company_idx ON public.company_docs (company_id);

-- ============================================================
-- migrations/20260917205309_3f7daf52-de2a-4fb0-827c-4054f45ddd0b.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code text;
  _company uuid;
BEGIN
  _code := nullif(regexp_replace(coalesce(NEW.raw_user_meta_data->>'invite_code', ''), '\s', '', 'g'), '');

  IF _code IS NOT NULL THEN
    SELECT c.id INTO _company
    FROM public.companies c
    WHERE upper(regexp_replace(c.invite_code, '\s', '', 'g')) = upper(_code);
  END IF;

  IF _company IS NULL THEN
    _company := public.company_for_user(NEW.email, NEW.id);
  END IF;

  INSERT INTO public.profiles (id, full_name, role_title, email, company_id, start_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role_title', ''),
    NEW.email,
    _company,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'start_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
        THEN (NEW.raw_user_meta_data->>'start_date')::date
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN NEW.raw_user_meta_data->>'app_role' = 'manager' THEN 'manager'::public.app_role
         ELSE 'new_hire'::public.app_role END
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

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

commit;
