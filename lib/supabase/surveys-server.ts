/**
 * Server-only survey update using service role (bypasses RLS).
 * Use when anon RLS blocks survey update (e.g. self-hosted Supabase).
 */
import type { Database } from '@/lib/supabase/database.types'
import type {
  Survey,
  CreateSurveyInput,
  SurveyUploadKeys,
  FileMeta,
  SurveyActivityEvent,
} from '@/lib/store/surveys'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const SURVEY_UPLOADS_BUCKET = 'solar_bucket'
const UPLOAD_KEYS: SurveyUploadKeys[] = ['aadhaarCard', 'panCard', 'bankProof', 'eBill', 'beneficiaryPhoto', 'siteLayout', 'roofTerraceNorth', 'roofTerraceSouth', 'earthingAreaPic', 'inverterAreaPic']

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

type SurveyRow = Database['public']['Tables']['surveys']['Row']

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
      district: siteLocation?.district,
      pinCode: siteLocation?.pinCode ?? siteLocation?.pin_code,
      state: siteLocation?.state,
      city: siteLocation?.city,
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

/**
 * Update survey using service role (bypasses RLS). Call from server only.
 * uploadsWithUrls must already have URLs filled (client does uploads first).
 */
export async function updateSurveyWithServiceRole(
  id: string,
  input: CreateSurveyInput,
  uploadsWithUrls: Partial<Record<SurveyUploadKeys, FileMeta>>,
  siteDetails: Survey['siteDetails'] | undefined,
  submittedById?: string
): Promise<Survey> {
  const supabase = createSupabaseServerClient({ useServiceRole: true })
  const { data: allSurveys } = await supabase.from('surveys').select('id, service_no')
  const serviceNoNorm = input.serviceNo.trim().toLowerCase()
  const duplicate = (allSurveys ?? []).find((r) => r.id !== id && (r.service_no ?? '').trim().toLowerCase() === serviceNoNorm)
  if (duplicate) throw new Error('Service number is already used by another survey. Please use a unique service number.')
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
  const { data: current, error: fetchErr } = await supabase.from('surveys').select('activity').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr ?? new Error('Survey not found')
  const activity = [...((current.activity ?? []) as SurveyActivityEvent[]), { at: now, actorId: submittedById, action: 'edited' as const, message: 'Survey updated' }]
  updates.activity = activity
  const { data, error } = await supabase.from('surveys').update(updates).eq('id', id).select().single()
  if (error) throw error
  return rowToSurvey(data)
}

/** Get next survey id (SUR-001, SUR-002, ...) using service role. */
export async function getNextSurveyId(): Promise<string> {
  const supabase = createSupabaseServerClient({ useServiceRole: true })
  const { data: rows } = await supabase.from('surveys').select('id')
  const ids = (rows ?? []).map((r) => r.id)
  const nums = ids.map((id) => parseInt(id.replace(/^SUR-/, ''), 10)).filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `SUR-${(max + 1).toString().padStart(3, '0')}`
}

/**
 * Create survey using service role (bypasses RLS). Call from server only.
 * uploadsWithUrls must already have URLs filled (e.g. from buildUploadsFromFormData).
 */
export async function createSurveyWithServiceRole(
  id: string,
  input: CreateSurveyInput,
  uploadsWithUrls: Partial<Record<SurveyUploadKeys, FileMeta>>,
  siteDetails: Survey['siteDetails'] | undefined,
  submittedById?: string
): Promise<Survey> {
  const supabase = createSupabaseServerClient({ useServiceRole: true })
  const { data: allSurveys } = await supabase.from('surveys').select('id, service_no')
  const serviceNoNorm = input.serviceNo.trim().toLowerCase()
  const duplicate = (allSurveys ?? []).find((r) => (r.service_no ?? '').trim().toLowerCase() === serviceNoNorm)
  if (duplicate) throw new Error('Service number is already used by another survey. Please use a unique service number.')
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

/** Upload one file to storage using service role (bypasses storage RLS). */
async function uploadSurveyFileServer(
  surveyId: string,
  key: SurveyUploadKeys,
  file: Blob | File,
  fileName: string
): Promise<string> {
  const supabase = createSupabaseServerClient({ useServiceRole: true })
  const path = `${surveyId}/${key}_${sanitizeFileName(fileName)}`
  const { error } = await supabase.storage.from(SURVEY_UPLOADS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  })
  if (error) throw error
  const { data } = supabase.storage.from(SURVEY_UPLOADS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Build uploadsWithUrls from FormData: use meta for existing, upload new files with service role.
 */
export async function buildUploadsFromFormData(
  surveyId: string,
  formData: FormData
): Promise<Partial<Record<SurveyUploadKeys, FileMeta>>> {
  const metaJson = formData.get('meta')
  const meta: Partial<Record<SurveyUploadKeys, FileMeta>> =
    typeof metaJson === 'string' ? (JSON.parse(metaJson) as Partial<Record<SurveyUploadKeys, FileMeta>>) : {}
  const result = { ...meta }
  for (const key of UPLOAD_KEYS) {
    const file = formData.get(`file_${key}`)
    if (file instanceof Blob && file.size > 0) {
      const name = file instanceof File ? file.name : `upload_${key}`
      const url = await uploadSurveyFileServer(surveyId, key, file, name)
      result[key] = { name, type: file.type || 'application/octet-stream', size: file.size, url }
    }
  }
  return result
}
