/**
 * Survey data from Supabase only.
 */
import { assertSupabaseConfigured } from '@/lib/supabase/config'
import * as supabase from '@/lib/supabase/surveys'
import { buildAuthHeaders } from '@/lib/data/auth-headers'
import { fetchWithTimeout } from '@/lib/data/fetch-with-timeout'

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
  assertSupabaseConfigured()
  try {
    const list = await supabase.listSurveysFromSupabase()
    if (typeof window !== 'undefined') {
      await offlineDB.putMany('surveys', list)
    }
    return list
  } catch (err) {
    const local = await offlineDB.getAll('surveys')
    if (local.length > 0) return local
    throw err
  }
}

export type ListSurveysPaginatedParams = import('@/lib/supabase/surveys').ListSurveysPaginatedParams

export async function listSurveysPaginated(
  params: ListSurveysPaginatedParams
): Promise<{ items: Survey[]; total: number }> {
  assertSupabaseConfigured()
  try {
    const result = await supabase.listSurveysFromSupabasePaginated(params)
    if (typeof window !== 'undefined') {
      await offlineDB.putMany('surveys', result.items)
    }
    return result
  } catch (err) {
    const local = await listSurveysLocallyPaginated(params)
    if (local) return local
    throw err
  }
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
  assertSupabaseConfigured()
  return supabase.isServiceNoTakenGlobally(serviceNo, excludeSurveyId)
}

export async function isSurveyAadharTaken(aadhar: string, excludeSurveyId?: string): Promise<boolean> {
  assertSupabaseConfigured()
  return supabase.isAadharTakenGlobally(aadhar, excludeSurveyId)
}

export async function getSurveyById(id: string): Promise<Survey | undefined> {
  assertSupabaseConfigured()
  try {
    const one = await supabase.getSurveyByIdFromSupabase(id)
    if (one && typeof window !== 'undefined') {
      await offlineDB.putOne('surveys', one)
    }
    return one
  } catch (err) {
    const local = await offlineDB.getOne('surveys', id)
    if (local) return local as Survey
    throw err
  }
}

export async function createSurvey(
  input: CreateSurveyInput,
  uploads: Partial<Record<SurveyUploadKeys, FileMeta>>,
  siteDetails: Survey['siteDetails'] | undefined,
  submittedById?: string,
  uploadFiles?: Partial<Record<SurveyUploadKeys, File>>
): Promise<Survey> {
  assertSupabaseConfigured()
  const formData = new FormData()
  for (const k of SURVEY_UPLOAD_KEYS_ORDER) {
    const f = uploadFiles?.[k]
    if (f) formData.set(`file_${k}`, f, f.name)
  }
  formData.set('input', JSON.stringify(input))
  formData.set('siteDetails', JSON.stringify(siteDetails ?? {}))
  formData.set('meta', JSON.stringify(uploads ?? {}))
  if (submittedById) formData.set('submittedById', submittedById)
  const res = await fetchWithTimeout(
    '/api/surveys/create',
    {
      method: 'POST',
      headers: await buildAuthHeaders(true),
      body: formData,
    },
    SURVEY_UPLOAD_TIMEOUT_MS,
  )
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof json?.error === 'string' ? json.error : 'Could not create survey')
  }
  return json.survey as Survey
}

export async function updateSurvey(
  id: string,
  input: CreateSurveyInput,
  uploads: Partial<Record<SurveyUploadKeys, FileMeta>>,
  siteDetails: Survey['siteDetails'] | undefined,
  submittedById?: string,
  uploadFiles?: Partial<Record<SurveyUploadKeys, File>>
): Promise<Survey> {
  assertSupabaseConfigured()
  const formData = new FormData()
  for (const k of SURVEY_UPLOAD_KEYS_ORDER) {
    const f = uploadFiles?.[k]
    if (f) formData.set(`file_${k}`, f, f.name)
  }
  formData.set('id', id)
  formData.set('input', JSON.stringify(input))
  formData.set('siteDetails', JSON.stringify(siteDetails ?? {}))
  formData.set('meta', JSON.stringify(uploads ?? {}))
  if (submittedById) formData.set('submittedById', submittedById)
  const res = await fetchWithTimeout(
    '/api/surveys/update',
    {
      method: 'POST',
      headers: await buildAuthHeaders(true),
      body: formData,
    },
    SURVEY_UPLOAD_TIMEOUT_MS,
  )
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof json?.error === 'string' ? json.error : 'Could not update survey')
  }
  return json.survey as Survey
}

export async function updateSurveyStatus(id: string, status: Survey['status']): Promise<Survey> {
  assertSupabaseConfigured()
  const res = await fetchWithTimeout(
    '/api/surveys/status',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await buildAuthHeaders(true)),
      },
      body: JSON.stringify({ surveyId: id, status }),
    },
    SURVEY_LIGHT_TIMEOUT_MS,
  )
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof json?.error === 'string' ? json.error : 'Could not update survey status')
  }
  return json.survey as Survey
}

export async function assignSurveyInstaller(id: string, installerId?: string): Promise<Survey> {
  assertSupabaseConfigured()
  const res = await fetchWithTimeout(
    '/api/surveys/installer',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await buildAuthHeaders(true)),
      },
      body: JSON.stringify({ surveyId: id, installerId: installerId ?? null }),
    },
    SURVEY_LIGHT_TIMEOUT_MS,
  )
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof json?.error === 'string' ? json.error : 'Could not assign installer')
  }
  return json.survey as Survey
}

export async function appendSurveyActivity(
  id: string,
  event: Omit<SurveyActivityEvent, 'at'> & { at?: string }
): Promise<Survey> {
  assertSupabaseConfigured()
  return supabase.appendSurveyActivityInSupabase(id, event)
}

export async function deleteSurvey(id: string): Promise<void> {
  assertSupabaseConfigured()
  return supabase.deleteSurveyFromSupabase(id)
}
