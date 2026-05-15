-- House material delivery + reallocation ledger

CREATE TABLE IF NOT EXISTS public.house_material_delivery (
  id TEXT PRIMARY KEY,
  dispatch_id TEXT REFERENCES public.material_dispatch(id) ON DELETE SET NULL,
  from_entity_type TEXT NOT NULL DEFAULT 'warehouse',
  from_entity_id TEXT,
  to_household_id TEXT NOT NULL,
  material_name TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  serial_nos JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'allocated',
  proof_photo_url TEXT,
  proof_photo_gps JSONB,
  delivered_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  installed_ref_id TEXT REFERENCES public.installations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.house_material_movement_events (
  id TEXT PRIMARY KEY,
  delivery_id TEXT REFERENCES public.house_material_delivery(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_household_id TEXT,
  to_household_id TEXT,
  material_name TEXT NOT NULL,
  serial_nos JSONB NOT NULL DEFAULT '[]',
  qty NUMERIC NOT NULL DEFAULT 0,
  proof_photo_url TEXT,
  proof_photo_gps JSONB,
  notes TEXT,
  actor_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_house_material_delivery_household
  ON public.house_material_delivery (to_household_id, material_name, status);

CREATE INDEX IF NOT EXISTS idx_house_material_movement_events_delivery
  ON public.house_material_movement_events (delivery_id, created_at DESC);

ALTER TABLE public.house_material_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_material_movement_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated house_material_delivery" ON public.house_material_delivery;
CREATE POLICY "Authenticated house_material_delivery"
  ON public.house_material_delivery FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role house_material_delivery" ON public.house_material_delivery;
CREATE POLICY "Service role house_material_delivery"
  ON public.house_material_delivery FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated house_material_movement_events" ON public.house_material_movement_events;
CREATE POLICY "Authenticated house_material_movement_events"
  ON public.house_material_movement_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role house_material_movement_events" ON public.house_material_movement_events;
CREATE POLICY "Service role house_material_movement_events"
  ON public.house_material_movement_events FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS house_material_delivery_updated_at ON public.house_material_delivery;
CREATE TRIGGER house_material_delivery_updated_at BEFORE UPDATE ON public.house_material_delivery
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
