-- Solar EPC – full schema for self-hosted Supabase
-- Run this against your Supabase Postgres (e.g. via Studio SQL or: psql $DATABASE_URL -f 00001_solar_epc_schema.sql)

-- Roles enum (matches app RBAC)
CREATE TYPE app_role AS ENUM ('admin', 'manager', 'engineer', 'surveyor', 'government');
CREATE TYPE user_status AS ENUM ('active', 'inactive');

-- Profiles: app users, linked to auth.users when they sign in
CREATE TABLE public.profiles (
  id TEXT PRIMARY KEY,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role app_role NOT NULL DEFAULT 'surveyor',
  status user_status NOT NULL DEFAULT 'active',
  phone TEXT,
  aadhar_no TEXT,
  city TEXT,
  state TEXT,
  district TEXT,
  full_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_auth_user_id ON public.profiles(auth_user_id);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Projects
CREATE TABLE public.projects (
  id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  description TEXT,
  state TEXT,
  city TEXT,
  district TEXT,
  pincode TEXT,
  address TEXT,
  additional_info TEXT,
  assignments JSONB NOT NULL DEFAULT '{}',  -- { managerId?, surveyorId? }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_created_at ON public.projects(created_at DESC);

-- Surveys
CREATE TYPE survey_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
CREATE TYPE discom_name AS ENUM ('APSPDCL', 'APCPDCL', 'APEPDCL');
CREATE TYPE total_roofs AS ENUM ('G', 'G+1', 'G+2', 'G+3');
CREATE TYPE roof_type AS ENUM ('RCC', 'Metal Shed', 'Cement Shed', 'Ground Mount');

CREATE TABLE public.surveys (
  id TEXT PRIMARY KEY,
  beneficiary_name TEXT NOT NULL,
  service_no TEXT NOT NULL,
  aadhar_no TEXT NOT NULL,
  mobile TEXT,
  pan_no TEXT NOT NULL,
  contracted_load NUMERIC,
  status survey_status NOT NULL DEFAULT 'pending',
  upload_date TIMESTAMPTZ NOT NULL,
  approved_date TIMESTAMPTZ,
  submitted_by_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  installer_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  discom_name discom_name NOT NULL,
  plant_type TEXT NOT NULL DEFAULT 'On Grid',
  building_height NUMERIC NOT NULL DEFAULT 0,
  total_roofs total_roofs NOT NULL,
  roof_type roof_type NOT NULL,
  site_details JSONB,   -- { gpsLat?, gpsLng?, accuracyMeters?, capturedAt? }
  site_location JSONB NOT NULL,  -- { section?, subDivision?, ..., district, pinCode, ... }
  bank_details JSONB NOT NULL,   -- { bankName, accountNo, ifsc, branch? }
  uploads JSONB NOT NULL DEFAULT '{}',  -- partial record of file meta
  activity JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_surveys_status ON public.surveys(status);
CREATE INDEX idx_surveys_submitted_by ON public.surveys(submitted_by_id);
CREATE INDEX idx_surveys_installer ON public.surveys(installer_id);
CREATE INDEX idx_surveys_created_at ON public.surveys(created_at DESC);

-- Installations
CREATE TYPE installation_status AS ENUM ('pending', 'in_progress', 'completed', 'inspection_pending');

CREATE TABLE public.installations (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
  survey_id TEXT REFERENCES public.surveys(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  address TEXT NOT NULL,
  engineer_name TEXT,
  engineer_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  status installation_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  materials JSONB NOT NULL DEFAULT '[]',  -- [{ id, name, serialNumber, barcode, scannedAt? }]
  photos JSONB NOT NULL DEFAULT '[]',     -- [{ id, category, description, file?, uploadedAt? }]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_installations_project ON public.installations(project_id);
CREATE INDEX idx_installations_survey ON public.installations(survey_id);
CREATE INDEX idx_installations_status ON public.installations(status);
CREATE INDEX idx_installations_created_at ON public.installations(created_at DESC);

-- Inspections
CREATE TYPE inspection_status AS ENUM ('pending', 'approved', 'rejected', 'reopened');

CREATE TABLE public.inspections (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES public.installations(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
  survey_id TEXT REFERENCES public.surveys(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  address TEXT NOT NULL,
  status inspection_status NOT NULL DEFAULT 'pending',
  inspector_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  manager_approval JSONB NOT NULL DEFAULT '{"approved": false, "remarks": ""}',  -- { approved, remarks, approvedAt?, approvedBy? }
  government_inspection JSONB,  -- { approved, remarks, inspectedAt?, inspectorName? }
  activity JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inspections_installation ON public.inspections(installation_id);
CREATE INDEX idx_inspections_status ON public.inspections(status);
CREATE INDEX idx_inspections_inspector ON public.inspections(inspector_id);
CREATE INDEX idx_inspections_created_at ON public.inspections(created_at DESC);

-- Trigger: update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER surveys_updated_at BEFORE UPDATE ON public.surveys FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER installations_updated_at BEFORE UPDATE ON public.installations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER inspections_updated_at BEFORE UPDATE ON public.inspections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
