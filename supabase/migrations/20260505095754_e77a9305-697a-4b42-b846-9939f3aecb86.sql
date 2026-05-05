
-- Site settings (singleton row)
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.site_settings (booking_enabled) VALUES (true);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings" ON public.site_settings
  FOR SELECT USING (true);
CREATE POLICY "Admins can update settings" ON public.site_settings
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert settings" ON public.site_settings
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

-- Availability rules: weekday + time range
CREATE TABLE public.availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_minutes integer NOT NULL DEFAULT 30,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view availability" ON public.availability_slots
  FOR SELECT USING (active = true);
CREATE POLICY "Admins manage availability" ON public.availability_slots
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Appointments / bookings
CREATE TYPE public.appointment_status AS ENUM ('pending','confirmed','cancelled');

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  salutation text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  note text,
  status public.appointment_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_date, appointment_time)
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Anyone (public) can request a booking
CREATE POLICY "Anyone can create appointment" ON public.appointments
  FOR INSERT WITH CHECK (true);
-- Public can read only date+time to know taken slots (admins see all)
CREATE POLICY "Admins view appointments" ON public.appointments
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update appointments" ON public.appointments
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete appointments" ON public.appointments
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

-- Public RPC to fetch only taken date/time pairs
CREATE OR REPLACE FUNCTION public.get_taken_slots(_from date, _to date)
RETURNS TABLE(appointment_date date, appointment_time time)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT appointment_date, appointment_time
  FROM public.appointments
  WHERE appointment_date BETWEEN _from AND _to
    AND status <> 'cancelled';
$$;

CREATE TRIGGER set_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
