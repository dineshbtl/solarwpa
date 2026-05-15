/**
 * Supabase-backed installations CRUD. Maps DB rows to app Installation type.
 */
import type { Database } from '@/lib/supabase/database.types'
import { ACTIVE_PROJECT_ID } from '@/lib/data/active-project'
import {
  createInstallationWizardDbColumns,
  type CreateInstallationInput,
  type Installation,
  type InstallationActivityEvent,
  type InstallationPhotoMeta,
  type Material,
} from '@/lib/store/installations'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { appendActivityLog } from "@/lib/supabase/activity-log"

// Bypass Supabase v2 complex generic type inference to prevent `never` types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function q(client: any): { from: (table: string) => any } {
  return client as unknown as { from: (table: string) => any }
}


/** Lightweight installation for list views — excludes heavy materials/photos JSONB. */
export type InstallationListItem = Omit<Installation, 'materials' | 'photos'> & {
  /** Resolved from linked survey activity (`installer_assigned`), when available. */
  installerAssignedByName?: string
  installerAssignedAt?: string
  surveyServiceNo?: string
  surveyMobile?: string
  surveyCircle?: string
}

export type ListInstallationsParams = {
  limit: number
  offset: number
  search?: string
  status?: string
}

/** Narrow-column list query with server-side search, status filter and pagination. */
export async function listInstallationsFromSupabasePaginated(
  params: ListInstallationsParams
): Promise<{ items: InstallationListItem[]; total: number }> {
  const supabase = getSupabaseBrowserClient()
  const cols =
    'id,project_id,survey_id,customer_name,address,engineer_name,engineer_id,status,started_at,completed_at,created_at'

  let query = supabase
    .from('installations')
    .select(cols, { count: 'exact' })
    .eq('project_id', ACTIVE_PROJECT_ID)
    .order('created_at', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1)

  if (params.search) {
    query = query.or(
      `customer_name.ilike.%${params.search}%,address.ilike.%${params.search}%,id.ilike.%${params.search}%`
    )
  }
  if (params.status) {
    query = query.eq('status', params.status as Installation['status'])
  }

  try {
    const { data: rawData, error, count } = await query
    if (error) throw error

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: InstallationListItem[] = ((rawData ?? []) as any[]).map((row: any) => ({
      id: row.id,
      projectId: row.project_id ?? undefined,
      surveyId: row.survey_id ?? undefined,
      customerName: row.customer_name,
      address: row.address,
      engineerName: row.engineer_name ?? undefined,
      engineerId: row.engineer_id ?? undefined,
      status: row.status as Installation['status'],
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      createdAt: row.created_at,
    }))

    return { items, total: count ?? 0 }
  } catch (err) {
    console.error('listInstallations error:', err)
    return { items: [], total: 0 }
  }
}

const INSTALLATION_PHOTOS_BUCKET = 'solar_bucket'

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

