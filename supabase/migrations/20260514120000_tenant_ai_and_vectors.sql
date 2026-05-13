-- Mandanten-KI-Konfiguration, Vektor-Chunks, extrahierte Felder
-- pgvector für semantische Suche (768-dim für OpenAI dimensions=768 + nomic-embed-text)

CREATE EXTENSION IF NOT EXISTS vector;

CREATE OR REPLACE FUNCTION public.can_access_tenant_or_global(_uid uuid, _tid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'admin'::app_role)
  OR public.user_in_tenant(_uid, _tid);
$$;

-- ---------------------------------------------------------------------------
-- tenant_ai_config
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN (
    'ollama', 'groq', 'openai', 'google', 'mistral', 'deepseek', 'custom'
  )),
  base_url text NOT NULL DEFAULT '',
  api_key_encrypted text,
  model_name text NOT NULL DEFAULT '',
  embedding_model text,
  max_tokens integer NOT NULL DEFAULT 4096,
  temperature double precision NOT NULL DEFAULT 0.7,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tenant_ai_one_active
  ON public.tenant_ai_config (tenant_id)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_tenant_ai_config_tenant ON public.tenant_ai_config(tenant_id);

ALTER TABLE public.tenant_ai_config ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_tenant_ai_config_updated
  BEFORE UPDATE ON public.tenant_ai_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_tenant_id_trg
  BEFORE INSERT ON public.tenant_ai_config
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_default();

CREATE POLICY tenant_isolation ON public.tenant_ai_config
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_access_tenant_or_global(auth.uid(), tenant_id))
  WITH CHECK (public.can_access_tenant_or_global(auth.uid(), tenant_id));

-- Mandanten-Admins (oder globale Admins): voller Zugriff
CREATE POLICY tenant_ai_config_admin_all ON public.tenant_ai_config
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_tenant_admin(auth.uid(), tenant_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_tenant_admin(auth.uid(), tenant_id)
  );

-- Kein direkter Lesezugriff für normale Mitglieder (verhindert u.a. Zugriff auf api_key_encrypted).
-- Status der KI liefern nur Edge Functions (Service Role).

-- ---------------------------------------------------------------------------
-- document_chunks (RAG)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.pdf_documents(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES public.pdf_pages(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  chunk_text text NOT NULL DEFAULT '',
  embedding vector(768) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_tenant_doc
  ON public.document_chunks(tenant_id, document_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
  ON public.document_chunks
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_tenant_id_trg
  BEFORE INSERT ON public.document_chunks
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_default();

CREATE POLICY tenant_isolation ON public.document_chunks
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_access_tenant_or_global(auth.uid(), tenant_id))
  WITH CHECK (public.can_access_tenant_or_global(auth.uid(), tenant_id));

-- Kein direkter Client-Zugriff auf Chunks (nur Service Role / Edge Functions)
CREATE POLICY document_chunks_deny_authenticated ON public.document_chunks
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- extracted_fields (NER / strukturierte Extraktion)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.extracted_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.pdf_documents(id) ON DELETE CASCADE,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extracted_fields_tenant_doc
  ON public.extracted_fields(tenant_id, document_id);

ALTER TABLE public.extracted_fields ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_extracted_fields_updated
  BEFORE UPDATE ON public.extracted_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_tenant_id_trg
  BEFORE INSERT ON public.extracted_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_default();

CREATE POLICY tenant_isolation ON public.extracted_fields
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_access_tenant_or_global(auth.uid(), tenant_id))
  WITH CHECK (public.can_access_tenant_or_global(auth.uid(), tenant_id));

CREATE POLICY extracted_fields_select ON public.extracted_fields
  FOR SELECT TO authenticated
  USING (public.user_in_tenant(auth.uid(), tenant_id));

CREATE POLICY extracted_fields_insert ON public.extracted_fields
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_in_tenant(auth.uid(), tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.pdf_documents d
      WHERE d.id = document_id
        AND d.tenant_id = extracted_fields.tenant_id
        AND (d.owner_id = auth.uid() OR public.can_edit(auth.uid()))
    )
  );

CREATE POLICY extracted_fields_update ON public.extracted_fields
  FOR UPDATE TO authenticated
  USING (public.user_in_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.user_in_tenant(auth.uid(), tenant_id));

CREATE POLICY extracted_fields_delete ON public.extracted_fields
  FOR DELETE TO authenticated
  USING (
    public.user_in_tenant(auth.uid(), tenant_id)
    AND EXISTS (
      SELECT 1 FROM public.pdf_documents d
      WHERE d.id = document_id
        AND d.tenant_id = extracted_fields.tenant_id
        AND (d.owner_id = auth.uid() OR public.can_edit(auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- Vektor-Suche (nur Service Role – Aufruf aus Edge Functions)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_chunks_for_rag(
  query_embedding text,
  match_tenant uuid,
  filter_document uuid,
  match_count integer DEFAULT 8
)
RETURNS TABLE(chunk_text text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dc.chunk_text
  FROM public.document_chunks dc
  WHERE dc.tenant_id = match_tenant
    AND dc.document_id = filter_document
  ORDER BY dc.embedding <=> (query_embedding::vector(768))
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding text,
  match_tenant uuid,
  exclude_document uuid,
  match_count integer DEFAULT 12
)
RETURNS TABLE(document_id uuid, document_name text, score double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sub.document_id,
         max(d.name)::text AS document_name,
         max(1 - (sub.embedding <=> (query_embedding::vector(768))))::double precision AS score
  FROM public.document_chunks sub
  JOIN public.pdf_documents d ON d.id = sub.document_id AND d.tenant_id = match_tenant
  WHERE sub.tenant_id = match_tenant
    AND sub.document_id <> exclude_document
  GROUP BY sub.document_id
  ORDER BY max(1 - (sub.embedding <=> (query_embedding::vector(768)))) DESC
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_chunks_for_rag(text, uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_document_chunks(text, uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_chunks_for_rag(text, uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(text, uuid, uuid, integer) TO service_role;
