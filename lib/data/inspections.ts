/**
 * Inspection data from Supabase only.
 */
import { assertSupabaseConfigured } from '@/lib/supabase/config'
import * as supabase from '@/lib/supabase/inspections'
import type { Inspection, InspectionStatus } from '@/lib/store/inspections'
import type { InspectionListItem, ListInspectionsParams } from '@/lib/supabase/inspections'
import { processSyncQueue } from './sync'

export type { Inspection, InspectionStatus, InspectionListItem, ListInspectionsParams }

import { offlineDB } from '@/lib/data/offline-db'

export async function listInspectionsPaginated(
  params: ListInspectionsParams
): Promise<{ items: InspectionListItem[]; total: number }> {
  const local = await listInspectionsLocallyPaginated(params)

  if (typeof window !== 'undefined' && navigator.onLine) {
    return supabase.listInspectionsFromSupabasePaginated(params)
      .then(async (result) => {
        await offlineDB.putMany('inspections', result.items, { silent: true })
        return result
      })
      .catch((err) => {
        console.warn('Background sync listInspectionsPaginated failed:', err)
        return local || { items: [], total: 0 }
      })
  }

  return local || { items: [], total: 0 }
}

export async function listInspectionsLocallyPaginated(
  params: ListInspectionsParams
): Promise<{ items: InspectionListItem[]; total: number } | null> {
  if (typeof window === 'undefined') return null
  try {
    const allLocal = await offlineDB.getAll('inspections')
    if (allLocal.length > 0) {
      return filterInspectionsLocally(allLocal, params)
    }
  } catch {}
  return null
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
  const local = typeof window !== 'undefined' ? await offlineDB.getAll('inspections') : []

  if (typeof window !== 'undefined' && navigator.onLine) {
    const fetchPromise = supabase.listInspectionsFromSupabase()
      .then(async (list) => {
        await offlineDB.putMany('inspections', list, { silent: true })
        return list
      })
      .catch((err) => {
        console.warn('Background sync listInspections failed:', err)
        return local
      })

    if (local.length === 0) {
      return fetchPromise
    }
  }

  return local
}

export async function getInspectionById(id: string): Promise<Inspection | undefined> {
  const local = typeof window !== 'undefined' ? await offlineDB.getOne('inspections', id) : undefined

  if (typeof window !== 'undefined' && navigator.onLine) {
    const fetchPromise = supabase.getInspectionByIdFromSupabase(id)
      .then(async (one) => {
        if (one) {
          await offlineDB.putOne('inspections', one)
        }
        return one
      })
      .catch((err) => {
        console.warn('Background sync getInspectionById failed:', err)
        return local
      })

    if (!local) {
      return fetchPromise
    }
  }

  return local
}

export async function getInspectionByInstallationId(installationId: string): Promise<Inspection | undefined> {
  const local = typeof window !== 'undefined' ? (await offlineDB.getAll('inspections')).find(i => i.installationId === installationId) : undefined

  if (typeof window !== 'undefined' && navigator.onLine) {
    const fetchPromise = supabase.getInspectionByInstallationIdFromSupabase(installationId)
      .then(async (one) => {
        if (one) {
          await offlineDB.putOne('inspections', one)
        }
        return one
      })
      .catch((err) => {
        console.warn('Background sync getInspectionByInstallationId failed:', err)
        return local
      })

    if (!local) {
      return fetchPromise
    }
  }

  return local
}

export async function createInspection(input: {
  installationId: string
  projectId?: string
  surveyId?: string
  customerName: string
  address: string
}): Promise<Inspection> {
  const id = crypto.randomUUID()
  const localInspection: Inspection = {
    id,
    installationId: input.installationId,
    projectId: input.projectId,
    surveyId: input.surveyId,
    customerName: input.customerName,
    address: input.address,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _syncStatus: 'pending-create',
  } as any

  await offlineDB.putOne('inspections', localInspection)

  await offlineDB.addMutation({
    storeName: 'inspections',
    action: 'CREATE',
    entityId: id,
    payload: { input }
  })

  if (typeof window !== 'undefined' && navigator.onLine) {
    processSyncQueue()
  }

  return localInspection
}

