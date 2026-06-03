import { assertSupabaseConfigured } from '@/lib/supabase/config'
import * as supabase from '@/lib/supabase/surveys'
import { buildAuthHeaders } from '@/lib/data/auth-headers'
import { fetchWithTimeout } from '@/lib/data/fetch-with-timeout'
import { processSyncQueue } from './sync'

/** Multipart create/update can include several compressed photos, so allow up to 60s. */
const SURVEY_UPLOAD_TIMEOUT_MS = 60_000
/** Status / installer assign are tiny JSON calls — short timeout is fine. */
const SURVEY_LIGHT_TIMEOUT_MS = 15_000
import {
  SURVEY_UPLOAD_KEYS_ORDER,
  type Survey,
  type CreateSurveyInput,
  type SurveyUploadKeys,
  type FileMeta,
  type SurveyActivityEvent,
} from '@/lib/store/surveys'

import { offlineDB } from '@/lib/data/offline-db'
import { ACTIVE_PROJECT_ID } from '@/lib/data/active-project'

export type { Survey, CreateSurveyInput, SurveyUploadKeys, FileMeta, SurveyActivityEvent }

let listSurveysInflight: Promise<Survey[]> | null = null

export async function listSurveys(): Promise<Survey[]> {
  const local = typeof window !== 'undefined' ? await offlineDB.getAll('surveys') : []
  
  if (typeof window !== 'undefined' && navigator.onLine) {
    const fetchPromise = supabase.listSurveysFromSupabase()
      .then(async (list) => {
        await offlineDB.putMany('surveys', list, { silent: true })
        return list
      })
      .catch((err) => {
        console.warn('Background sync listSurveys failed:', err)
        return local
      })

    if (local.length === 0) {
      return fetchPromise
    }
  }
  
  return local
}

export type ListSurveysPaginatedParams = import('@/lib/supabase/surveys').ListSurveysPaginatedParams

export async function listSurveysPaginated(
  params: ListSurveysPaginatedParams
): Promise<{ items: Survey[]; total: number }> {
  const local = await listSurveysLocallyPaginated(params)

  if (typeof window !== 'undefined' && navigator.onLine) {
    return supabase.listSurveysFromSupabasePaginated(params)
      .then(async (result) => {
        await offlineDB.putMany('surveys', result.items, { silent: true })
        return result
      })
      .catch((err) => {
        console.warn('Background sync listSurveysPaginated failed:', err)
        return local || { items: [], total: 0 }
      })
  }

  return local || { items: [], total: 0 }
}

export async function listSurveysLocallyPaginated(
  params: ListSurveysPaginatedParams
): Promise<{ items: Survey[]; total: number } | null> {
  if (typeof window === 'undefined') return null
  try {
    const allLocal = await offlineDB.getAll('surveys')
    if (allLocal.length > 0) {
      return filterSurveysLocally(allLocal, params)
    }
  } catch {}
  return null
}

function filterSurveysLocally(
  items: Survey[],
  params: ListSurveysPaginatedParams
): { items: Survey[]; total: number } {
  const {
    limit = 20,
    offset = 0,
    search,
    section,
    subDivision,
    status,
    feasibility,
    installerFilter,
  } = params

  let result = items

  // 1. Project scope
  const pid = ACTIVE_PROJECT_ID
  result = result.filter(s => s.projectId === pid)

  // 2. Installer filter
  if (installerFilter === '__unassigned__') {
    result = result.filter(s => !s.installerId)
  } else if (installerFilter) {
    result = result.filter(s => s.installerId === installerFilter)
  }

  // 3. Search
  if (search && search.trim()) {
    const term = search.trim().toLowerCase()
    result = result.filter(s => 
      (s.beneficiaryName ?? '').toLowerCase().includes(term) ||
      (s.serviceNo ?? '').toLowerCase().includes(term) ||
      (s.id ?? '').toLowerCase().includes(term) ||
      (s.aadharNo ?? '').toLowerCase().includes(term) ||
      (s.mobile ?? '').toLowerCase().includes(term) ||
      (s.siteLocation?.section ?? '').toLowerCase().includes(term) ||
      (s.siteLocation?.subDivision ?? '').toLowerCase().includes(term)
    )
  }

  // 4. Filters
  if (section?.trim()) {
    result = result.filter(s => s.siteLocation?.section === section.trim())
  }
  if (subDivision?.trim()) {
    result = result.filter(s => s.siteLocation?.subDivision === subDivision.trim())
  }
  if (status?.trim()) {
    result = result.filter(s => s.status === status.trim())
  }
  if (feasibility?.trim()) {
    if (feasibility === 'pending') {
      result = result.filter(s => !s.siteDetails?.overallFeasibility)
    } else {
      result = result.filter(s => s.siteDetails?.overallFeasibility === feasibility.trim())
    }
  }

  // Sort descending by created_at or uploadDate
  result.sort((a, b) => {
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return db - da
  })

  const total = result.length
  const paginated = result.slice(offset, offset + limit)

  return { items: paginated, total }
}

