-- RLS and Auth: enable Row Level Security and link auth.users to profiles

-- Enable RLS on all app tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's profile id (if any) via auth_user_id
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS TEXT AS $$
  SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Policies: allow service_role full access (for server-side)
-- Authenticated users: read/write based on role (simplified: authenticated can read all, insert/update/delete own or by role later)
-- For now: authenticated users can do everything (you can tighten per-table later)

CREATE POLICY "Authenticated read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Authenticated update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth_user_id = auth.uid());

CREATE POLICY "Service role full profiles" ON public.profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Projects: authenticated can full CRUD (restrict by role in app or add policies later)
CREATE POLICY "Authenticated projects" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role projects" ON public.projects FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Surveys
CREATE POLICY "Authenticated surveys" ON public.surveys FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role surveys" ON public.surveys FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Installations
CREATE POLICY "Authenticated installations" ON public.installations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role installations" ON public.installations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Inspections
CREATE POLICY "Authenticated inspections" ON public.inspections FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role inspections" ON public.inspections FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigger: on signup, create a profile row linked to auth.users (id = display id like USR-xxx, auth_user_id = auth.users.id)
-- We generate profile id as next USR-XXX; profile must be created by app when admin creates user, or we create minimal profile on first sign in.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  next_id TEXT;
  n INT;
BEGIN
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(id, '^USR-', ''), '')::INT
  ), 0) + 1 INTO n FROM public.profiles WHERE id ~ '^USR-[0-9]+$';
  next_id := 'USR-' || lpad(n::TEXT, 3, '0');

  INSERT INTO public.profiles (id, auth_user_id, name, email, role)
  VALUES (
    next_id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'surveyor'
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run only if auth.users exists (Supabase)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
