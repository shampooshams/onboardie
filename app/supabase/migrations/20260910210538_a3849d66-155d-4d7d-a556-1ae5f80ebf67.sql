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