-- customer_entries table for tracking purchase amounts linked to customers
CREATE TABLE public.customer_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_entries_customer_id ON public.customer_entries(customer_id);
CREATE INDEX idx_customer_entries_date ON public.customer_entries(date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_entries TO authenticated;
GRANT ALL ON public.customer_entries TO service_role;

ALTER TABLE public.customer_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full customer_entries" ON public.customer_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
