/**
 * Dashboard KPIs and recent rows from Supabase only.
 */
import { assertSupabaseConfigured } from '@/lib/supabase/config'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { ACTIVE_PROJECT_ID } from '@/lib/data/active-project'
import type { Survey } from './surveys'
import type { Installation } from './installations'
import type { Inspection } from './inspections'

export type DashboardData = {
  totalProjects: number
  totalSurveys: number
  pendingSurveys: number
  feasibleSurveys: number
  notFeasibleSurveys: number
  pendingAssessment: number
  activeInstallations: number
  completedThisMonth: number
  recentSurveys: Survey[]
  recentInstallations: Installation[]
  pendingInspections: Inspection[]
}

export async function fetchDashboardData(): Promise<DashboardData> {
  assertSupabaseConfigured()

  const supabase = getSupabaseBrowserClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const pid = ACTIVE_PROJECT_ID
  const [
    projectsCount,
    surveysTotal,
    surveysPending,
    surveysFeasible,
    surveysNotFeasible,
    activeInstalls,
    completedMonth,
    recentSurveys,
    recentInstallations,
    pendingInspections,
  ] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('id', pid),
    supabase.from('surveys').select('*', { count: 'exact', head: true }).eq('project_id', pid),
    supabase.from('surveys').select('*', { count: 'exact', head: true }).eq('project_id', pid).eq('status', 'pending'),
    supabase
      .from('surveys')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', pid)
      .filter('site_details->>overallFeasibility', 'eq', 'Feasible'),
    supabase
      .from('surveys')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', pid)
      .filter('site_details->>overallFeasibility', 'eq', 'Not Feasible'),
    supabase
      .from('installations')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', pid)
      .in('status', ['in_progress', 'pending', 'inspection_pending']),
    supabase
      .from('installations')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', pid)
      .eq('status', 'completed')
      .gte('completed_at', monthStart),
    supabase
      .from('surveys')
      .select('id, beneficiary_name, service_no, status, site_location, site_details, created_at')
      .eq('project_id', pid)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('installations')
      .select('id, customer_name, address, status, materials, created_at')
      .eq('project_id', pid)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('inspections')
      .select('id, customer_name, address, status, manager_approval, created_at')
      .eq('project_id', pid)
      .in('status', ['pending', 'reopened'])
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const mapSurvey = (row: Record<string, unknown>): Survey =>
    ({
      id: row.id,
      beneficiaryName: row.beneficiary_name,
      serviceNo: row.service_no,
      status: row.status,
      siteLocation: row.site_location ?? {},
      siteDetails: row.site_details ?? undefined,
      createdAt: row.created_at,
      aadharNo: '',
      panNo: '',
      discomName: '',
      totalRoofs: '',
      roofType: '',
      buildingHeight: 0,
      uploadDate: row.created_at,
      submittedAt: row.created_at,
      plantType: '',
      bankDetails: {},
      uploads: {},
      activity: [],
    }) as unknown as Survey

  const mapInstallation = (row: Record<string, unknown>): Installation =>
    ({
      id: row.id,
      customerName: row.customer_name,
      address: row.address,
      status: row.status,
      materials: (row.materials as Installation['materials']) ?? [],
      createdAt: row.created_at,
      photos: [],
    }) as unknown as Installation

  const mapInspection = (row: Record<string, unknown>): Inspection =>
    ({
      id: row.id,
      customerName: row.customer_name,
      address: row.address,
      status: row.status,
      managerApproval: row.manager_approval ?? undefined,
      createdAt: row.created_at,
      installationId: '',
    }) as Inspection

  const totalSurveysCount = surveysTotal.count ?? 0

  return {
    totalProjects: projectsCount.count ?? 0,
    totalSurveys: totalSurveysCount,
    pendingSurveys: surveysPending.count ?? 0,
    feasibleSurveys: surveysFeasible.count ?? 0,
    notFeasibleSurveys: surveysNotFeasible.count ?? 0,
    pendingAssessment: totalSurveysCount - (surveysFeasible.count ?? 0) - (surveysNotFeasible.count ?? 0),
    activeInstallations: activeInstalls.count ?? 0,
    completedThisMonth: completedMonth.count ?? 0,
    recentSurveys: (recentSurveys.data ?? []).map(mapSurvey),
    recentInstallations: (recentInstallations.data ?? []).map(mapInstallation),
    pendingInspections: (pendingInspections.data ?? []).map(mapInspection),
  }
}
