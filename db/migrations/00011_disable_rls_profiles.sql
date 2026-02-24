-- Disable RLS on profiles table to allow anon/frontend inserts
-- This follows the same pattern as other app tables (surveys, projects, etc.)

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
