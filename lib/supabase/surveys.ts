/**
 * Supabase-backed surveys CRUD. Maps DB rows to app Survey type.
 * Survey file uploads are stored in Supabase Storage (bucket: solar_bucket).
 */
import type { Database } from '@/lib/supabase/database.types'
import { ACTIVE_PROJECT_ID } from '@/lib/data/active-project'
import type {
  Survey,
  CreateSurveyInput,
  SurveyUploadKeys,
  FileMeta,
  SurveyActivityEvent,
} from '@/lib/store/surveys'
import type { InstallationStatus } from '@/lib/store/installations'
import type { Role } from '@/lib/rbac'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

// Bypass Supabase v2 complex generic type inference to prevent `never` types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function q(client: any): { from: (table: string) => any } {
  return client as unknown as { from: (table: string) => any }
}


const SURVEY_UPLOADS_BUCKET = 'solar_bucket'

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

/** Upload a file to solar_bucket and return public URL. Path: {surveyId}/{key}_{filename} */
async function uploadSurveyFile(
  surveyId: string,
  key: SurveyUploadKeys,
  file: File
): Promise<string> {
  const supabase = getSupabaseBrowserClient()
  const fileName = sanitizeFileName(file.name)
  const path = `${surveyId}/${key}_${fileName}`
  const contentType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg'
  const { error } = await supabase.storage.from(SURVEY_UPLOADS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType,
  })
  if (error) {
    throw new Error('Image upload failed: ' + error.message + '. Ensure storage bucket solar_bucket exists and allows uploads.')
  }
  const { data } = supabase.storage.from(SURVEY_UPLOADS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

function normalizeUploadsFromRow(raw: unknown): Partial<Record<SurveyUploadKeys, FileMeta>> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Partial<Record<SurveyUploadKeys, FileMeta>> = {}
  const keys: SurveyUploadKeys[] = ['aadhaarCard', 'panCard', 'bankProof', 'eBill', 'beneficiaryPhoto', 'siteLayout', 'roofTerraceNorth', 'roofTerraceSouth', 'earthingAreaPic', 'inverterAreaPic']
  for (const k of keys) {
    const v = (raw as Record<string, unknown>)[k]
    if (!v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name : undefined
    if (name == null) continue
    const type = typeof o.type === 'string' ? o.type : 'application/octet-stream'
    const size = typeof o.size === 'number' ? o.size : 0
    const url = typeof o.url === 'string' ? o.url : undefined
    out[k] = url ? { name, type, size, url } : { name, type, size }
  }
  return out
}

/** Ensure uploads meta include URLs for any uploaded files. Throws if upload fails so user sees error. Exported for edit page (server-action flow). */
export async function ensureUploadUrls(
  surveyId: string,
  meta: Partial<Record<SurveyUploadKeys, FileMeta>>,
  uploadFiles: Partial<Record<SurveyUploadKeys, File>> | undefined
): Promise<Partial<Record<SurveyUploadKeys, FileMeta>>> {
  if (!uploadFiles || Object.keys(uploadFiles).length === 0) return meta ?? {}
  const result = { ...(meta ?? {}) }
  for (const k of Object.keys(uploadFiles) as SurveyUploadKeys[]) {
    const file = uploadFiles[k]
    if (!file) continue
    const url = await uploadSurveyFile(surveyId, k, file)
    result[k] = { name: file.name, type: file.type, size: file.size, url }
  }
  return result
}

type SurveyRow = Database['public']['Tables']['surveys']['Row']

const INSTALLATION_STATUSES: ReadonlySet<string> = new Set([
  'pending',
  'in_progress',
  'completed',
  'inspection_pending',
])

/** PostgREST / Postgres: assignment list view not migrated yet. */
function isMissingSurveysAssignmentViewError(error: unknown): boolean {
  const e = error as { message?: string; code?: string; details?: string; hint?: string }
  const msg = `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''}`.toLowerCase()
  const code = e.code ?? ''
  if (code === 'PGRST205' || code === '42P01') return true
  if (msg.includes('surveys_with_latest_installation')) return true
  if (msg.includes('could not find') && (msg.includes('schema cache') || msg.includes('relation'))) return true
  return false
}

/** When the DB view is absent, attach latest installation per survey (same semantics as the view). */
async function mergeLatestInstallationsIntoSurveys(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  items: Survey[],
): Promise<Survey[]> {
  const ids = items.map((s) => s.id).filter(Boolean)
  if (ids.length === 0) return items
  const { data, error } = await q(supabase)
    .from('installations')
    .select('id, survey_id, status, created_at')
    .in('survey_id', ids)
  if (error) throw error
  type InstRow = { id: string; survey_id: string | null; status: string | null; created_at: string | null }
  const bestBySurvey = new Map<string, InstRow>()
  for (const r of (data ?? []) as InstRow[]) {
    if (!r.survey_id) continue
    const prev = bestBySurvey.get(r.survey_id)
    if (!prev) {
      bestBySurvey.set(r.survey_id, r)
      continue
    }
    const tNew = r.created_at ?? ''
    const tOld = prev.created_at ?? ''
    if (tNew > tOld || (tNew === tOld && (r.id ?? '') > (prev.id ?? ''))) {
      bestBySurvey.set(r.survey_id, r)
    }
  }
  return items.map((s) => {
    const li = bestBySurvey.get(s.id)
    if (!li) return s
    const rawInst = li.status
    const installationStatus =
      typeof rawInst === 'string' && INSTALLATION_STATUSES.has(rawInst)
        ? (rawInst as InstallationStatus)
        : undefined
    return { ...s, installationId: li.id, installationStatus }
  })
}

function assignmentViewRowToSurvey(row: unknown): Survey {
  const r = row as Record<string, unknown>
  const installationId =
    typeof r.installation_id === 'string' && r.installation_id.length > 0 ? r.installation_id : undefined
  const rawInst = r.installation_status
  const installationStatus =
    typeof rawInst === 'string' && INSTALLATION_STATUSES.has(rawInst)
      ? (rawInst as InstallationStatus)
      : undefined
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { installation_id: _iid, installation_status: _ist, ...rest } = r
  const base = rowToSurvey(rest as SurveyRow)
  return { ...base, installationId, installationStatus }
}

function rowToSurvey(row: SurveyRow): Survey {
  const siteLocation = (row.site_location ?? {}) as Record<string, string>
  const bankDetails = (row.bank_details ?? {}) as Record<string, string>
  const siteDetails = (row.site_details ?? {}) as Record<string, unknown>
  const uploads = normalizeUploadsFromRow(row.uploads)
  const activity = (row.activity ?? []) as SurveyActivityEvent[]
  return {
    id: row.id,
    projectId: row.project_id ?? undefined,
    beneficiaryName: row.beneficiary_name,
    serviceNo: row.service_no,
    aadharNo: row.aadhar_no,
    mobile: row.mobile ?? undefined,
    panNo: row.pan_no ?? '',
    contractedLoad: row.contracted_load ?? undefined,
    status: row.status,
    uploadDate: row.upload_date,
    updatedAt: row.updated_at ?? undefined,
    approvedDate: row.approved_date ?? undefined,
    submittedById: row.submitted_by_id ?? undefined,
    submittedAt: row.submitted_at,
    installerId: row.installer_id ?? undefined,
    discomName: row.discom_name,
    plantType: row.plant_type as Survey['plantType'],
    buildingHeight: Number(row.building_height ?? 0),
    totalRoofs: row.total_roofs,
    roofType: row.roof_type,
    siteDetails: Object.keys(siteDetails).length ? (siteDetails as Survey['siteDetails']) : undefined,
    siteLocation: {
      section: siteLocation?.section,
      subDivision: siteLocation?.subDivision ?? siteLocation?.sub_division,
      division: siteLocation?.division,
      circle: siteLocation?.circle,
      address: siteLocation?.address,
      mandal: siteLocation?.mandal,
      village: siteLocation?.village,
      district: siteLocation?.district,
      pinCode: siteLocation?.pinCode ?? siteLocation?.pin_code,
      state: siteLocation?.state,
      city: siteLocation?.city,
      latitude: siteLocation?.latitude,
      longitude: siteLocation?.longitude,
      electricityConsumerNo: siteLocation?.electricityConsumerNo ?? siteLocation?.electricity_consumer_no,
      connectionType: (siteLocation?.connectionType ?? siteLocation?.connection_type) as Survey['siteLocation']['connectionType'],
      phase: siteLocation?.phase as Survey['siteLocation']['phase'],
      sanctionedLoadKw: siteLocation?.sanctionedLoadKw ?? siteLocation?.sanctioned_load_kw,
      avgMonthlyBillRupees: siteLocation?.avgMonthlyBillRupees ?? siteLocation?.avg_monthly_bill_rupees,
    },
    bankDetails: {
      bankName: bankDetails?.bankName ?? bankDetails?.bank_name,
      accountNo: bankDetails?.accountNo ?? bankDetails?.account_no,
      ifsc: bankDetails?.ifsc,
      branch: bankDetails?.branch,
    },
    remarks: row.remarks ?? undefined,
    uploads,
    activity,
    createdAt: row.created_at,
  }
}

/** Full table scan for ID generation and duplicate checks on create/update only. */
async function loadAllSurveysForMutations(): Promise<Survey[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await q(supabase).from('surveys').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToSurvey)
}

