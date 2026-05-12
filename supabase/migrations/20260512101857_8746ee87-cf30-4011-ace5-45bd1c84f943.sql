
-- =========================================================
-- 1. TENANTS
-- =========================================================
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_tenants (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX idx_user_tenants_user ON public.user_tenants(user_id);
CREATE INDEX idx_user_tenants_tenant ON public.user_tenants(tenant_id);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 2. HELPER FUNCTIONS (SECURITY DEFINER, no recursion)
-- =========================================================
CREATE OR REPLACE FUNCTION public.user_in_tenant(_uid uuid, _tid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tenants WHERE user_id = _uid AND tenant_id = _tid
  )
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_uid uuid, _tid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id = _uid AND tenant_id = _tid AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.default_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.tenants WHERE slug = 'kh-webs' LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.user_tenants
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1
$$;

-- =========================================================
-- 3. CREATE DEFAULT TENANT + ASSIGN EXISTING USERS
-- =========================================================
INSERT INTO public.tenants (name, slug)
VALUES ('KH Webs', 'kh-webs')
ON CONFLICT (slug) DO NOTHING;

-- Assign every existing user as member; admins get tenant 'admin' role
INSERT INTO public.user_tenants (user_id, tenant_id, role)
SELECT u.id, public.default_tenant_id(),
       CASE WHEN public.has_role(u.id, 'admin') THEN 'admin' ELSE 'member' END
FROM auth.users u
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- =========================================================
-- 4. RLS for tenants / user_tenants
-- =========================================================
CREATE POLICY "Members view own tenants" ON public.tenants
FOR SELECT TO authenticated
USING (public.user_in_tenant(auth.uid(), id));

CREATE POLICY "Tenant admins update tenant" ON public.tenants
FOR UPDATE TO authenticated
USING (public.is_tenant_admin(auth.uid(), id));

CREATE POLICY "Global admins manage tenants" ON public.tenants
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users see their memberships" ON public.user_tenants
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins manage memberships" ON public.user_tenants
FOR ALL TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 5. ADD tenant_id TO ALL DOMAIN TABLES + BACKFILL
-- =========================================================
DO $$
DECLARE
  t TEXT;
  default_tid UUID := public.default_tenant_id();
  tables TEXT[] := ARRAY[
    'pdf_documents','pdf_pages','document_types','document_type_keywords',
    'appointments','external_calendars','availability_slots',
    'content_blocks','forms','form_fields','form_submissions',
    'email_templates','site_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL', t, default_tid);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT public.default_tenant_id()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant ON public.%I(tenant_id)', t, t);
  END LOOP;
END $$;

-- =========================================================
-- 6. AUTO-FILL TRIGGER + RESTRICTIVE TENANT-ISOLATION POLICY
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_tenant_id_default()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    IF auth.uid() IS NOT NULL THEN
      SELECT tenant_id INTO NEW.tenant_id
      FROM public.user_tenants
      WHERE user_id = auth.uid()
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;
    IF NEW.tenant_id IS NULL THEN
      NEW.tenant_id := public.default_tenant_id();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'pdf_documents','pdf_pages','document_types','document_type_keywords',
    'appointments','external_calendars','availability_slots',
    'content_blocks','forms','form_fields','form_submissions',
    'email_templates','site_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_tenant_id_trg ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_tenant_id_trg BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_default()', t);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.user_in_tenant(auth.uid(), tenant_id)) WITH CHECK (public.user_in_tenant(auth.uid(), tenant_id))',
      t
    );
  END LOOP;
END $$;

-- =========================================================
-- 7. NEW TABLE: api_endpoints
-- =========================================================
CREATE TABLE public.api_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE DEFAULT public.default_tenant_id(),
  resource TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT false,
  target_url TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'bearer',
  api_key TEXT,
  auth_username TEXT,
  auth_password TEXT,
  auto_export BOOLEAN NOT NULL DEFAULT false,
  filter_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_endpoints_tenant ON public.api_endpoints(tenant_id);
CREATE INDEX idx_api_endpoints_resource ON public.api_endpoints(tenant_id, resource);

ALTER TABLE public.api_endpoints ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_tenant_id_trg BEFORE INSERT ON public.api_endpoints
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_default();

CREATE TRIGGER update_api_endpoints_updated_at BEFORE UPDATE ON public.api_endpoints
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Tenant admins manage endpoints" ON public.api_endpoints
FOR ALL TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Tenant members view endpoints" ON public.api_endpoints
FOR SELECT TO authenticated
USING (public.user_in_tenant(auth.uid(), tenant_id));

CREATE POLICY tenant_isolation ON public.api_endpoints AS RESTRICTIVE FOR ALL TO authenticated
USING (public.user_in_tenant(auth.uid(), tenant_id))
WITH CHECK (public.user_in_tenant(auth.uid(), tenant_id));

-- =========================================================
-- 8. NEW TABLE: export_queue
-- =========================================================
CREATE TABLE public.export_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE DEFAULT public.default_tenant_id(),
  resource TEXT NOT NULL,
  record_id UUID NOT NULL,
  endpoint_id UUID NOT NULL REFERENCES public.api_endpoints(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  response_status INT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ
);

CREATE INDEX idx_export_queue_tenant ON public.export_queue(tenant_id);
CREATE INDEX idx_export_queue_status ON public.export_queue(status);

ALTER TABLE public.export_queue ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_tenant_id_trg BEFORE INSERT ON public.export_queue
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_default();

CREATE POLICY "Tenant members view queue" ON public.export_queue
FOR SELECT TO authenticated
USING (public.user_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Editors insert queue" ON public.export_queue
FOR INSERT TO authenticated
WITH CHECK (public.user_in_tenant(auth.uid(), tenant_id) AND public.can_edit(auth.uid()));

CREATE POLICY "Tenant admins update queue" ON public.export_queue
FOR UPDATE TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Tenant admins delete queue" ON public.export_queue
FOR DELETE TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY tenant_isolation ON public.export_queue AS RESTRICTIVE FOR ALL TO authenticated
USING (public.user_in_tenant(auth.uid(), tenant_id))
WITH CHECK (public.user_in_tenant(auth.uid(), tenant_id));

-- =========================================================
-- 9. UPDATE handle_new_user TO ASSIGN DEFAULT TENANT
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  default_tid UUID;
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name, status)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'display_name', 'new');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'guest');

  -- Auto-assign to default tenant so they have a home
  default_tid := public.default_tenant_id();
  IF default_tid IS NOT NULL THEN
    INSERT INTO public.user_tenants (user_id, tenant_id, role)
    VALUES (new.id, default_tid, 'member')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN new;
END $$;
