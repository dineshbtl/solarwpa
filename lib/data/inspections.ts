/**
 * Inspection data from Supabase only.
 */
import { assertSupabaseConfigured } from '@/lib/supabase/config'
import * as supabase from '@/lib/supabase/inspections'
import type { Inspection, InspectionStatus } from '@/lib/store/inspections'
import type { InspectionListItem, ListInspectionsParams } from '@/lib/supabase/inspections'

export type { Inspection, InspectionStatus, InspectionListItem, ListInspectionsParams }

export async function listInspectionsPaginated(
  params: ListInspectionsParams
): Promise<{ items: InspectionListItem[]; total: number }> {
  assertSupabaseConfigured()
  return supabase.listInspectionsFromSupabasePaginated(params)
}

/** One shared in-flight list fetch avoids duplicate heavy selects. */
let listInspectionsInflight: Promise<Inspection[]> | null = null

export async function listInspections(): Promise<Inspection[]> {
  assertSupabaseConfigured()
  if (!listInspectionsInflight) {
    listInspectionsInflight = supabase.listInspectionsFromSupabase().finally(() => {
      listInspectionsInflight = null
    })
  }
  return listInspectionsInflight
}

export async function getInspectionById(id: string): Promise<Inspection | undefined> {
  assertSupabaseConfigured()
  return supabase.getInspectionByIdFromSupabase(id)
}

export async function getInspectionByInstallationId(installationId: string): Promise<Inspection | undefined> {
  assertSupabaseConfigured()
  return supabase.getInspectionByInstallationIdFromSupabase(installationId)
}

export async function createInspection(input: {
  installationId: string
  projectId?: string
  surveyId?: string
  customerName: string
  address: string
}): Promise<Inspection> {
  assertSupabaseConfigured()
  return supabase.createInspectionInSupabase(input)
}

export async function updateInspectionStatus(id: string, status: InspectionStatus): Promise<Inspection> {
  assertSupabaseConfigured()
  return supabase.updateInspectionStatusInSupabase(id, status)
}

export async function assignInspectionInspector(id: string, inspectorId?: string): Promise<Inspection> {
  assertSupabaseConfigured()
  return supabase.assignInspectionInspectorInSupabase(id, inspectorId)
}

export async function updateInspectionDetails(
  id: string,
  patch: { customerName: string; address: string; inspectorId?: string }
): Promise<Inspection> {
  assertSupabaseConfigured()
  return supabase.updateInspectionDetailsInSupabase(id, patch)
}

export async function setManagerApproval(
  id: string,
  approved: boolean,
  remarks: string,
  approvedBy?: string
): Promise<Inspection> {
  assertSupabaseConfigured()
  return supabase.setManagerApprovalInSupabase(id, approved, remarks, approvedBy)
}

export async function setGovernmentInspection(
  id: string,
  approved: boolean,
  remarks: string,
  inspectorName?: string
): Promise<Inspection> {
  assertSupabaseConfigured()
  return supabase.setGovernmentInspectionInSupabase(id, approved, remarks, inspectorName)
}
