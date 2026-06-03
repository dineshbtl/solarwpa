/**
 * Installation data from Supabase only.
 */
import { assertSupabaseConfigured, isSupabaseConfigured } from '@/lib/supabase/config'
import { waitForSessionReady } from '@/lib/supabase/auth'
import * as supabase from '@/lib/supabase/installations'
import { buildAuthHeaders, refreshSupabaseSession } from '@/lib/data/auth-headers'
import { processSyncQueue } from './sync'
import { ACTIVE_PROJECT_ID } from './active-project'
import type {
  Installation,
  CreateInstallationInput,
  Material,
  InstallationPhotoMeta,
} from '@/lib/store/installations'
import type { InstallationListItem, ListInstallationsParams } from '@/lib/supabase/installations'

export type { Installation, CreateInstallationInput, Material, InstallationPhotoMeta, InstallationListItem, ListInstallationsParams }
export type InstallationsKpi = {
  total: number
  pending: number
  inProgress: number
  completed: number
  inspectionPending: number
  /** Installer only: assigned surveys vs installation records created */
  surveyAssignment?: {
    assignedHouseholds: number
    householdsWithInstallation: number
    householdsPendingInstallation: number
  }
}

/** One shared in-flight list fetch avoids duplicate heavy selects (Strict Mode, prefetch, multiple hooks). */
let listInstallationsInflight: Promise<Installation[]> | null = null

/** Upload timeout: long enough for slow mobile uplinks with ~10 compressed photos, short enough to surface stalls. */
const INSTALLATION_UPLOAD_TIMEOUT_MS = 180_000

function approxFormDataBytes(formData: FormData): number {
  let total = 0
  for (const [, value] of formData.entries()) {
    if (typeof value === 'string') {
      total += value.length
    } else if (value && typeof (value as Blob).size === 'number') {
      total += (value as Blob).size
    }
  }
  return total
}

function explainInstallationError(
  status: number,
  rawMessage: string,
  fallback: string,
  approxBytes: number
): string {
  const trimmed = rawMessage.trim()
  const sizeMb = Math.round((approxBytes / (1024 * 1024)) * 10) / 10
  if (status === 401 || /unauthor/i.test(trimmed)) {
    return 'Your session expired on the device. Sign out and sign in again, then try saving once more.'
  }
  if (status === 403 || /forbid/i.test(trimmed)) {
    return trimmed || 'Permission denied — your role cannot save this installation.'
  }
  if (status === 413 || /payload too large|too large|request entity/i.test(trimmed)) {
    return `Upload too large (~${sizeMb} MB). Retake or remove a few photos and try again — typical limit is 25 MB.`
  }
  if (status === 504 || status === 408 || /timeout|gateway/i.test(trimmed)) {
    return 'Network/proxy timeout while uploading. Move to better signal or Wi-Fi and tap Complete installation again.'
  }
  if (status >= 500) {
    return trimmed
      ? `Server error (HTTP ${status}): ${trimmed}`
      : `Server error (HTTP ${status}). Please try again in a moment.`
  }
  return trimmed || fallback
}

