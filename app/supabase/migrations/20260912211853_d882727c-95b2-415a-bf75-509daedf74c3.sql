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