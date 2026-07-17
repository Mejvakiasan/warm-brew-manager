
-- Helper: check caller is a provisioned staff member
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = _user_id)
$$;

-- Replace permissive USING(true)/WITH CHECK(true) FOR ALL policies
DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOR t, pol IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname='public' AND qual='true' AND with_check='true' AND cmd='ALL'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol, t);
  END LOOP;
END $$;

-- Recreate as staff-scoped, split select from writes
CREATE POLICY "Staff read accounts" ON public.accounts FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff write accounts" ON public.accounts FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update accounts" ON public.accounts FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete accounts" ON public.accounts FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff read customers" ON public.customers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff write customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update customers" ON public.customers FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete customers" ON public.customers FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff read transactions" ON public.transactions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff write transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update transactions" ON public.transactions FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete transactions" ON public.transactions FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff read payments" ON public.payments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff write payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update payments" ON public.payments FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete payments" ON public.payments FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff read stock" ON public.stock FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff write stock" ON public.stock FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update stock" ON public.stock FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete stock" ON public.stock FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff read grocery_lists" ON public.grocery_lists FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff write grocery_lists" ON public.grocery_lists FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update grocery_lists" ON public.grocery_lists FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete grocery_lists" ON public.grocery_lists FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff read grocery_items" ON public.grocery_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff write grocery_items" ON public.grocery_items FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update grocery_items" ON public.grocery_items FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete grocery_items" ON public.grocery_items FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));