async function postInstallationFormData(
  url: string,
  formData: FormData,
  fallbackMessage: string
): Promise<{ installation: Installation }> {
  const approxBytes = approxFormDataBytes(formData)
  let headers: Record<string, string> = {}
  try {
    headers = await buildAuthHeaders(true)
  } catch (e) {
    throw new Error(
      e instanceof Error && e.message
        ? `Sign-in expired on this device: ${e.message}`
        : 'Sign-in expired on this device. Sign out and sign in again, then retry.'
    )
  }

  const approxMb = Math.round((approxBytes / (1024 * 1024)) * 10) / 10
  console.info('[installations] client_upload_start', { url, approxMb })

  const sendOnce = async (authHeaders: Record<string, string>): Promise<Response> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), INSTALLATION_UPLOAD_TIMEOUT_MS)
    try {
      return await fetch(url, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  }

  let res: Response
  try {
    res = await sendOnce(headers)
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new Error(
        `Upload timed out after ${Math.round(INSTALLATION_UPLOAD_TIMEOUT_MS / 1000)}s on a slow connection. Move to better signal or Wi-Fi, keep the photos, and tap Complete installation again.`
      )
    }
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Network failure while uploading (~${Math.round((approxBytes / (1024 * 1024)) * 10) / 10} MB). Check your data signal and try again. (${msg})`
    )
  }

  // One-shot retry on 401 with a refreshed JWT. Long-form sessions (10 h JWT) can
  // still expire mid-upload on weak networks; a transparent refresh lets the user
  // succeed without the "Sign out and sign in again" detour.
  if (res.status === 401) {
    const refreshed = await refreshSupabaseSession()
    if (refreshed) {
      try {
        const fresh = await buildAuthHeaders(true)
        // eslint-disable-next-line no-console
        console.info('[installations] retrying after 401 with refreshed JWT', { url })
        res = await sendOnce(fresh)
      } catch {
        // fall through with the original 401 response
      }
    }
  }

  const text = await res.text().catch(() => '')
  let json: { installation?: Installation; error?: unknown } = {}
  if (text) {
    try {
      json = JSON.parse(text) as typeof json
    } catch {
      json = {}
    }
  }

  if (!res.ok) {
    const raw = json?.error
    let rawMessage = ''
    if (typeof raw === 'string') rawMessage = raw
    else if (
      raw != null &&
      typeof raw === 'object' &&
      'message' in raw &&
      typeof (raw as { message: unknown }).message === 'string'
    ) {
      rawMessage = String((raw as { message: string }).message)
    } else if (typeof raw === 'number' || typeof raw === 'boolean') {
      rawMessage = String(raw)
    } else if (raw && typeof raw === 'object') {
      try {
        rawMessage = JSON.stringify(raw)
      } catch {
        rawMessage = ''
      }
    } else if (!rawMessage && text && !text.startsWith('{')) {
      // Proxy 413/502/504 often returns HTML — surface a short hint.
      rawMessage = `HTTP ${res.status}`
    }
    const friendly = explainInstallationError(res.status, rawMessage, fallbackMessage, approxBytes)
    // Console-log so mobile remote inspect / desktop devtools surfaces details.
    // eslint-disable-next-line no-console
    console.warn('[installations]', url, 'failed', { status: res.status, rawMessage, approxBytes })
    throw new Error(friendly)
  }

  return json as { installation: Installation }
}

async function ensureSessionForInstallationsApi(): Promise<void> {
  if (isSupabaseConfigured() && typeof window !== 'undefined') {
    await waitForSessionReady()
  }
}

import { offlineDB } from '@/lib/data/offline-db'

export async function listInstallationsPaginated(
  params: ListInstallationsParams & { includeKpi?: boolean }
): Promise<{
  items: InstallationListItem[]
  total: number
  totalIsEstimate: boolean
  kpi?: InstallationsKpi
}> {
  assertSupabaseConfigured()
  await ensureSessionForInstallationsApi()
  
  try {
    const sp = new URLSearchParams()
    sp.set('limit', String(params.limit))
    sp.set('offset', String(params.offset))
    sp.set('countMode', 'planned')
    if (params.search) sp.set('search', params.search)
    if (params.status) sp.set('status', params.status)
    if (params.includeKpi) sp.set('includeKpi', '1')
    const headers = await buildAuthHeaders()
    const res = await fetch(`/api/installations/list?${sp.toString()}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(typeof json?.error === 'string' ? json.error : 'Could not load installations list')
    }
    const items = (json.items ?? []) as InstallationListItem[]
    if (items.length > 0 && typeof window !== 'undefined') {
      await offlineDB.putMany('installations', items, { silent: true })
    }

    const kpiRaw = json.kpi as Record<string, unknown> | undefined
    let surveyAssignment: InstallationsKpi['surveyAssignment']
    const sa = kpiRaw?.surveyAssignment as Record<string, unknown> | undefined
    if (
      sa &&
      typeof sa.assignedHouseholds === 'number' &&
      typeof sa.householdsWithInstallation === 'number' &&
      typeof sa.householdsPendingInstallation === 'number'
    ) {
      surveyAssignment = {
        assignedHouseholds: sa.assignedHouseholds,
        householdsWithInstallation: sa.householdsWithInstallation,
        householdsPendingInstallation: sa.householdsPendingInstallation,
      }
    }
    const kpi: InstallationsKpi | undefined =
      kpiRaw &&
      typeof kpiRaw.total === 'number' &&
      typeof kpiRaw.pending === 'number' &&
      typeof kpiRaw.inProgress === 'number' &&
      typeof kpiRaw.completed === 'number' &&
      typeof kpiRaw.inspectionPending === 'number'
        ? {
            total: kpiRaw.total,
            pending: kpiRaw.pending,
            inProgress: kpiRaw.inProgress,
            completed: kpiRaw.completed,
            inspectionPending: kpiRaw.inspectionPending,
            ...(surveyAssignment ? { surveyAssignment } : {}),
          }
        : undefined
    return {
      items,
      total: typeof json.total === 'number' ? json.total : 0,
      totalIsEstimate: Boolean(json.totalIsEstimate),
      kpi,
    }
  } catch (err) {
    const allLocal = await offlineDB.getAll('installations')
    if (allLocal.length > 0) {
      const { items, total } = filterInstallationsLocally(allLocal, params)
      const localKpi = params.includeKpi ? calculateLocalInstallationsKpi(allLocal) : undefined
      return {
        items,
        total,
        totalIsEstimate: false,
        kpi: localKpi,
      }
    }
    throw err
  }
}

