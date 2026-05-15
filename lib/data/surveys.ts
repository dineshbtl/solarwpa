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

export type { Survey, CreateSurveyInput, SurveyUploadKeys, FileMeta, SurveyActivityEvent }

let listSurveysInflight: Promise<Survey[]> | null = null

export async function listSurveys(): Promise<Survey[]> {
  assertSupabaseConfigured()
  if (!listSurveysInflight) {
    listSurveysInflight = supabase.listSurveysFromSupabase().finally(() => {
      listSurveysInflight = null
    })
  }
  return listSurveysInflight
}

export type ListSurveysPaginatedParams = import('@/lib/supabase/surveys').ListSurveysPaginatedParams

export async function listSurveysPaginated(
  params: ListSurveysPaginatedParams
): Promise<{ items: Survey[]; total: number }> {
  assertSupabaseConfigured()
  return supabase.listSurveysFromSupabasePaginated(params)
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
  return supabase.getSurveyByIdFromSupabase(id)
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