/** Unscoped checks for unique service no / Aadhar across all rows (used by survey forms). */
export async function isSurveyServiceNoTaken(serviceNo: string, excludeSurveyId?: string): Promise<boolean> {
  const local = typeof window !== 'undefined' ? await offlineDB.getAll('surveys') : []
  const match = local.find(s => s.id !== excludeSurveyId && s.serviceNo === serviceNo)
  if (match) return true

  if (typeof window !== 'undefined' && navigator.onLine) {
    try {
      return await supabase.isServiceNoTakenGlobally(serviceNo, excludeSurveyId)
    } catch {
      return false
    }
  }
  return false
}

export async function isSurveyAadharTaken(aadhar: string, excludeSurveyId?: string): Promise<boolean> {
  const local = typeof window !== 'undefined' ? await offlineDB.getAll('surveys') : []
  const match = local.find(s => s.id !== excludeSurveyId && s.aadharNo === aadhar)
  if (match) return true

  if (typeof window !== 'undefined' && navigator.onLine) {
    try {
      return await supabase.isAadharTakenGlobally(aadhar, excludeSurveyId)
    } catch {
      return false
    }
  }
  return false
}

export async function getSurveyById(id: string): Promise<Survey | undefined> {
  const local = typeof window !== 'undefined' ? await offlineDB.getOne('surveys', id) : undefined

  if (typeof window !== 'undefined' && navigator.onLine) {
    const fetchPromise = supabase.getSurveyByIdFromSupabase(id)
      .then(async (one) => {
        if (one) {
          await offlineDB.putOne('surveys', one)
        }
        return one
      })
      .catch((err) => {
        console.warn('Background sync getSurveyById failed:', err)
        return local
      })

    if (!local) {
      return fetchPromise
    }
  }

  return local
}

export async function createSurvey(
  input: CreateSurveyInput,
  uploads: Partial<Record<SurveyUploadKeys, FileMeta>>,
  siteDetails: Survey['siteDetails'] | undefined,
  submittedById?: string,
  uploadFiles?: Partial<Record<SurveyUploadKeys, File>>
): Promise<Survey> {
  const id = crypto.randomUUID()
  const localSurvey: Survey = {
    id,
    projectId: input.projectId ?? ACTIVE_PROJECT_ID,
    beneficiaryName: input.beneficiaryName,
    serviceNo: input.serviceNo,
    aadharNo: input.aadharNo,
    mobile: input.mobile ?? undefined,
    panNo: (input.panNo ?? '').toString().toUpperCase(),
    contractedLoad: input.contractedLoad ?? undefined,
    status: 'pending',
    uploads: uploads || {},
    siteDetails: siteDetails || {},
    siteLocation: input.siteLocation,
    bankDetails: input.bankDetails,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _syncStatus: 'pending-create',
  } as any

  // Save files locally in case offline
  if (uploadFiles) {
    for (const [key, file] of Object.entries(uploadFiles)) {
      if (file) {
        await offlineDB.saveOfflineFile(`${id}_${key}`, file, file.name, file.type)
      }
    }
  }

  await offlineDB.putOne('surveys', localSurvey)

  // Queue mutation
  await offlineDB.addMutation({
    storeName: 'surveys',
    action: 'CREATE',
    entityId: id,
    payload: { input, uploads, siteDetails, submittedById }
  })

  // Trigger sync in background if online
  if (typeof window !== 'undefined' && navigator.onLine) {
    processSyncQueue()
  }

  return localSurvey
}

