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