/** Upload one installation photo; path: {installationId}/{photoId}_{category}_{filename} */
async function uploadInstallationPhotoFile(
  installationId: string,
  photoId: string,
  category: string,
  file: File
): Promise<string> {
  const supabase = getSupabaseBrowserClient()
  const fileName = sanitizeFileName(file.name)
  const path = `${installationId}/${photoId}_${category}_${fileName}`
  const contentType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg'
  const { error } = await supabase.storage.from(INSTALLATION_PHOTOS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType,
  })
  if (error) {
    throw new Error(
      'Installation photo upload failed: ' +
        error.message +
        '. Ensure storage bucket solar_bucket exists and allows uploads.'
    )
  }
  const { data } = supabase.storage.from(INSTALLATION_PHOTOS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

type InstallationRow = Database['public']['Tables']['installations']['Row']

function rowToInstallation(row: InstallationRow): Installation {
  return {
    id: row.id,
    projectId: row.project_id ?? undefined,
    surveyId: row.survey_id ?? undefined,
    customerName: row.customer_name,
    address: row.address,
    engineerName: row.engineer_name ?? undefined,
    engineerId: row.engineer_id ?? undefined,
    status: row.status,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    materials: (row.materials ?? []) as Material[],
    photos: (row.photos ?? []) as InstallationPhotoMeta[],
    createdAt: row.created_at,
    visitType: (row.visit_type ?? undefined) as Installation['visitType'],
    arrivalTime: row.arrival_time ?? undefined,
    departureTime: row.departure_time ?? undefined,
    siteAccessible: row.site_accessible ?? undefined,
    siteGps: row.site_gps as Installation['siteGps'] ?? undefined,
    installationChecklist: row.installation_checklist as Installation['installationChecklist'] ?? undefined,
    commissioningData: row.commissioning_data as Installation['commissioningData'] ?? undefined,
    qualityCheck: row.quality_check as Installation['qualityCheck'] ?? undefined,
    faultReport: row.fault_report as Installation['faultReport'] ?? undefined,
    signatureUrl: row.signature_url ?? undefined,
    declarationConfirmed: row.declaration_confirmed ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    activity: (row.activity ?? []) as Installation['activity'],
  }
}

async function loadAllInstallationsForMutations(): Promise<Installation[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await q(supabase).from('installations').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToInstallation)
}

export async function listInstallationsFromSupabase(): Promise<Installation[]> {
  const supabase = getSupabaseBrowserClient()
  try {
    const { data, error } = await q(supabase)
      .from('installations')
      .select('*')
      .eq('project_id', ACTIVE_PROJECT_ID)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(rowToInstallation)
  } catch (err) {
    console.error('listInstallations error:', err)
    return []
  }
}

export async function getInstallationByIdFromSupabase(id: string): Promise<Installation | undefined> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await q(supabase).from('installations').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? rowToInstallation(data) : undefined
}

export async function getInstallationBySurveyIdFromSupabase(surveyId: string): Promise<Installation | undefined> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await q(supabase)
    .from('installations')
    .select('*')
    .eq('project_id', ACTIVE_PROJECT_ID)
    .eq('survey_id', surveyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? rowToInstallation(data) : undefined
}

function nextInstallationId(existing: Installation[]): string {
  const nums = existing.map((i) => parseInt(i.id.replace(/^INST-/, ''), 10)).filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `INST-${(max + 1).toString().padStart(3, '0')}`
}

