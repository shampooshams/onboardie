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