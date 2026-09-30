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