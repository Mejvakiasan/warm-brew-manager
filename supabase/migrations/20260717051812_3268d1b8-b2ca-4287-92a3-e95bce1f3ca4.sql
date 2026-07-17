
REVOKE ALL ON FUNCTION public.recalc_customer_balance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_transactions_balance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_payments_balance() FROM PUBLIC, anon, authenticated;
