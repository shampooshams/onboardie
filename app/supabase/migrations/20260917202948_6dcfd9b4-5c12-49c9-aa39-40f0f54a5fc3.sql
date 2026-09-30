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