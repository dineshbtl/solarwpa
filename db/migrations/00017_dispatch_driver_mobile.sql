-- Add driver mobile number to dispatch challans
ALTER TABLE public.material_dispatch
ADD COLUMN IF NOT EXISTS driver_mobile TEXT;
