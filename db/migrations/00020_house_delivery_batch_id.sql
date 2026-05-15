-- Group multi-item allocations created in one action
ALTER TABLE public.house_material_delivery
ADD COLUMN IF NOT EXISTS allocation_batch_id TEXT;

CREATE INDEX IF NOT EXISTS idx_house_material_delivery_batch
  ON public.house_material_delivery (allocation_batch_id, created_at DESC);
