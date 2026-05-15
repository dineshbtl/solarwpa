-- ═══════════════════════════════════════════════════════════════
-- Migration 00014: Material master table for dynamic materials
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.material_master (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  per_hh NUMERIC(12,2) NOT NULL CHECK (per_hh > 0),
  unit TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.material_master (id, name, per_hh, unit, is_active)
VALUES
  ('MAT-001', 'Solar PV Module', 4, 'Nos', true),
  ('MAT-002', 'Inverter', 1, 'Nos', true),
  ('MAT-003', 'Mounting Structure', 1, 'Sets', true),
  ('MAT-004', 'Earthing Kit', 2, 'Nos', true),
  ('MAT-005', 'DC Cable 4.0 Sqmm Black', 1, 'Sets', true),
  ('MAT-006', 'AC Cable Red', 1, 'Sets', true),
  ('MAT-007', 'Conduit Kit', 1, 'Sets', true),
  ('MAT-008', 'ACDB Box & DCDB Box', 1, 'Nos', true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.material_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated material_master" ON public.material_master;
CREATE POLICY "Authenticated material_master" ON public.material_master
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role material_master" ON public.material_master;
CREATE POLICY "Service role material_master" ON public.material_master
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS material_master_updated_at ON public.material_master;
CREATE TRIGGER material_master_updated_at BEFORE UPDATE ON public.material_master
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
