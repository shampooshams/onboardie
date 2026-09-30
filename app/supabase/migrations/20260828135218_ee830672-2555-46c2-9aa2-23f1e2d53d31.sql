CREATE TABLE public.ai_failure_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature text NOT NULL,
  reason text NOT NULL,
  status_code integer,
  detail text,
  content_length integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_failure_log TO service_role;

ALTER TABLE public.ai_failure_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages AI failure diagnostics"
  ON public.ai_failure_log FOR ALL TO service_role USING (true) WITH CHECK (true);