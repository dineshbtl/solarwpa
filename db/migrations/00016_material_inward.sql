-- ═══════════════════════════════════════════════════════════════
-- Migration 00016: Warehouse inward entries with serial imports
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.material_inward (
  id TEXT PRIMARY KEY,
  warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL,
  inward_date DATE NOT NULL DEFAULT CURRENT_DATE,
  po_number TEXT NOT NULL,
  ref_no TEXT,
  supplier_name TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  photo_url TEXT,
  photo_gps JSONB,
  notes TEXT,
  created_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.material_inward ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated material_inward" ON public.material_inward;
CREATE POLICY "Authenticated material_inward" ON public.material_inward
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role material_inward" ON public.material_inward;
CREATE POLICY "Service role material_inward" ON public.material_inward
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS material_inward_updated_at ON public.material_inward;
CREATE TRIGGER material_inward_updated_at BEFORE UPDATE ON public.material_inward
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
