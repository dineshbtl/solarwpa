-- Make optional app fields nullable in surveys table
-- PAN No, building height, and bank details can be omitted

ALTER TABLE public.surveys
  ALTER COLUMN pan_no DROP NOT NULL;

ALTER TABLE public.surveys
  ALTER COLUMN building_height DROP NOT NULL;

ALTER TABLE public.surveys
  ALTER COLUMN bank_details DROP NOT NULL;

-- Optional: allow bank_details to default to empty object when null not provided
ALTER TABLE public.surveys
  ALTER COLUMN bank_details SET DEFAULT '{}';

COMMENT ON COLUMN public.surveys.pan_no IS 'PAN number (optional).';
COMMENT ON COLUMN public.surveys.building_height IS 'Building height (optional).';
COMMENT ON COLUMN public.surveys.bank_details IS 'Bank details JSON (optional).';
