CREATE TABLE public.coach_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  topic text not null,
  hire_name text,
  created_at timestamptz not null default now()
);
GRANT ALL ON public.coach_questions TO service_role;
ALTER TABLE public.coach_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.company_update (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text,
  link_url text,
  updated_at timestamptz not null default now()
);
GRANT ALL ON public.company_update TO service_role;
ALTER TABLE public.company_update ENABLE ROW LEVEL SECURITY;

INSERT INTO public.company_update (title, image_url, link_url) VALUES
('Q3 kickoff: our new mid-market playbook is live', null, 'https://www.notion.so');