export async function updateSurvey(
  id: string,
  input: CreateSurveyInput,
  uploads: Partial<Record<SurveyUploadKeys, FileMeta>>,
  siteDetails: Survey['siteDetails'] | undefined,
  submittedById?: string,
  uploadFiles?: Partial<Record<SurveyUploadKeys, File>>
): Promise<Survey> {
  const existing = await offlineDB.getOne('surveys', id)
  const localSurvey: Survey = {
    ...existing,
    beneficiaryName: input.beneficiaryName,
    serviceNo: input.serviceNo,
    aadharNo: input.aadharNo,
    mobile: input.mobile ?? undefined,
    panNo: (input.panNo ?? '').toString().toUpperCase(),
    contractedLoad: input.contractedLoad ?? undefined,
    uploads: { ...(existing?.uploads || {}), ...uploads },
    siteDetails: siteDetails || {},
    siteLocation: input.siteLocation,
    bankDetails: input.bankDetails,
    updatedAt: new Date().toISOString(),
    _syncStatus: existing?._syncStatus === 'pending-create' ? 'pending-create' : 'pending-update',
  } as any

  // Save files locally in case offline
  if (uploadFiles) {
    for (const [key, file] of Object.entries(uploadFiles)) {
      if (file) {
        await offlineDB.saveOfflineFile(`${id}_${key}`, file, file.name, file.type)
      }
    }
  }

  await offlineDB.putOne('surveys', localSurvey)

  // Queue mutation
  await offlineDB.addMutation({
    storeName: 'surveys',
    action: 'UPDATE',
    entityId: id,
    payload: { input, uploads, siteDetails, submittedById }
  })

  // Trigger sync in background if online
  if (typeof window !== 'undefined' && navigator.onLine) {
    processSyncQueue()
  }

  return localSurvey
}

export async function updateSurveyStatus(id: string, status: Survey['status']): Promise<Survey> {
  const existing = await offlineDB.getOne('surveys', id)
  const localSurvey: Survey = {
    ...existing,
    status,
    _syncStatus: existing?._syncStatus === 'pending-create' ? 'pending-create' : 'pending-update',
  } as any

  await offlineDB.putOne('surveys', localSurvey)

  await offlineDB.addMutation({
    storeName: 'surveys',
    action: 'STATUS',
    entityId: id,
    payload: { status }
  })

  if (typeof window !== 'undefined' && navigator.onLine) {
    processSyncQueue()
  }

  return localSurvey
}

export async function assignSurveyInstaller(id: string, installerId?: string): Promise<Survey> {
  const existing = await offlineDB.getOne('surveys', id)
  const localSurvey: Survey = {
    ...existing,
    installerId: installerId ?? null,
    _syncStatus: existing?._syncStatus === 'pending-create' ? 'pending-create' : 'pending-update',
  } as any

  await offlineDB.putOne('surveys', localSurvey)

  await offlineDB.addMutation({
    storeName: 'surveys',
    action: 'INSTALLER',
    entityId: id,
    payload: { installerId }
  })

  if (typeof window !== 'undefined' && navigator.onLine) {
    processSyncQueue()
  }

  return localSurvey
}

export async function appendSurveyActivity(
  id: string,
  event: Omit<SurveyActivityEvent, 'at'> & { at?: string }
): Promise<Survey> {
  const existing = await offlineDB.getOne('surveys', id)
  const activity = [...(existing?.activity || []), { ...event, at: event.at || new Date().toISOString() }]
  const localSurvey: Survey = {
    ...existing,
    activity,
  } as any

  await offlineDB.putOne('surveys', localSurvey)
  
  if (typeof window !== 'undefined' && navigator.onLine) {
    try {
      await supabase.appendSurveyActivityInSupabase(id, event)
    } catch {}
  }

  return localSurvey
}

export async function deleteSurvey(id: string): Promise<void> {
  await offlineDB.deleteOne('surveys', id)

  await offlineDB.addMutation({
    storeName: 'surveys',
    action: 'DELETE',
    entityId: id,
    payload: {}
  })

  if (typeof window !== 'undefined' && navigator.onLine) {
    processSyncQueue()
  }
}
