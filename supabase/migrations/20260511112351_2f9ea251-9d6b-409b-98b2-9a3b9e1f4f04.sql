
ALTER TABLE public.pdf_documents
  ADD COLUMN IF NOT EXISTS checked_out_by uuid,
  ADD COLUMN IF NOT EXISTS checked_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS detected_type_id uuid,
  ADD COLUMN IF NOT EXISTS matched_keywords jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Replace the editor-view policy so checked-out docs are hidden from others
DROP POLICY IF EXISTS "Editors view all pdfs" ON public.pdf_documents;
CREATE POLICY "Backend users view available pdfs"
  ON public.pdf_documents FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR (
      can_edit(auth.uid())
      AND (checked_out_by IS NULL OR checked_out_by = auth.uid())
    )
  );

CREATE TABLE IF NOT EXISTS public.document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "backend read types" ON public.document_types;
DROP POLICY IF EXISTS "backend write types" ON public.document_types;
CREATE POLICY "backend read types" ON public.document_types FOR SELECT TO authenticated
  USING (has_any_backend_role(auth.uid()));
CREATE POLICY "backend write types" ON public.document_types FOR ALL TO authenticated
  USING (can_edit(auth.uid())) WITH CHECK (can_edit(auth.uid()));
DROP TRIGGER IF EXISTS trg_doctypes_updated ON public.document_types;
CREATE TRIGGER trg_doctypes_updated BEFORE UPDATE ON public.document_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.document_type_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id uuid NOT NULL REFERENCES public.document_types(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_kw_type ON public.document_type_keywords(type_id);
ALTER TABLE public.document_type_keywords ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "backend read kw" ON public.document_type_keywords;
DROP POLICY IF EXISTS "backend write kw" ON public.document_type_keywords;
CREATE POLICY "backend read kw" ON public.document_type_keywords FOR SELECT TO authenticated
  USING (has_any_backend_role(auth.uid()));
CREATE POLICY "backend write kw" ON public.document_type_keywords FOR ALL TO authenticated
  USING (can_edit(auth.uid())) WITH CHECK (can_edit(auth.uid()));
