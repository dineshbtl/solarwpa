/**
 * Unified data layer and hooks for Solar EPC.
 * Use these instead of @/lib/store/* so the app works with Supabase when configured.
 */
export * from './projects'
export * from './users'
export * from './surveys'
export * from './installations'
export * from './inspections'

export {
  useProjects,
  useProject,
  useUsers,
  useUser,
  useSurveys,
  useSurveysLazy,
  useSurvey,
  useInstallations,
  useInstallation,
  useInspections,
  useInspection,
  useInspectionByInstallationId,
} from './hooks'
