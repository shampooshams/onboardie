REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_company_by_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_company_invite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_company_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_company_invite() TO authenticated;