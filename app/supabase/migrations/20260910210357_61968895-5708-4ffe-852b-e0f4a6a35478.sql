REVOKE ALL ON FUNCTION public.company_for_user(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_free_email_domain(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;