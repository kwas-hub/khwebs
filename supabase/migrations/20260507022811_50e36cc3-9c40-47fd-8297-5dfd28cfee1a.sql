
-- ============================================
-- 1) Erweiterte Rollen
-- ============================================
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'editor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'guest';
