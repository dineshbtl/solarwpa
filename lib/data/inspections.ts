/**
 * Unified data layer: Supabase when configured, else localStorage store.
 */
import { isSupabaseConfigured } from '@/lib/supabase/config'
import * as store from '@/lib/store/inspections'
import * as supabase from '@/lib/supabase/inspections'
import type { Inspection, InspectionStatus } from '@/lib/store/inspections'

export type { Inspection, InspectionStatus }

export async function listInspections(): Promise<Inspection[]> {
  if (isSupabaseConfigured()) return supabase.listInspectionsFromSupabase()
  return Promise.resolve(store.listInspections())
}

export async function getInspectionById(id: string): Promise<Inspection | undefined> {
  if (isSupabaseConfigured()) return supabase.getInspectionByIdFromSupabase(id)
  return Promise.resolve(store.getInspectionById(id))
}

export async function getInspectionByInstallationId(installationId: string): Promise<Inspection | undefined> {
  if (isSupabaseConfigured()) return supabase.getInspectionByInstallationIdFromSupabase(installationId)
  return Promise.resolve(store.getInspectionByInstallationId(installationId))
}

export async function createInspection(input: {
  installationId: string
  projectId?: string
  surveyId?: string
  customerName: string
  address: string
}): Promise<Inspection> {
  if (isSupabaseConfigured()) return supabase.createInspectionInSupabase(input)
  return Promise.resolve(store.createInspection(input))
}

export async function updateInspectionStatus(id: string, status: InspectionStatus): Promise<Inspection> {
  if (isSupabaseConfigured()) return supabase.updateInspectionStatusInSupabase(id, status)
  return Promise.resolve(store.updateInspectionStatus(id, status))
}

export async function assignInspectionInspector(id: string, inspectorId?: string): Promise<Inspection> {
  if (isSupabaseConfigured()) return supabase.assignInspectionInspectorInSupabase(id, inspectorId)
  return Promise.resolve(store.assignInspectionInspector(id, inspectorId))
}

export async function updateInspectionDetails(
  id: string,
  patch: { customerName: string; address: string; inspectorId?: string }
): Promise<Inspection> {
  if (isSupabaseConfigured()) return supabase.updateInspectionDetailsInSupabase(id, patch)
  return Promise.resolve(store.updateInspectionDetails(id, patch))
}

export async function setManagerApproval(
  id: string,
  approved: boolean,
  remarks: string,
  approvedBy?: string
): Promise<Inspection> {
  if (isSupabaseConfigured()) return supabase.setManagerApprovalInSupabase(id, approved, remarks, approvedBy)
  return Promise.resolve(store.setManagerApproval(id, approved, remarks, approvedBy))
}

export async function setGovernmentInspection(
  id: string,
  approved: boolean,
  remarks: string,
  inspectorName?: string
): Promise<Inspection> {
  if (isSupabaseConfigured()) return supabase.setGovernmentInspectionInSupabase(id, approved, remarks, inspectorName)
  return Promise.resolve(store.setGovernmentInspection(id, approved, remarks, inspectorName))
}
