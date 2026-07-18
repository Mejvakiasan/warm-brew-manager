ALTER TABLE public.grocery_items
ADD COLUMN IF NOT EXISTS skipped boolean NOT NULL DEFAULT false;

ALTER TABLE public.grocery_lists
ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;