/**
 * Supabase-backed surveys CRUD. Maps DB rows to app Survey type.
 * Survey file uploads are stored in Supabase Storage (bucket: solar_bucket).
 */
import type { Database } from '@/lib/supabase/database.types'
import type {
  Survey,
  CreateSurveyInput,
  SurveyUploadKeys,
  FileMeta,
  SurveyActivityEvent,
} from '@/lib/store/surveys'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

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
    plantType: row.plant_type,
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
      connectionType: siteLocation?.connectionType ?? siteLocation?.connection_type,
      phase: siteLocation?.phase,
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

export async function listSurveysFromSupabase(): Promise<Survey[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.from('surveys').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToSurvey)
}

/** Escape value for use in ilike pattern (%, _) */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
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

export async function listSurveysFromSupabasePaginated(
  params: ListSurveysPaginatedParams
): Promise<{ items: Survey[]; total: number }> {
  const { limit, offset, search, section, subDivision, status, feasibility } = params
  const supabase = getSupabaseBrowserClient()
  let query = supabase
    .from('surveys')
    .select('*', { count: 'exact', head: false })
    .order('created_at', { ascending: false })

  if (search && search.trim()) {
    const term = escapeIlike(search.trim())
    const pattern = `%${term}%`
    query = query.or(
      `beneficiary_name.ilike.${pattern},service_no.ilike.${pattern},id.ilike.${pattern},aadhar_no.ilike.${pattern},pan_no.ilike.${pattern},mobile.ilike.${pattern}`
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

  const { data, error, count } = await query.range(offset, offset + limit - 1)
  if (error) throw error
  const items = (data ?? []).map(rowToSurvey)
  return { items, total: count ?? items.length }
}

export async function getSurveyByIdFromSupabase(id: string): Promise<Survey | undefined> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.from('surveys').select('*').eq('id', id).maybeSingle()
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
  const existing = await listSurveysFromSupabase()
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
  const { data, error } = await supabase.from('surveys').insert(row).select().single()
  if (error) throw error
  return rowToSurvey(data)
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
  const existing = await listSurveysFromSupabase()
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
  const { data: current } = await supabase.from('surveys').select('activity').eq('id', id).single()
  const activity = [...((current?.activity ?? []) as SurveyActivityEvent[]), { at: now, actorId: submittedById, action: 'edited' as const, message: 'Survey updated' }]
  updates.activity = activity
  const { data, error } = await supabase.from('surveys').update(updates).eq('id', id).select().single()
  if (error) throw error
  return rowToSurvey(data)
}

export async function updateSurveyStatusInSupabase(id: string, status: Survey['status']): Promise<Survey> {
  const supabase = getSupabaseBrowserClient()
  const { data: current, error: fetchErr } = await supabase.from('surveys').select('*').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr || new Error('Survey not found')
  const now = new Date().toISOString()
  const activity = [...((current.activity ?? []) as SurveyActivityEvent[]), { at: now, action: 'status_changed', message: `Status changed to ${status}`, meta: { status } }]
  const updates: Record<string, unknown> = { status, activity }
  if (status === 'approved' || status === 'completed') {
    updates.approved_date = current.approved_date ?? now
  }
  const { data, error } = await supabase.from('surveys').update(updates).eq('id', id).select().single()
  if (error) throw error
  return rowToSurvey(data)
}

export async function assignSurveyInstallerInSupabase(id: string, installerId?: string): Promise<Survey> {
  const supabase = getSupabaseBrowserClient()
  const { data: current, error: fetchErr } = await supabase.from('surveys').select('*').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr || new Error('Survey not found')
  const now = new Date().toISOString()
  const activity = [
    ...((current.activity ?? []) as SurveyActivityEvent[]),
    { at: now, action: 'installer_assigned', message: installerId ? `Installer assigned (${installerId})` : 'Installer unassigned', meta: { installerId: installerId ?? null } },
  ]
  const { data, error } = await supabase.from('surveys').update({ installer_id: installerId ?? null, activity }).eq('id', id).select().single()
  if (error) throw error
  return rowToSurvey(data)
}

export async function appendSurveyActivityInSupabase(
  id: string,
  event: Omit<SurveyActivityEvent, 'at'> & { at?: string }
): Promise<Survey> {
  const supabase = getSupabaseBrowserClient()
  const { data: current, error: fetchErr } = await supabase.from('surveys').select('activity').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr || new Error('Survey not found')
  const at = event.at ?? new Date().toISOString()
  const activity = [...((current.activity ?? []) as SurveyActivityEvent[]), { ...event, at }]
  const { data, error } = await supabase.from('surveys').update({ activity }).eq('id', id).select().single()
  if (error) throw error
  return rowToSurvey(data)
}

export async function deleteSurveyFromSupabase(id: string): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from('surveys').delete().eq('id', id)
  if (error) throw error
}