/** Escape value for use in ilike pattern (%, _) */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export async function listSurveysFromSupabase(): Promise<Survey[]> {
  const supabase = getSupabaseBrowserClient()
  const scoped = await q(supabase)
    .from('surveys')
    .select('*')
    .eq('project_id', ACTIVE_PROJECT_ID)
    .order('created_at', { ascending: false })
  if (scoped.error) throw scoped.error
  if ((scoped.data ?? []).length > 0) return (scoped.data ?? []).map(rowToSurvey)

  // Fallback for legacy deployments where survey rows may not be project-scoped.
  const { data, error } = await q(supabase).from('surveys').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToSurvey)
}

/** Case-insensitive exact match; escapes ILIKE wildcards in user input. */
export async function isServiceNoTakenGlobally(
  serviceNo: string,
  excludeSurveyId?: string
): Promise<boolean> {
  const term = serviceNo.trim()
  if (!term) return false
  const pattern = escapeIlike(term)
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await q(supabase).from('surveys').select('id').ilike('service_no', pattern)
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).some((r: any) => r.id !== excludeSurveyId)
}

export async function isAadharTakenGlobally(aadhar: string, excludeSurveyId?: string): Promise<boolean> {
  const v = aadhar.trim()
  if (!v) return false
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await q(supabase).from('surveys').select('id').eq('aadhar_no', v)
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).some((r: any) => r.id !== excludeSurveyId)
}

