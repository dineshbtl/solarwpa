/**
 * Inspection data from Supabase only.
 */
import { assertSupabaseConfigured } from '@/lib/supabase/config'
import * as supabase from '@/lib/supabase/inspections'
import type { Inspection, InspectionStatus } from '@/lib/store/inspections'
import type { InspectionListItem, ListInspectionsParams } from '@/lib/supabase/inspections'

export type { Inspection, InspectionStatus, InspectionListItem, ListInspectionsParams }

import { offlineDB } from '@/lib/data/offline-db'

export async function listInspectionsPaginated(
  params: ListInspectionsParams
): Promise<{ items: InspectionListItem[]; total: number }> {
  assertSupabaseConfigured()
  try {
    const result = await supabase.listInspectionsFromSupabasePaginated(params)
    if (result.items.length > 0 && typeof window !== 'undefined') {
      await offlineDB.putMany('inspections', result.items)
    }
    return result
  } catch (err) {
    const allLocal = await offlineDB.getAll('inspections')
    if (allLocal.length > 0) {
      return filterInspectionsLocally(allLocal, params)
    }
    throw err
  }
}

function filterInspectionsLocally(
  items: any[],
  params: ListInspectionsParams
): { items: any[]; total: number } {
  const {
    limit = 10,
    offset = 0,
    search,
    status,
  } = params

  let result = items

  // 1. Search
  if (search && search.trim()) {
    const term = search.trim().toLowerCase()
    result = result.filter(item => 
      (item.customerName ?? '').toLowerCase().includes(term) ||
      (item.address ?? '').toLowerCase().includes(term) ||
      (item.id ?? '').toLowerCase().includes(term) ||
      (item.surveyId ?? '').toLowerCase().includes(term) ||
      (item.installationId ?? '').toLowerCase().includes(term)
    )
  }

  // 2. Status
  if (status && status.trim()) {
    result = result.filter(item => item.status === status.trim())
  }

  // Sort descending by created_at
  result.sort((a, b) => {
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return db - da
  })

  const total = result.length
  const paginated = result.slice(offset, offset + limit)

  return { items: paginated, total }
}

/** One shared in-flight list fetch avoids duplicate heavy selects. */
let listInspectionsInflight: Promise<Inspection[]> | null = null

export async function listInspections(): Promise<Inspection[]> {
  assertSupabaseConfigured()
  try {
    const list = await supabase.listInspectionsFromSupabase()
    if (typeof window !== 'undefined') {
      await offlineDB.putMany('inspections', list)
    }
    return list
  } catch (err) {
    const local = await offlineDB.getAll('inspections')
    if (local.length > 0) return local
    throw err
  }
}

export async function getInspectionById(id: string): Promise<Inspection | undefined> {
  assertSupabaseConfigured()
  try {
    const one = await supabase.getInspectionByIdFromSupabase(id)
    if (one && typeof window !== 'undefined') {
      await offlineDB.putOne('inspections', one)
    }
    return one
  } catch (err) {
    const local = await offlineDB.getOne('inspections', id)
    if (local) return local as Inspection
    throw err
  }
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
