-- ═══════════════════════════════════════════════════════════════
-- Migration 00027: Inventory barcode flags, maintenance warehouse, supplier RMA
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.material_master
  ADD COLUMN IF NOT EXISTS requires_barcode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS track_serial BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.material_master.requires_barcode IS 'When true, each inward line with serials must include matching barcodes for wedge-scan audit.';
COMMENT ON COLUMN public.material_master.track_serial IS 'When false, quantity-only lines without per-serial validation.';

UPDATE public.material_master SET requires_barcode = true WHERE name IN ('Solar PV Module', 'Inverter');

ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS stock_category TEXT NOT NULL DEFAULT 'distribution';

ALTER TABLE public.warehouses DROP CONSTRAINT IF EXISTS warehouses_stock_category_check;
ALTER TABLE public.warehouses ADD CONSTRAINT warehouses_stock_category_check
  CHECK (stock_category IN ('distribution', 'maintenance'));

INSERT INTO public.warehouses (id, name, warehouse_type, location, stock_category)
VALUES (
  'WH-MNT-001',
  'Field Maintenance & Spares (O&M)',
  'district',
  'Kurnool — service truck / spares pool',
  'maintenance'
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.supplier_material_returns (
  id TEXT PRIMARY KEY,
  from_warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL,
  po_number TEXT NOT NULL,
  supplier_name TEXT,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_material_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated supplier_material_returns" ON public.supplier_material_returns;
CREATE POLICY "Authenticated supplier_material_returns" ON public.supplier_material_returns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role supplier_material_returns" ON public.supplier_material_returns;
CREATE POLICY "Service role supplier_material_returns" ON public.supplier_material_returns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS supplier_material_returns_updated_at ON public.supplier_material_returns;
CREATE TRIGGER supplier_material_returns_updated_at BEFORE UPDATE ON public.supplier_material_returns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
