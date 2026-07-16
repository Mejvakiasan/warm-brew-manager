
-- Roles enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role (security definer, avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- user_roles policies
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- app_settings policies: signed-in read, admin update
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Auth can modify app settings" ON public.app_settings;

CREATE POLICY "Authenticated read app settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins update app settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- users table: admins can see all users (for Manage Users)
DROP POLICY IF EXISTS "Admins view all users" ON public.users;
CREATE POLICY "Admins view all users" ON public.users
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Set the setup key for first-admin bootstrap
UPDATE public.app_settings SET setup_key = 'divakar-tea-2026-secure';
