
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname='public'
      AND policyname LIKE 'Staff %'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.is_staff(uuid);

-- Recreate with inline EXISTS check (RLS on users table lets caller see their own row)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','customers','transactions','payments','stock','grocery_lists','grocery_items']
  LOOP
    EXECUTE format($f$CREATE POLICY "Staff read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()))$f$, t);
    EXECUTE format($f$CREATE POLICY "Staff insert %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()))$f$, t);
    EXECUTE format($f$CREATE POLICY "Staff update %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()))$f$, t);
    EXECUTE format($f$CREATE POLICY "Staff delete %1$s" ON public.%1$I FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()))$f$, t);
  END LOOP;
END $$;
