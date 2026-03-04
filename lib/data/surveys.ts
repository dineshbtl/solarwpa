/**
 * Unified data layer: Supabase when configured, else localStorage store.
 */
import { isSupabaseConfigured } from '@/lib/supabase/config'
import * as store from '@/lib/store/surveys'
import * as supabase from '@/lib/supabase/surveys'
import type {
  Survey,
  CreateSurveyInput,
  SurveyUploadKeys,
  FileMeta,
  SurveyActivityEvent,
} from '@/lib/store/surveys'

export type { Survey, CreateSurveyInput, SurveyUploadKeys, FileMeta, SurveyActivityEvent }

export async function listSurveys(): Promise<Survey[]> {
  if (isSupabaseConfigured()) return supabase.listSurveysFromSupabase()
  return Promise.resolve(store.listSurveys())
}

export type ListSurveysPaginatedParams = {
  limit: number
  offset: number
  search?: string
  section?: string
  subDivision?: string
  status?: string
  feasibility?: string
}

export async function listSurveysPaginated(
  params: ListSurveysPaginatedParams
): Promise<{ items: Survey[]; total: number }> {
  if (isSupabaseConfigured()) return supabase.listSurveysFromSupabasePaginated(params)
  const all = store.listSurveys()
  const search = params.search?.toLowerCase().trim()
  let filtered = search
    ? all.filter(
        (s) =>
          (s.beneficiaryName ?? '').toLowerCase().includes(search) ||
          (s.serviceNo ?? '').toLowerCase().includes(search) ||
          (s.id ?? '').toLowerCase().includes(search) ||
          (s.aadharNo ?? '').toLowerCase().includes(search) ||
          (s.panNo ?? '').toLowerCase().includes(search) ||
          (s.mobile ?? '').toLowerCase().includes(search) ||
          (s.siteLocation?.district ?? '').toLowerCase().includes(search) ||
          (s.siteLocation?.section ?? '').toLowerCase().includes(search)
      )
    : [...all]
  if (params.section?.trim()) {
    filtered = filtered.filter((s) => (s.siteLocation?.section ?? '') === params.section!.trim())
  }
  if (params.subDivision?.trim()) {
    filtered = filtered.filter((s) => (s.siteLocation?.subDivision ?? '') === params.subDivision!.trim())
  }
  if (params.status?.trim()) {
    filtered = filtered.filter((s) => s.status === params.status!.trim())
  }
  if (params.feasibility?.trim()) {
    if (params.feasibility === 'pending') {
      filtered = filtered.filter((s) => !s.siteDetails?.overallFeasibility)
    } else {
      filtered = filtered.filter((s) => s.siteDetails?.overallFeasibility === params.feasibility!.trim())
    }
  }
  filtered.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
  const total = filtered.length
  const items = filtered.slice(params.offset, params.offset + params.limit)
  return { items, total }
}

export async function getSurveyById(id: string): Promise<Survey | undefined> {
  if (isSupabaseConfigured()) return supabase.getSurveyByIdFromSupabase(id)
  return Promise.resolve(store.getSurveyById(id))
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Failed to read file'))
    r.readAsDataURL(file)
  })
}

/** When Supabase is not used, merge data URLs from uploadFiles into uploads so view can show images. */
async function mergeDataUrls(
  uploads: Partial<Record<SurveyUploadKeys, FileMeta>>,
  uploadFiles: Partial<Record<SurveyUploadKeys, File>> | undefined
): Promise<Partial<Record<SurveyUploadKeys, FileMeta>>> {
  if (!uploadFiles || Object.keys(uploadFiles).length === 0) return uploads ?? {}
  const merged = { ...(uploads ?? {}) }
  for (const k of Object.keys(uploadFiles) as SurveyUploadKeys[]) {
    const file = uploadFiles[k]
    if (!file) continue
    try {
      const url = await fileToDataUrl(file)
      merged[k] = { name: file.name, type: file.type, size: file.size, url }
    } catch {
      merged[k] = { name: file.name, type: file.type, size: file.size }
    }
  }
  return merged
}

export async function createSurvey(
  input: CreateSurveyInput,
  uploads: Partial<Record<SurveyUploadKeys, FileMeta>>,
  siteDetails: Survey['siteDetails'] | undefined,
  submittedById?: string,
  uploadFiles?: Partial<Record<SurveyUploadKeys, File>>
): Promise<Survey> {
  if (isSupabaseConfigured()) return supabase.createSurveyInSupabase(input, uploads, siteDetails, submittedById, uploadFiles)
  const meta = await mergeDataUrls(uploads, uploadFiles)
  return Promise.resolve(store.createSurvey(input, meta, siteDetails, submittedById))
}

export async function updateSurvey(
  id: string,
  input: CreateSurveyInput,
  uploads: Partial<Record<SurveyUploadKeys, FileMeta>>,
  siteDetails: Survey['siteDetails'] | undefined,
  submittedById?: string,
  uploadFiles?: Partial<Record<SurveyUploadKeys, File>>
): Promise<Survey> {
  if (isSupabaseConfigured()) return supabase.updateSurveyInSupabase(id, input, uploads, siteDetails, submittedById, uploadFiles)
  const meta = await mergeDataUrls(uploads, uploadFiles)
  return Promise.resolve(store.updateSurvey(id, input, meta, siteDetails, submittedById))
}

export async function updateSurveyStatus(id: string, status: Survey['status']): Promise<Survey> {
  if (isSupabaseConfigured()) return supabase.updateSurveyStatusInSupabase(id, status)
  return Promise.resolve(store.updateSurveyStatus(id, status))
}

export async function assignSurveyInstaller(id: string, installerId?: string): Promise<Survey> {
  if (isSupabaseConfigured()) return supabase.assignSurveyInstallerInSupabase(id, installerId)
  return Promise.resolve(store.assignSurveyInstaller(id, installerId))
}

export async function appendSurveyActivity(
  id: string,
  event: Omit<SurveyActivityEvent, 'at'> & { at?: string }
): Promise<Survey> {
  if (isSupabaseConfigured()) return supabase.appendSurveyActivityInSupabase(id, event)
  return Promise.resolve(store.appendSurveyActivity(id, event))
}

export async function deleteSurvey(id: string): Promise<void> {
  if (isSupabaseConfigured()) return supabase.deleteSurveyFromSupabase(id)
  store.deleteSurvey(id)
}