/** Sentinel: surveys with no installer assigned (stored as this string in queries). */
export const SURVEYS_INSTALLER_FILTER_UNASSIGNED = '__unassigned__' as const

/** Sentinel: assignment list — household has no installation row yet. */
export const SURVEYS_INSTALLATION_FILTER_NONE = '__no_installation__' as const

/** Sentinel: assignment list — household has any installation row (i.e. installation started). */
export const SURVEYS_INSTALLATION_FILTER_ANY = '__has_installation__' as const

export type ListSurveysPaginatedParams = {
  limit: number
  offset: number
  search?: string
  section?: string
  subDivision?: string
  status?: string
  feasibility?: string
  /** '' or omit = all surveys; SURVEYS_INSTALLER_FILTER_UNASSIGNED = no installer; else profile id USR-* */
  installerFilter?: string
  /** Default `surveys` table; `assignment` uses `surveys_with_latest_installation` view. */
  listSource?: 'surveys' | 'assignment'
  /** When listSource is assignment: filter by latest installation status, or SURVEYS_INSTALLATION_FILTER_NONE. */
  installationStatus?: string
}

export async function listSurveysFromSupabasePaginated(
  params: ListSurveysPaginatedParams
): Promise<{ items: Survey[]; total: number }> {
  const {
    limit,
    offset,
    search,
    section,
    subDivision,
    status,
    feasibility,
    installerFilter,
    listSource = 'surveys',
    installationStatus,
  } = params
  const supabase = getSupabaseBrowserClient()

  const buildQuery = (scopeToActiveProject: boolean, fromTable: string, applyInstallationFilters: boolean) => {
    let query = q(supabase)
      .from(fromTable)
      .select('*', { count: 'exact', head: false })
      .order('created_at', { ascending: false })
    if (scopeToActiveProject) query = query.eq('project_id', ACTIVE_PROJECT_ID)

    const inst = (installerFilter ?? '').trim()
    if (inst === SURVEYS_INSTALLER_FILTER_UNASSIGNED) {
      query = query.is('installer_id', null)
    } else if (inst) {
      query = query.eq('installer_id', inst)
    }

    if (listSource === 'assignment' && applyInstallationFilters) {
      const isf = (installationStatus ?? '').trim()
      if (isf === SURVEYS_INSTALLATION_FILTER_NONE) {
        query = query.is('installation_id', null)
      } else if (isf === SURVEYS_INSTALLATION_FILTER_ANY) {
        query = query.not('installation_id', 'is', null)
      } else if (isf) {
        query = query.eq('installation_status', isf)
      }
    }

    if (search && search.trim()) {
      const term = escapeIlike(search.trim())
      const pattern = `%${term}%`
      query = query.or(
        `beneficiary_name.ilike.${pattern},service_no.ilike.${pattern},id.ilike.${pattern},aadhar_no.ilike.${pattern},pan_no.ilike.${pattern},mobile.ilike.${pattern},site_location->>electricityConsumerNo.ilike.${pattern},site_location->>electricity_consumer_no.ilike.${pattern}`
      )
    }

    if (section?.trim()) {
      query = query.filter('site_location->>section', 'eq', section.trim())
    }
    if (subDivision?.trim()) {
      query = query.filter('site_location->>subDivision', 'eq', subDivision.trim())
    }
    if (status?.trim()) {
      query = query.eq('status', status.trim())
    }
    if (feasibility?.trim()) {
      if (feasibility === 'pending') {
        query = query.or('site_details->>overallFeasibility.is.null,site_details.is.null')
      } else {
        query = query.filter('site_details->>overallFeasibility', 'eq', feasibility.trim())
      }
    }
    return query
  }

  const mapRows = (fromTable: string, rows: unknown[]): Survey[] =>
    fromTable === 'surveys_with_latest_installation'
      ? rows.map((row) => assignmentViewRowToSurvey(row))
      : rows.map((row) => rowToSurvey(row as SurveyRow))

  let fromTable = listSource === 'assignment' ? 'surveys_with_latest_installation' : 'surveys'
  let applyInstallationFilters = listSource === 'assignment'
  let enrichInstallations = false

  let scopedResult = await buildQuery(true, fromTable, applyInstallationFilters).range(offset, offset + limit - 1)
  if (
    scopedResult.error &&
    listSource === 'assignment' &&
    isMissingSurveysAssignmentViewError(scopedResult.error)
  ) {
    if ((installationStatus ?? '').trim()) {
      throw new Error(
        'Installation status filtering requires the surveys_with_latest_installation view. Apply database migration 00028_surveys_with_latest_installation.sql, then refresh.',
      )
    }
    fromTable = 'surveys'
    applyInstallationFilters = false
    enrichInstallations = true
    scopedResult = await buildQuery(true, fromTable, applyInstallationFilters).range(offset, offset + limit - 1)
  }
  if (scopedResult.error) throw scopedResult.error

  let scopedItems = mapRows(fromTable, scopedResult.data ?? [])
  if (enrichInstallations) scopedItems = await mergeLatestInstallationsIntoSurveys(supabase, scopedItems)
  if ((scopedResult.count ?? 0) > 0 || scopedItems.length > 0 || Boolean(search?.trim())) {
    return { items: scopedItems, total: scopedResult.count ?? scopedItems.length }
  }

  // Fallback for legacy deployments where survey rows may not be project-scoped.
  const { data, error, count } = await buildQuery(false, fromTable, applyInstallationFilters).range(
    offset,
    offset + limit - 1,
  )
  if (error) throw error
  let items = mapRows(fromTable, data ?? [])
  if (enrichInstallations) items = await mergeLatestInstallationsIntoSurveys(supabase, items)
  return { items, total: count ?? items.length }
}

