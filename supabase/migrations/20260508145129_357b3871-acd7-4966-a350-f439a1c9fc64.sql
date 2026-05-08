
-- ============= FORM SUBMISSIONS: Zuweisung & Lese-Status =============
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- ============= FORM FIELDS: Conditional logic & validation =============
ALTER TABLE public.form_fields
  ADD COLUMN IF NOT EXISTS conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS validations jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ============= APPOINTMENTS: Sichtbarkeit für Ersteller/Zugewiesene =============
DROP POLICY IF EXISTS "Creator views own appointments" ON public.appointments;
CREATE POLICY "Creator views own appointments"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR assigned_user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone backend views public appointments" ON public.appointments;
CREATE POLICY "Anyone backend views public appointments"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (public_visible = true AND public.has_any_backend_role(auth.uid()));

-- ============= FORMS: Editor darf erstellen/bearbeiten =============
DROP POLICY IF EXISTS "Admins insert forms" ON public.forms;
DROP POLICY IF EXISTS "Admins update forms" ON public.forms;
DROP POLICY IF EXISTS "Admins delete forms" ON public.forms;
DROP POLICY IF EXISTS "Admins view all forms" ON public.forms;

CREATE POLICY "Editors view all forms"
  ON public.forms FOR SELECT TO authenticated
  USING (public.can_edit(auth.uid()));
CREATE POLICY "Editors insert forms"
  ON public.forms FOR INSERT TO authenticated
  WITH CHECK (public.can_edit(auth.uid()));
CREATE POLICY "Editors update forms"
  ON public.forms FOR UPDATE TO authenticated
  USING (public.can_edit(auth.uid()));
CREATE POLICY "Admins delete forms"
  ON public.forms FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage fields" ON public.form_fields;
DROP POLICY IF EXISTS "Admins view all fields" ON public.form_fields;
CREATE POLICY "Editors manage fields"
  ON public.form_fields FOR ALL TO authenticated
  USING (public.can_edit(auth.uid()))
  WITH CHECK (public.can_edit(auth.uid()));

-- Submissions: assigned user darf eigene sehen / als gelesen markieren
DROP POLICY IF EXISTS "Assigned users view their submissions" ON public.form_submissions;
CREATE POLICY "Assigned users view their submissions"
  ON public.form_submissions FOR SELECT TO authenticated
  USING (assigned_user_id = auth.uid());

DROP POLICY IF EXISTS "Assigned users update their submissions" ON public.form_submissions;
CREATE POLICY "Assigned users update their submissions"
  ON public.form_submissions FOR UPDATE TO authenticated
  USING (assigned_user_id = auth.uid());

-- ============= PDF / AI MODUL =============
CREATE TABLE IF NOT EXISTS public.pdf_documents (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Dokument',
  storage_path text NOT NULL,
  page_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pdf_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own pdfs" ON public.pdf_documents FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Editors view all pdfs" ON public.pdf_documents FOR SELECT TO authenticated
  USING (public.can_edit(auth.uid()));

CREATE TRIGGER trg_pdf_documents_updated
  BEFORE UPDATE ON public.pdf_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pdf_pages (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.pdf_documents(id) ON DELETE CASCADE,
  page_index integer NOT NULL,
  ocr_text text NOT NULL DEFAULT '',
  ocr_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pdf_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Page access via document"
  ON public.pdf_pages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pdf_documents d WHERE d.id = pdf_pages.document_id AND (d.owner_id = auth.uid() OR public.can_edit(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pdf_documents d WHERE d.id = pdf_pages.document_id AND d.owner_id = auth.uid()));

-- ============= STORAGE BUCKET =============
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdfs', 'pdfs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own PDFs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own PDFs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own PDFs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own PDFs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);
