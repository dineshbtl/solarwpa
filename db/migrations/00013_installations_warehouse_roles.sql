-- ═══════════════════════════════════════════════════════════════
-- Migration 00013: Installation wizard columns + warehouse tables
-- ═══════════════════════════════════════════════════════════════

-- ── New roles ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'state_store_officer' AND enumtypid = 'app_role'::regtype) THEN
    ALTER TYPE app_role ADD VALUE 'state_store_officer';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'district_store_incharge' AND enumtypid = 'app_role'::regtype) THEN
    ALTER TYPE app_role ADD VALUE 'district_store_incharge';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'village_supervisor' AND enumtypid = 'app_role'::regtype) THEN
    ALTER TYPE app_role ADD VALUE 'village_supervisor';
  END IF;
END $$;

-- ── Installation wizard new columns ───────────────────────────
ALTER TABLE public.installations
  ADD COLUMN IF NOT EXISTS visit_type TEXT,
  ADD COLUMN IF NOT EXISTS arrival_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS departure_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS site_accessible BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS site_gps JSONB,
  ADD COLUMN IF NOT EXISTS installation_checklist JSONB,
  ADD COLUMN IF NOT EXISTS commissioning_data JSONB,
  ADD COLUMN IF NOT EXISTS quality_check JSONB,
  ADD COLUMN IF NOT EXISTS fault_report JSONB,
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS declaration_confirmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activity JSONB NOT NULL DEFAULT '[]';

-- ── Warehouses master ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.warehouses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  warehouse_type TEXT NOT NULL DEFAULT 'district',
  location TEXT,
  in_charge_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default warehouses
INSERT INTO public.warehouses (id, name, warehouse_type, location) VALUES
  ('WH-001', 'Hyderabad Central Store', 'state', 'Hyderabad, Telangana'),
  ('WH-002', 'Kurnool Central Warehouse', 'district', 'Kurnool, Andhra Pradesh')
ON CONFLICT (id) DO NOTHING;

-- ── Material Dispatch: State → District ───────────────────────
CREATE TABLE IF NOT EXISTS public.material_dispatch (
  id TEXT PRIMARY KEY,
  from_warehouse_id TEXT REFERENCES public.warehouses(id),
  to_warehouse_id TEXT REFERENCES public.warehouses(id),
  dc_number TEXT NOT NULL UNIQUE,
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_no TEXT,
  driver_name TEXT,
  vehicle_type TEXT,
  from_location TEXT,
  to_location TEXT,
  dispatched_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'dispatched',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Material Receipt ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.material_receipt (
  id TEXT PRIMARY KEY,
  dispatch_id TEXT REFERENCES public.material_dispatch(id),
  received_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_status TEXT NOT NULL,
  items_received JSONB NOT NULL DEFAULT '[]',
  shortage_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Issue to Villages ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.material_issue_village (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
  from_warehouse_id TEXT REFERENCES public.warehouses(id),
  mandal TEXT NOT NULL,
  village_name TEXT NOT NULL,
  households_approved INT NOT NULL DEFAULT 0,
  issue_challan_no TEXT NOT NULL UNIQUE,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Village Allotments ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.village_allotments (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
  mandal TEXT NOT NULL,
  village_name TEXT NOT NULL,
  engineer_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  households_allotted INT DEFAULT 0,
  allotted_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Material Returns ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.material_returns (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
  from_village TEXT,
  to_warehouse_id TEXT REFERENCES public.warehouses(id),
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  return_reason TEXT NOT NULL,
  returned_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS policies for new tables ───────────────────────────────
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_dispatch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_receipt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_issue_village ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.village_allotments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated warehouses" ON public.warehouses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role warehouses" ON public.warehouses FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated material_dispatch" ON public.material_dispatch FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role material_dispatch" ON public.material_dispatch FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated material_receipt" ON public.material_receipt FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role material_receipt" ON public.material_receipt FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated material_issue_village" ON public.material_issue_village FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role material_issue_village" ON public.material_issue_village FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated village_allotments" ON public.village_allotments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role village_allotments" ON public.village_allotments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated material_returns" ON public.material_returns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role material_returns" ON public.material_returns FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Triggers for updated_at ───────────────────────────────────
CREATE TRIGGER material_dispatch_updated_at BEFORE UPDATE ON public.material_dispatch
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