export async function updateInspectionStatus(id: string, status: InspectionStatus): Promise<Inspection> {
  const existing = await offlineDB.getOne('inspections', id)
  const localInspection: Inspection = {
    ...existing,
    status,
    _syncStatus: existing?._syncStatus === 'pending-create' ? 'pending-create' : 'pending-update',
  } as any

  await offlineDB.putOne('inspections', localInspection)

  await offlineDB.addMutation({
    storeName: 'inspections',
    action: 'STATUS',
    entityId: id,
    payload: { status }
  })

  if (typeof window !== 'undefined' && navigator.onLine) {
    processSyncQueue()
  }

  return localInspection
}

export async function assignInspectionInspector(id: string, inspectorId?: string): Promise<Inspection> {
  const existing = await offlineDB.getOne('inspections', id)
  const localInspection: Inspection = {
    ...existing,
    inspectorId: inspectorId ?? null,
    _syncStatus: existing?._syncStatus === 'pending-create' ? 'pending-create' : 'pending-update',
  } as any

  await offlineDB.putOne('inspections', localInspection)

  await offlineDB.addMutation({
    storeName: 'inspections',
    action: 'INSPECTOR',
    entityId: id,
    payload: { inspectorId }
  })

  if (typeof window !== 'undefined' && navigator.onLine) {
    processSyncQueue()
  }

  return localInspection
}

export async function updateInspectionDetails(
  id: string,
  patch: { customerName: string; address: string; inspectorId?: string }
): Promise<Inspection> {
  const existing = await offlineDB.getOne('inspections', id)
  const localInspection: Inspection = {
    ...existing,
    customerName: patch.customerName,
    address: patch.address,
    inspectorId: patch.inspectorId ?? existing?.inspectorId,
    _syncStatus: existing?._syncStatus === 'pending-create' ? 'pending-create' : 'pending-update',
  } as any

  await offlineDB.putOne('inspections', localInspection)

  await offlineDB.addMutation({
    storeName: 'inspections',
    action: 'DETAILS',
    entityId: id,
    payload: { patch }
  })

  if (typeof window !== 'undefined' && navigator.onLine) {
    processSyncQueue()
  }

  return localInspection
}

export async function setManagerApproval(
  id: string,
  approved: boolean,
  remarks: string,
  approvedBy?: string
): Promise<Inspection> {
  const existing = await offlineDB.getOne('inspections', id)
  const localInspection: Inspection = {
    ...existing,
    managerApproval: { approved, remarks, approvedBy, at: new Date().toISOString() },
    _syncStatus: existing?._syncStatus === 'pending-create' ? 'pending-create' : 'pending-update',
  } as any

  await offlineDB.putOne('inspections', localInspection)

  await offlineDB.addMutation({
    storeName: 'inspections',
    action: 'APPROVAL',
    entityId: id,
    payload: { approved, remarks, approvedBy }
  })

  if (typeof window !== 'undefined' && navigator.onLine) {
    processSyncQueue()
  }

  return localInspection
}

export async function setGovernmentInspection(
  id: string,
  approved: boolean,
  remarks: string,
  inspectorName?: string
): Promise<Inspection> {
  const existing = await offlineDB.getOne('inspections', id)
  const localInspection: Inspection = {
    ...existing,
    governmentInspection: { approved, remarks, inspectorName, at: new Date().toISOString() },
    _syncStatus: existing?._syncStatus === 'pending-create' ? 'pending-create' : 'pending-update',
  } as any

  await offlineDB.putOne('inspections', localInspection)

  await offlineDB.addMutation({
    storeName: 'inspections',
    action: 'GOVERNMENT',
    entityId: id,
    payload: { approved, remarks, inspectorName }
  })

  if (typeof window !== 'undefined' && navigator.onLine) {
    processSyncQueue()
  }

  return localInspection
}
