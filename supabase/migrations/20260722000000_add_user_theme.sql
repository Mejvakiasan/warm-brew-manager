ALTER TABLE public.users
  ADD COLUMN theme TEXT NOT NULL DEFAULT 'light'
  CHECK (theme IN ('light', 'dark'));