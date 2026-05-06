
-- FORMS
CREATE TABLE public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  submit_label text NOT NULL DEFAULT 'Absenden',
  success_message text NOT NULL DEFAULT 'Vielen Dank! Ihre Eingabe wurde gespeichert.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published forms" ON public.forms FOR SELECT USING (published = true);
CREATE POLICY "Admins view all forms" ON public.forms FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert forms" ON public.forms FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update forms" ON public.forms FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete forms" ON public.forms FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_forms_updated BEFORE UPDATE ON public.forms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FORM FIELDS
CREATE TABLE public.form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  field_type text NOT NULL CHECK (field_type IN ('text','number','email','textarea','radio','checkbox','html')),
  label text NOT NULL DEFAULT '',
  field_name text NOT NULL DEFAULT '',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  html_content text NOT NULL DEFAULT '',
  required boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  placeholder text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view fields of published forms" ON public.form_fields FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.published = true));
CREATE POLICY "Admins view all fields" ON public.form_fields FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage fields" ON public.form_fields FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE INDEX idx_form_fields_form ON public.form_fields(form_id, position);

-- FORM SUBMISSIONS
CREATE TABLE public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit to published forms" ON public.form_submissions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.published = true));
CREATE POLICY "Admins view submissions" ON public.form_submissions FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete submissions" ON public.form_submissions FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE INDEX idx_form_submissions_form ON public.form_submissions(form_id, created_at DESC);