export async function getSurveyByIdFromSupabase(id: string): Promise<Survey | undefined> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await q(supabase).from('surveys').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? rowToSurvey(data) : undefined
}

function nextSurveyId(existing: Survey[]): string {
  const nums = existing.map((s) => parseInt(s.id.replace(/^SUR-/, ''), 10)).filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `SUR-${(max + 1).toString().padStart(3, '0')}`
}

export async function createSurveyInSupabase(
  input: CreateSurveyInput,
  uploads: Partial<Record<SurveyUploadKeys, FileMeta>>,
  siteDetails: Survey['siteDetails'] | undefined,
  submittedById?: string,
  uploadFiles?: Partial<Record<SurveyUploadKeys, File>>
): Promise<Survey> {
  const supabase = getSupabaseBrowserClient()
  const existing = await loadAllSurveysForMutations()
  const serviceNoNorm = input.serviceNo.trim().toLowerCase()
  const duplicate = existing.find((s) => (s.serviceNo ?? '').trim().toLowerCase() === serviceNoNorm)
  if (duplicate) throw new Error('Service number is already used by another survey. Please use a unique service number.')
  const id = nextSurveyId(existing)
  const uploadsWithUrls = await ensureUploadUrls(id, uploads ?? {}, uploadFiles)
  const now = new Date().toISOString()
  const panNo = (input.panNo ?? '').toString().trim()
  const bank = input.bankDetails
  const bankEmpty = !bank?.bankName?.trim() && !bank?.accountNo?.trim() && !bank?.ifsc?.trim()
  const row = {
    id,
    project_id: input.projectId ?? ACTIVE_PROJECT_ID,
    beneficiary_name: input.beneficiaryName,
    service_no: input.serviceNo,
    aadhar_no: input.aadharNo,
    mobile: input.mobile ?? null,
    pan_no: panNo ? panNo.toUpperCase() : null,
    contracted_load: input.contractedLoad ?? null,
    discom_name: input.discomName,
    plant_type: input.plantType ?? 'On Grid',
    building_height: input.buildingHeight != null ? input.buildingHeight : null,
    total_roofs: input.totalRoofs,
    roof_type: input.roofType,
    site_location: input.siteLocation,
    bank_details: bankEmpty
      ? null
      : {
          bankName: bank?.bankName ?? '',
          accountNo: bank?.accountNo ?? '',
          ifsc: (bank?.ifsc ?? '').toString().toUpperCase(),
          branch: bank?.branch ?? '',
        },
    site_details: siteDetails ?? null,
    uploads: uploadsWithUrls,
    submitted_by_id: submittedById ?? null,
    remarks: input.remarks ?? null,
    submitted_at: now,
    upload_date: now,
    activity: [{ at: now, actorId: submittedById, action: 'submitted', message: 'Survey submitted' }],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await q(supabase).from('surveys').insert(row as any).select().single()
  if (error) throw error
  return rowToSurvey(data as any)
}

export async function updateSurveyInSupabase(
  id: string,
  input: CreateSurveyInput,
  uploads: Partial<Record<SurveyUploadKeys, FileMeta>>,
  siteDetails: Survey['siteDetails'] | undefined,
  submittedById?: string,
  uploadFiles?: Partial<Record<SurveyUploadKeys, File>>
): Promise<Survey> {
  const supabase = getSupabaseBrowserClient()
  const existing = await loadAllSurveysForMutations()
  const serviceNoNorm = input.serviceNo.trim().toLowerCase()
  const duplicate = existing.find((s) => s.id !== id && (s.serviceNo ?? '').trim().toLowerCase() === serviceNoNorm)
  if (duplicate) throw new Error('Service number is already used by another survey. Please use a unique service number.')
  const uploadsWithUrls = await ensureUploadUrls(id, uploads ?? {}, uploadFiles)
  const now = new Date().toISOString()
  const panNo = (input.panNo ?? '').toString().trim()
  const bank = input.bankDetails
  const bankEmpty = !bank?.bankName?.trim() && !bank?.accountNo?.trim() && !bank?.ifsc?.trim()
  const updates: Record<string, unknown> = {
    beneficiary_name: input.beneficiaryName,
    service_no: input.serviceNo,
    aadhar_no: input.aadharNo,
    mobile: input.mobile ?? null,
    pan_no: panNo ? panNo.toUpperCase() : null,
    contracted_load: input.contractedLoad ?? null,
    discom_name: input.discomName,
    plant_type: input.plantType ?? 'On Grid',
    building_height: input.buildingHeight != null ? input.buildingHeight : null,
    total_roofs: input.totalRoofs,
    roof_type: input.roofType,
    site_location: input.siteLocation,
    bank_details: bankEmpty
      ? null
      : {
          bankName: bank?.bankName ?? '',
          accountNo: bank?.accountNo ?? '',
          ifsc: (bank?.ifsc ?? '').toString().toUpperCase(),
          branch: bank?.branch ?? '',
        },
    site_details: siteDetails ?? null,
    uploads: uploadsWithUrls,
    submitted_by_id: submittedById ?? null,
    remarks: input.remarks ?? null,
  }
  const { data: current } = await q(supabase).from('surveys').select('activity').eq('id', id).single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentRow = current as any
  const activity = [...((currentRow?.activity ?? []) as SurveyActivityEvent[]), { at: now, actorId: submittedById, action: 'edited' as const, message: 'Survey updated' }]
  updates.activity = activity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await q(supabase).from('surveys').update(updates as any).eq('id', id).select().single()
  if (error) throw error
  return rowToSurvey(data as any)
}

export async function updateSurveyStatusInSupabase(id: string, status: Survey['status']): Promise<Survey> {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Unauthorized: sign in required')
  const { data: actorProfile, error: actorErr } = await q(supabase).from('profiles').select('role').eq('auth_user_id', user.id).maybeSingle()
  if (actorErr) throw actorErr
  const actorRole = (actorProfile?.role ?? '') as Role
  if (!['admin', 'manager', 'supervisor'].includes(actorRole)) {
    throw new Error('Forbidden: only supervisor/manager/admin can change survey status')
  }

  const { data: current, error: fetchErr } = await q(supabase).from('surveys').select('*').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr || new Error('Survey not found')
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentSurvey = current as any
  const activity = [...((currentSurvey.activity ?? []) as SurveyActivityEvent[]), { at: now, action: 'status_changed', message: `Status changed to ${status}`, meta: { status } }]
  const updates: Record<string, unknown> = { status, activity }
  if (status === 'approved' || status === 'completed') {
    updates.approved_date = currentSurvey.approved_date ?? now
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await q(supabase).from('surveys').update(updates as any).eq('id', id).select().single()
  if (error) throw error
  return rowToSurvey(data as any)
}

export async function assignSurveyInstallerInSupabase(id: string, installerId?: string): Promise<Survey> {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Unauthorized: sign in required')
  const { data: actorProfile, error: actorErr } = await q(supabase).from('profiles').select('role').eq('auth_user_id', user.id).maybeSingle()
  if (actorErr) throw actorErr
  const actorRole = (actorProfile?.role ?? '') as Role
  if (!['admin', 'manager', 'engineer', 'supervisor'].includes(actorRole)) {
    throw new Error('Forbidden: role cannot assign installer')
  }
  if (installerId) {
    const { data: installerProfile, error: installerErr } = await q(supabase)
      .from('profiles')
      .select('role')
      .eq('id', installerId)
      .maybeSingle()
    if (installerErr) throw installerErr
    if (installerProfile?.role !== 'installer') {
      throw new Error('Installer assignment requires a user with installer role')
    }
  }

  const { data: current, error: fetchErr } = await q(supabase).from('surveys').select('*').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr || new Error('Survey not found')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentSurvey2 = current as any
  if (currentSurvey2.status === 'completed') {
    throw new Error('Installer cannot be changed: household survey is completed.')
  }
  const { data: instLatest } = await q(supabase)
    .from('installations')
    .select('status')
    .eq('survey_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestSt = (instLatest as any[] | null)?.[0]?.status as string | undefined
  if (latestSt === 'completed') {
    throw new Error('Installer cannot be changed: installation is completed.')
  }
  const now = new Date().toISOString()
  const activity = [
    ...((currentSurvey2.activity ?? []) as SurveyActivityEvent[]),
    { at: now, action: 'installer_assigned', message: installerId ? `Installer assigned (${installerId})` : 'Installer unassigned', meta: { installerId: installerId ?? null } },
  ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await q(supabase).from('surveys').update({ installer_id: installerId ?? null, activity } as any).eq('id', id).select().single()
  if (error) throw error
  return rowToSurvey(data as any)
}

export async function appendSurveyActivityInSupabase(
  id: string,
  event: Omit<SurveyActivityEvent, 'at'> & { at?: string }
): Promise<Survey> {
  const supabase = getSupabaseBrowserClient()
  const { data: current, error: fetchErr } = await q(supabase).from('surveys').select('activity').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr || new Error('Survey not found')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentSurvey3 = current as any
  const at = event.at ?? new Date().toISOString()
  const activity = [...((currentSurvey3.activity ?? []) as SurveyActivityEvent[]), { ...event, at }]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await q(supabase).from('surveys').update({ activity } as any).eq('id', id).select().single()
  if (error) throw error
  return rowToSurvey(data as any)
}

export async function deleteSurveyFromSupabase(id: string): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await q(supabase).from('surveys').delete().eq('id', id)
  if (error) throw error
}
