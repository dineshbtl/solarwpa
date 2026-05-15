-- Hybrid role model updates:
-- - Add installer hierarchy roles to app_role enum
-- - Align role_permissions role CHECK with full active role list

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'store_manager' AND enumtypid = 'app_role'::regtype) THEN
    ALTER TYPE app_role ADD VALUE 'store_manager';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'supervisor' AND enumtypid = 'app_role'::regtype) THEN
    ALTER TYPE app_role ADD VALUE 'supervisor';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'installer' AND enumtypid = 'app_role'::regtype) THEN
    ALTER TYPE app_role ADD VALUE 'installer';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'role_permissions'
      AND constraint_name = 'role_permissions_role_check'
  ) THEN
    ALTER TABLE public.role_permissions DROP CONSTRAINT role_permissions_role_check;
  END IF;
END $$;

ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_role_check
  CHECK (
    role IN (
      'admin',
      'manager',
      'store_manager',
      'supervisor',
      'engineer',
      'installer',
      'surveyor',
      'government',
      'state_store_officer',
      'district_store_incharge',
      'village_supervisor'
    )
  );
