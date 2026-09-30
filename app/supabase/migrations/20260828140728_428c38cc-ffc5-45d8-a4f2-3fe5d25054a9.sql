REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM anon, authenticated;

CREATE POLICY "Service role manages coach questions" ON public.coach_questions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages company update" ON public.company_update FOR ALL TO service_role USING (true) WITH CHECK (true);