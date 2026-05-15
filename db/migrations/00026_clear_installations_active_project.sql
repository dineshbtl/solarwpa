-- =============================================================================
-- ONE-TIME RESET: remove all installation rows for the active SolarEPC project.
-- Project id must match app constant ACTIVE_PROJECT_ID (lib/data/active-project.ts).
--
-- Data hygiene (survey ↔ installer mismatch):
-- The installer UI lists every survey where surveys.installer_id = that profile.
-- If an installer sees "extra" households, use Assignments → Survey → installer
-- and filter by that installer, or set installer_id to NULL on surveys that should
-- not be linked. This migration does NOT change surveys.installer_id.
--
-- Cascades: inspections rows reference installations with ON DELETE CASCADE.
-- Other refs: installed_ref_id on reallocation uses ON DELETE SET NULL.
-- =============================================================================

DELETE FROM public.installations
WHERE project_id = 'PROJ-001';