export async function createInstallationInSupabase(
  input: CreateInstallationInput,
  payload: { materials: Material[]; photos: InstallationPhotoMeta[] },
  photoFiles?: Record<string, File>
): Promise<Installation> {
  const supabase = getSupabaseBrowserClient()
  const existing = await loadAllInstallationsForMutations()
  const id = nextInstallationId(existing)
  let photos = payload.photos
  if (photoFiles && Object.keys(photoFiles).length > 0) {
    photos = await Promise.all(
      payload.photos.map(async (p) => {
        const file = photoFiles![p.id]
        if (!file) return p
        const url = await uploadInstallationPhotoFile(id, p.id, p.category, file)
        return { ...p, url }
      })
    )
  }
  const row = {
    id,
    project_id: input.projectId ?? ACTIVE_PROJECT_ID,
    survey_id: input.surveyId ?? null,
    customer_name: input.customerName,
    address: input.address,
    engineer_name: input.engineerName ?? null,
    engineer_id: input.engineerId ?? null,
    status: 'pending',
    materials: payload.materials,
    photos,
    activity: [{ at: new Date().toISOString(), actorId: input.engineerId, action: 'created', message: 'Installation created' }],
    ...createInstallationWizardDbColumns(input),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await q(supabase).from('installations').insert(row as any).select().single()
  if (error) throw error
  const created = rowToInstallation(data as any)
  try {
    await appendActivityLog({
      entityType: "installation",
      entityId: created.id,
      action: "created",
      message: "Installation created",
      meta: {
        status: created.status,
        customerName: created.customerName,
      },
    })
  } catch {}
  return created
}

export async function updateInstallationInSupabase(
  id: string,
  input: CreateInstallationInput,
  payload: { materials: Material[]; photos: InstallationPhotoMeta[] },
  photoFiles?: Record<string, File>
): Promise<Installation> {
  const supabase = getSupabaseBrowserClient()
  const current = await getInstallationByIdFromSupabase(id)
  const existingById = new Map((current?.photos ?? []).map((p) => [p.id, p]))
  let photos = payload.photos
  if (photoFiles && Object.keys(photoFiles).length > 0) {
    photos = await Promise.all(
      payload.photos.map(async (p) => {
        const file = photoFiles![p.id]
        if (!file) {
          const prev = existingById.get(p.id)
          const url = p.url ?? prev?.url
          return url ? { ...p, url } : p
        }
        const url = await uploadInstallationPhotoFile(id, p.id, p.category, file)
        return { ...p, url }
      })
    )
  } else {
    photos = payload.photos.map((p) => {
      const prev = existingById.get(p.id)
      const url = p.url ?? prev?.url
      return url ? { ...p, url } : p
    })
  }
  const updates = {
    project_id: input.projectId ?? ACTIVE_PROJECT_ID,
    survey_id: input.surveyId ?? null,
    customer_name: input.customerName,
    address: input.address,
    engineer_name: input.engineerName ?? null,
    engineer_id: input.engineerId ?? null,
    materials: payload.materials,
    photos,
    activity: [
      ...((current?.activity ?? []) as InstallationActivityEvent[]),
      { at: new Date().toISOString(), actorId: input.engineerId ?? current?.engineerId, action: 'edited', message: 'Installation updated' },
    ],
    ...createInstallationWizardDbColumns(input),
  }
  const changedFields: string[] = []
  if (current) {
    if (current.customerName !== input.customerName) changedFields.push("customerName")
    if (current.address !== input.address) changedFields.push("address")
    if ((current.engineerId ?? "") !== (input.engineerId ?? "")) changedFields.push("engineerId")
    if ((current.engineerName ?? "") !== (input.engineerName ?? "")) changedFields.push("engineerName")
    if (JSON.stringify(current.materials ?? []) !== JSON.stringify(payload.materials ?? [])) changedFields.push("materials")
    if (JSON.stringify(current.photos ?? []) !== JSON.stringify(photos ?? [])) changedFields.push("photos")
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await q(supabase).from('installations').update(updates as any).eq('id', id).select().single()
  if (error) throw error
  const updated = rowToInstallation(data as any)
  try {
    await appendActivityLog({
      entityType: "installation",
      entityId: updated.id,
      action: "updated",
      message: "Installation updated",
      meta: { changedFields },
    })
  } catch {}
  return updated
}

export async function updateInstallationStatusInSupabase(
  id: string,
  status: Installation['status']
): Promise<Installation> {
  const supabase = getSupabaseBrowserClient()
  const { data: current, error: fetchErr } = await q(supabase).from('installations').select('*').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr || new Error('Installation not found')
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentRow = current as any
  const prevStatus = currentRow.status as Installation['status']
  const updates: Record<string, unknown> = { status }

  if (status === 'pending' && prevStatus !== 'pending') {
    updates.started_at = null
    updates.completed_at = null
  } else {
    if (status === 'in_progress' && !currentRow.started_at) updates.started_at = now
    if ((status === 'completed' || status === 'inspection_pending') && !currentRow.completed_at) updates.completed_at = now
  }
  updates.activity = [
    ...((currentRow.activity ?? []) as InstallationActivityEvent[]),
    { at: now, actorId: currentRow.engineer_id ?? undefined, action: 'status_changed', message: `Status changed to ${status}`, meta: { status } },
  ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await q(supabase).from('installations').update(updates as any).eq('id', id).select().single()
  if (error) throw error
  const updated = rowToInstallation(data)
  try {
    await appendActivityLog({
      entityType: "installation",
      entityId: updated.id,
      action: "status_changed",
      message: `Status changed to ${status}`,
      meta: { from: prevStatus, to: status },
    })
  } catch {}
  return updated
}
