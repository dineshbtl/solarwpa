-- Approval metadata for reassignment requests
ALTER TABLE public.house_material_movement_events
ADD COLUMN IF NOT EXISTS approval_status TEXT,
ADD COLUMN IF NOT EXISTS approved_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS request_payload JSONB,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_house_movement_event_approval_status
  ON public.house_material_movement_events (approval_status, created_at DESC);