function filterInstallationsLocally(
  items: any[],
  params: ListInstallationsParams
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
      (item.beneficiaryName ?? '').toLowerCase().includes(term) ||
      (item.serviceNo ?? '').toLowerCase().includes(term) ||
      (item.id ?? '').toLowerCase().includes(term) ||
      (item.aadharNo ?? '').toLowerCase().includes(term) ||
      (item.mobile ?? '').toLowerCase().includes(term) ||
      (item.consumerName ?? '').toLowerCase().includes(term)
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

function calculateLocalInstallationsKpi(items: any[]): InstallationsKpi {
  const total = items.length
  const pending = items.filter(i => i.status === 'pending').length
  const inProgress = items.filter(i => i.status === 'in_progress' || i.status === 'in-progress').length
  const completed = items.filter(i => i.status === 'completed').length
  const inspectionPending = items.filter(i => i.status === 'inspection_pending' || i.status === 'inspection-pending').length
  
  return {
    total,
    pending,
    inProgress,
    completed,
    inspectionPending,
  }
}

export async function getInstallationsExactTotal(
  params: Pick<ListInstallationsParams, 'search' | 'status'>
): Promise<number> {
  assertSupabaseConfigured()
  await ensureSessionForInstallationsApi()
  try {
    const sp = new URLSearchParams()
    sp.set('countOnly', '1')
    sp.set('countMode', 'exact')
    if (params.search) sp.set('search', params.search)
    if (params.status) sp.set('status', params.status)
    const headers = await buildAuthHeaders()
    const res = await fetch(`/api/installations/list?${sp.toString()}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(typeof json?.error === 'string' ? json.error : 'Could not load installations total')
    }
    return typeof json.total === 'number' ? json.total : 0
  } catch (err) {
    const allLocal = await offlineDB.getAll('installations')
    const { total } = filterInstallationsLocally(allLocal, {
      ...params,
      limit: 100000,
      offset: 0,
    })
    return total
  }
}

export async function getInstallationsKpi(): Promise<InstallationsKpi> {
  assertSupabaseConfigured()
  await ensureSessionForInstallationsApi()
  try {
    const headers = await buildAuthHeaders()
    const res = await fetch('/api/installations/kpi', { method: 'GET', headers, cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(typeof json?.error === 'string' ? json.error : 'Could not load installations KPI')
    }
    return {
      total: typeof json.total === 'number' ? json.total : 0,
      pending: typeof json.pending === 'number' ? json.pending : 0,
      inProgress: typeof json.inProgress === 'number' ? json.inProgress : 0,
      completed: typeof json.completed === 'number' ? json.completed : 0,
      inspectionPending: typeof json.inspectionPending === 'number' ? json.inspectionPending : 0,
    }
  } catch (err) {
    const allLocal = await offlineDB.getAll('installations')
    return calculateLocalInstallationsKpi(allLocal)
  }
}

export async function listInstallations(): Promise<Installation[]> {
  const local = typeof window !== 'undefined' ? await offlineDB.getAll('installations') : []

  if (typeof window !== 'undefined' && navigator.onLine) {
    const fetchPromise = supabase.listInstallationsFromSupabase()
      .then(async (list) => {
        await offlineDB.putMany('installations', list, { silent: true })
        return list
      })
      .catch((err) => {
        console.warn('Background sync listInstallations failed:', err)
        return local
      })

    if (local.length === 0) {
      return fetchPromise
    }
  }

  return local
}

export async function getInstallationById(id: string): Promise<Installation | undefined> {
  const local = typeof window !== 'undefined' ? await offlineDB.getOne('installations', id) : undefined

  if (typeof window !== 'undefined' && navigator.onLine) {
    const fetchPromise = supabase.getInstallationByIdFromSupabase(id)
      .then(async (one) => {
        if (one) {
          await offlineDB.putOne('installations', one)
        }
        return one
      })
      .catch((err) => {
        console.warn('Background sync getInstallationById failed:', err)
        return local
      })

    if (!local) {
      return fetchPromise
    }
  }

  return local
}

export async function getInstallationBySurveyId(surveyId: string): Promise<Installation | undefined> {
  const local = typeof window !== 'undefined' ? (await offlineDB.getAll('installations')).find(i => i.surveyId === surveyId) : undefined

  if (typeof window !== 'undefined' && navigator.onLine) {
    const fetchPromise = supabase.getInstallationBySurveyIdFromSupabase(surveyId)
      .then(async (one) => {
        if (one) {
          await offlineDB.putOne('installations', one)
        }
        return one
      })
      .catch((err) => {
        console.warn('Background sync getInstallationBySurveyId failed:', err)
        return local
      })

    if (!local) {
      return fetchPromise
    }
  }

  return local
}

export async function createInstallation(
  input: CreateInstallationInput,
  payload: { materials: Material[]; photos: InstallationPhotoMeta[] },
  photoFiles?: Record<string, File>,
  materialPhotoFiles?: Record<string, File>,
  signatureFile?: Blob | File | null
): Promise<Installation> {
  const id = crypto.randomUUID()
  const localInstallation: Installation = {
    id,
    surveyId: input.surveyId,
    projectId: ACTIVE_PROJECT_ID,
    status: 'pending',
    materials: payload.materials,
    photos: payload.photos,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _syncStatus: 'pending-create',
  } as any

  // Save files locally
  if (photoFiles) {
    for (const [pid, file] of Object.entries(photoFiles)) {
      if (file) {
        await offlineDB.saveOfflineFile(`${id}_photo_${pid}`, file, file.name, file.type)
      }
    }
  }
  if (materialPhotoFiles) {
    for (const [key, file] of Object.entries(materialPhotoFiles)) {
      if (file) {
        const matId = key.replace('file_mat_', '').replace('_photo', '')
        await offlineDB.saveOfflineFile(`${id}_mat_${matId}`, file, file.name, file.type)
      }
    }
  }
  if (signatureFile && signatureFile.size > 0) {
    await offlineDB.saveOfflineFile(`${id}_signature`, signatureFile, 'signature.png', signatureFile.type || 'image/png')
  }

  await offlineDB.putOne('installations', localInstallation)

  await offlineDB.addMutation({
    storeName: 'installations',
    action: 'CREATE',
    entityId: id,
    payload: { input, payload }
  })

  if (typeof window !== 'undefined' && navigator.onLine) {
    processSyncQueue()
  }

  return localInstallation
}

export async function updateInstallation(
  id: string,
  input: CreateInstallationInput,
  payload: { materials: Material[]; photos: InstallationPhotoMeta[] },
  photoFiles?: Record<string, File>,
  materialPhotoFiles?: Record<string, File>,
  signatureFile?: Blob | File | null
): Promise<Installation> {
  const existing = await offlineDB.getOne('installations', id)
  const localInstallation: Installation = {
    ...existing,
    materials: payload.materials,
    photos: payload.photos,
    updatedAt: new Date().toISOString(),
    _syncStatus: existing?._syncStatus === 'pending-create' ? 'pending-create' : 'pending-update',
  } as any

  // Save files locally
  if (photoFiles) {
    for (const [pid, file] of Object.entries(photoFiles)) {
      if (file) {
        await offlineDB.saveOfflineFile(`${id}_photo_${pid}`, file, file.name, file.type)
      }
    }
  }
  if (materialPhotoFiles) {
    for (const [key, file] of Object.entries(materialPhotoFiles)) {
      if (file) {
        const matId = key.replace('file_mat_', '').replace('_photo', '')
        await offlineDB.saveOfflineFile(`${id}_mat_${matId}`, file, file.name, file.type)
      }
    }
  }
  if (signatureFile && signatureFile.size > 0) {
    await offlineDB.saveOfflineFile(`${id}_signature`, signatureFile, 'signature.png', signatureFile.type || 'image/png')
  }

  await offlineDB.putOne('installations', localInstallation)

  await offlineDB.addMutation({
    storeName: 'installations',
    action: 'UPDATE',
    entityId: id,
    payload: { input, payload }
  })

  if (typeof window !== 'undefined' && navigator.onLine) {
    processSyncQueue()
  }

  return localInstallation
}

export async function updateInstallationStatus(id: string, status: Installation['status']): Promise<Installation> {
  const existing = await offlineDB.getOne('installations', id)
  const localInstallation: Installation = {
    ...existing,
    status,
    _syncStatus: existing?._syncStatus === 'pending-create' ? 'pending-create' : 'pending-update',
  } as any

  await offlineDB.putOne('installations', localInstallation)

  await offlineDB.addMutation({
    storeName: 'installations',
    action: 'STATUS',
    entityId: id,
    payload: { status }
  })

  if (typeof window !== 'undefined' && navigator.onLine) {
    processSyncQueue()
  }

  return localInstallation
}
