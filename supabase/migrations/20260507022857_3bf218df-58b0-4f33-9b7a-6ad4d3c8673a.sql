
-- ============================================
-- 2) Profile mit User-Status
-- ============================================
CREATE TYPE public.user_status AS ENUM ('new', 'active', 'blocked');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text,
  display_name text,
  status public.user_status NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-Profil + Rolle bei Signup. Erster User -> admin/active, andere -> guest/new
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first boolean;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO is_first;

  INSERT INTO public.profiles (user_id, email, display_name, status)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
          CASE WHEN is_first THEN 'active'::public.user_status ELSE 'new'::public.user_status END);

  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'guest');
  END IF;

  RETURN NEW;
END;
$$;

-- alter trigger entfernen, neuen setzen
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 3) Helper-Funktion: hat irgendeine Backend-Rolle (admin/editor/guest)
-- ============================================
CREATE OR REPLACE FUNCTION public.has_any_backend_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'editor', 'guest')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_edit(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'editor')
  )
$$;

-- ============================================
-- 4) Termine: Erweiterungen
-- ============================================
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS end_time time without time zone,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'request', -- 'request' | 'manual'
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#0ea5b7',
  ADD COLUMN IF NOT EXISTS public_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- alte SELECT-Policy ersetzen: Editor sieht alles, Gast nur public_visible
DROP POLICY IF EXISTS "Admins view appointments" ON public.appointments;
CREATE POLICY "Admins/Editors view all appointments" ON public.appointments
  FOR SELECT TO authenticated USING (public.can_edit(auth.uid()));
CREATE POLICY "Guests view public appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'guest') AND public_visible = true);

-- update/delete: nur admin & editor
DROP POLICY IF EXISTS "Admins update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admins delete appointments" ON public.appointments;
CREATE POLICY "Editors update appointments" ON public.appointments
  FOR UPDATE TO authenticated USING (public.can_edit(auth.uid()));
CREATE POLICY "Editors delete appointments" ON public.appointments
  FOR DELETE TO authenticated USING (public.can_edit(auth.uid()));
CREATE POLICY "Editors insert appointments" ON public.appointments
  FOR INSERT TO authenticated WITH CHECK (public.can_edit(auth.uid()));

-- ============================================
-- 5) Externe Kalender (ICS-URLs)
-- ============================================
CREATE TABLE public.external_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  color text NOT NULL DEFAULT '#7c3aed',
  active boolean NOT NULL DEFAULT true,
  public_visible boolean NOT NULL DEFAULT false,
  assigned_user_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.external_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors manage external calendars" ON public.external_calendars
  FOR ALL TO authenticated
  USING (public.can_edit(auth.uid()))
  WITH CHECK (public.can_edit(auth.uid()));
CREATE POLICY "Guests view public external calendars" ON public.external_calendars
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'guest') AND active = true AND public_visible = true);

CREATE TRIGGER trg_extcal_updated_at
  BEFORE UPDATE ON public.external_calendars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 6) E-Mail-Vorlagen: pro Trigger
--    trigger_key z.B. 'appointment_confirmed', 'appointment_cancelled', 'form_<formId>_confirmed', 'form_<formId>_cancelled'
-- ============================================
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_key text NOT NULL UNIQUE,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  is_html boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors view email templates" ON public.email_templates
  FOR SELECT TO authenticated USING (public.can_edit(auth.uid()));

CREATE TRIGGER trg_emailtpl_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 7) Formulare: Status, Notiz, Anhang
-- ============================================
CREATE TYPE public.submission_status AS ENUM ('open', 'confirmed', 'cancelled');

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS status public.submission_status NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS internal_note text NOT NULL DEFAULT '';

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view submissions" ON public.form_submissions;
DROP POLICY IF EXISTS "Admins delete submissions" ON public.form_submissions;
CREATE POLICY "Editors view submissions" ON public.form_submissions
  FOR SELECT TO authenticated USING (public.can_edit(auth.uid()));
CREATE POLICY "Editors update submissions" ON public.form_submissions
  FOR UPDATE TO authenticated USING (public.can_edit(auth.uid()));
CREATE POLICY "Editors delete submissions" ON public.form_submissions
  FOR DELETE TO authenticated USING (public.can_edit(auth.uid()));

-- Felder: dropdown wird durch field_type='select' im Code abgebildet (kein Schema-Constraint vorhanden, gut so)
