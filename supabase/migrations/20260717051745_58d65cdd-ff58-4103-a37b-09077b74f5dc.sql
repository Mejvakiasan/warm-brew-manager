
-- Balance auto-update trigger
CREATE OR REPLACE FUNCTION public.recalc_customer_balance(_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _customer_id IS NULL THEN RETURN; END IF;
  UPDATE public.customers c
  SET balance = COALESCE((SELECT SUM(amount) FROM public.transactions WHERE customer_id = _customer_id), 0)
              - COALESCE((SELECT SUM(amount_paid) FROM public.payments WHERE customer_id = _customer_id), 0)
  WHERE c.id = _customer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_transactions_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_customer_balance(OLD.customer_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalc_customer_balance(NEW.customer_id);
  IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
    PERFORM public.recalc_customer_balance(OLD.customer_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_payments_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_customer_balance(OLD.customer_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalc_customer_balance(NEW.customer_id);
  IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
    PERFORM public.recalc_customer_balance(OLD.customer_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_balance_trg ON public.transactions;
CREATE TRIGGER transactions_balance_trg
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_transactions_balance();

DROP TRIGGER IF EXISTS payments_balance_trg ON public.payments;
CREATE TRIGGER payments_balance_trg
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.tg_payments_balance();

-- Tighten policies: only admins can UPDATE/DELETE customers, transactions, payments
DROP POLICY IF EXISTS "Staff update customers" ON public.customers;
DROP POLICY IF EXISTS "Staff delete customers" ON public.customers;
CREATE POLICY "Admins update customers" ON public.customers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete customers" ON public.customers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Staff update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Staff delete transactions" ON public.transactions;
CREATE POLICY "Admins update transactions" ON public.transactions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete transactions" ON public.transactions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Staff update payments" ON public.payments;
DROP POLICY IF EXISTS "Staff delete payments" ON public.payments;
CREATE POLICY "Admins update payments" ON public.payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete payments" ON public.payments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Backfill balances
UPDATE public.customers c SET balance =
  COALESCE((SELECT SUM(amount) FROM public.transactions WHERE customer_id = c.id), 0)
  - COALESCE((SELECT SUM(amount_paid) FROM public.payments WHERE customer_id = c.id), 0);
