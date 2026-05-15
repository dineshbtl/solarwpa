-- Add assigned_locations column to profiles for location-based installer scoping
-- Installers can only see/create installations in their assigned districts

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS assigned_locations text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_profiles_assigned_locations
ON public.profiles USING GIN (assigned_locations);

COMMENT ON COLUMN public.profiles.assigned_locations IS 'Array of district names the installer is assigned to. Used to scope installations list and creation.';
