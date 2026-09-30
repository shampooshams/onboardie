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