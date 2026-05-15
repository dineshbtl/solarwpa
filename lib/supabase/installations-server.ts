/**
 * Server-only installation writes using service role (bypasses Storage RLS).
 * Use when browser uploads fail with "row-level security policy" on storage.objects.
 */
import type { Database } from '@/lib/supabase/database.types'
import {
  createInstallationWizardDbColumns,
  type CreateInstallationInput,
  type Installation,
  type InstallationPhotoMeta,
  type Material,
} from '@/lib/store/installations'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ACTIVE_PROJECT_ID } from '@/lib/data/active-project'

// Bypass Supabase v2 complex generic type inference to prevent `never` types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function q(client: any): { from: (table: string) => any } {
  return client as unknown as { from: (table: string) => any }
}


const BUCKET = 'solar_bucket'

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
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
    siteGps: (row.site_gps as Installation['siteGps']) ?? undefined,
    installationChecklist:
      (row.installation_checklist as Installation['installationChecklist']) ?? undefined,
    commissioningData: (row.commissioning_data as Installation['commissioningData']) ?? undefined,
    qualityCheck: (row.quality_check as Installation['qualityCheck']) ?? undefined,
    faultReport: (row.fault_report as Installation['faultReport']) ?? undefined,
    signatureUrl: row.signature_url ?? undefined,
    declarationConfirmed: row.declaration_confirmed ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    activity: (row.activity ?? []) as Installation['activity'],
  }
}

/** Remove accidental data URLs from materials JSON (keeps small payload for multipart). */
function stripDataUrlsFromMaterials(materials: Material[]): Material[] {
  return materials.map((m) => {
    const o: Material = { ...m }
    if (o.photo?.url?.startsWith('data:')) {
      o.photo = { name: o.photo.name, type: o.photo.type, size: o.photo.size }
    }
    if (o.panelPhotos?.length) {
      o.panelPhotos = o.panelPhotos.map((pp) => {
        if (!pp) return pp
        if (pp.url?.startsWith('data:')) {
          return { name: pp.name, type: pp.type, size: pp.size }
        }
        return pp
      })
    }
    return o
  })
}

/** Upload material / panel evidence files from FormData and merge public URLs into materials. */
async function hydrateMaterialsFromFormData(
  installationId: string,
  materials: Material[],
  formData: FormData,
  existingMaterials: Material[] = []
): Promise<Material[]> {
  const result: Material[] = []
  const existingById = new Map(existingMaterials.map((m) => [m.id, m]))
  for (const m of materials) {
    let mat: Material = { ...m }
    const prev = existingById.get(m.id)
    const singleKey = `file_mat_${m.id}_photo`
    const blobSingle = formData.get(singleKey)
    if (blobSingle instanceof Blob && blobSingle.size > 0) {
      const uploadedSize = blobSingle.size
      const basePhoto =
        mat.photo ??
        (blobSingle instanceof File
          ? {
              name: blobSingle.name || 'photo.jpg',
              type: blobSingle.type || 'image/jpeg',
              size: uploadedSize,
            }
          : {
              name: 'photo.jpg',
              type: 'image/jpeg',
              size: uploadedSize,
            })
      const name = blobSingle instanceof File ? blobSingle.name : basePhoto.name
      const url = await uploadInstallationPhotoFileServer(
        installationId,
        `mm_${m.id}_photo`,
        'overall',
        blobSingle,
        name
      )
      mat = { ...mat, photo: { ...basePhoto, url } }
    } else if (mat.photo && !mat.photo.url && prev?.photo?.url) {
      mat = { ...mat, photo: { ...mat.photo, url: prev.photo.url } }
    } else if (!mat.photo && prev?.photo?.url) {
      mat = { ...mat, photo: prev.photo }
    }
    if (m.name === 'Solar PV Module') {
      const previousPanels = prev?.panelPhotos ?? []
      const nextPanels = await Promise.all(
        [0, 1, 2, 3].map(async (idx) => {
          const pp = m.panelPhotos?.[idx]
          const prevPanel = previousPanels[idx]
          const blob = formData.get(`file_mat_${m.id}_panel_${idx}`)
          if (blob instanceof Blob && blob.size > 0) {
            const base = pp ?? {
              name: blob instanceof File ? blob.name : 'photo.jpg',
              type: blob.type || 'image/jpeg',
              size: blob.size,
            }
            const name = blob instanceof File ? blob.name : base.name
            const url = await uploadInstallationPhotoFileServer(
              installationId,
              `mm_${m.id}_p${idx}`,
              'overall',
              blob,
              name
            )
            return { ...base, url }
          }
          if (pp?.url) return pp
          if (pp && prevPanel?.url) return { ...pp, url: prevPanel.url }
          return pp ?? prevPanel ?? null
        })
      )
      mat = {
        ...mat,
        panelPhotos: nextPanels.filter((x): x is NonNullable<typeof x> => x != null),
      }
    }
    result.push(mat)
  }
  return result
}

async function uploadInstallationPhotoFileServer(
  installationId: string,
  photoId: string,
  category: string,
  file: Blob | File,
  fileName: string
): Promise<string> {
  const supabase = createSupabaseServerClient({ useServiceRole: true })
  const safe = sanitizeFileName(fileName)
  const path = `${installationId}/${photoId}_${category}_${safe}`
  const contentType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg'
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType,
  })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function getNextInstallationId(): Promise<string> {
  const supabase = createSupabaseServerClient({ useServiceRole: true })
  // Prefer DB-side atomic counter. Fallback keeps create working if RPC/migration is missing in an env.
  const { data, error } = await (supabase as unknown as {
    rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: string | null; error: unknown }>
  }).rpc('next_prefixed_id', {
    p_key: 'installations',
    p_prefix: 'INST-',
    p_width: 3,
  })
  if (!error && data) return data

  const errCode = (error as { code?: string } | null)?.code
  if (errCode && errCode !== 'PGRST202') throw error

  // Fallback: derive from latest installation IDs.
  const { data: rows, error: listError } = await q(supabase)
    .from('installations')
    .select('id,created_at')
    .like('id', 'INST-%')
    .order('created_at', { ascending: false })
    .limit(200)
  if (listError) throw listError

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxNum = ((rows ?? []) as any[]).reduce((max, r) => {
    const id = typeof r?.id === 'string' ? r.id : ''
    const m = /^INST-(\d+)$/.exec(id)
    if (!m) return max
    const n = Number(m[1])
    return Number.isFinite(n) ? Math.max(max, n) : max
  }, 0)

  return `INST-${String(maxNum + 1).padStart(3, '0')}`
}

async function createInstallationRowWithRetry(
  rowFactory: (id: string) => Omit<Database['public']['Tables']['installations']['Insert'], 'id'>,
  maxAttempts = 2
): Promise<InstallationRow> {
  const supabase = createSupabaseServerClient({ useServiceRole: true })
  let lastError: unknown = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const id = await getNextInstallationId()
    const row = { id, ...rowFactory(id) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await q(supabase).from('installations').insert(row as any).select().single()
    if (!error && data) return data as any as InstallationRow

    lastError = error
    const code = (error as { code?: string } | null)?.code
    if (code !== '23505') break
  }

  throw lastError ?? new Error('Failed to create installation')
}

export async function createInstallationWithServiceRoleFromFormData(formData: FormData): Promise<Installation> {
  const inputJson = formData.get('input')
  const payloadJson = formData.get('payload')
  if (typeof inputJson !== 'string' || typeof payloadJson !== 'string') {
    throw new Error('Missing input or payload')
  }
  const input = JSON.parse(inputJson) as CreateInstallationInput
  const payload = JSON.parse(payloadJson) as { materials: Material[]; photos: InstallationPhotoMeta[] }

  const photosFromId = async (id: string): Promise<InstallationPhotoMeta[]> =>
    Promise.all(
      payload.photos.map(async (p) => {
        const file = formData.get(`file_${p.id}`)
        if (file instanceof Blob && file.size > 0) {
          const name = file instanceof File ? file.name : `photo_${p.id}.jpg`
          const url = await uploadInstallationPhotoFileServer(id, p.id, p.category, file, name)
          return {
            ...p,
            file: { name, type: file.type || 'image/jpeg', size: file.size },
            url,
          }
        }
        return p
      })
    )

  const materialsForInsert = stripDataUrlsFromMaterials(payload.materials)

  const created = await createInstallationRowWithRetry(
    (id) => ({
      project_id: input.projectId ?? ACTIVE_PROJECT_ID,
      survey_id: input.surveyId ?? null,
      customer_name: input.customerName,
      address: input.address,
      engineer_name: input.engineerName ?? null,
      engineer_id: input.engineerId ?? null,
      status: 'pending',
      materials: materialsForInsert,
      // photos + material URLs filled in after upload (avoids huge JSON / HTTP 413)
      photos: [],
      ...createInstallationWizardDbColumns(input),
    })
  )

  const id = created.id
  const materialsHydrated = await hydrateMaterialsFromFormData(id, payload.materials, formData)
  const photos = await photosFromId(id)
  let signatureUrl: string | undefined = (created as { signature_url?: string | null }).signature_url ?? undefined
  const sigBlob = formData.get('file_signature')
  if (sigBlob instanceof Blob && sigBlob.size > 0) {
    const name = sigBlob instanceof File ? sigBlob.name : 'signature.png'
    signatureUrl = await uploadInstallationPhotoFileServer(id, 'signature', 'overall', sigBlob, name)
  }
  const { data: updated, error: updateErr } = await q(createSupabaseServerClient({ useServiceRole: true }))
    .from('installations')
    .update({
      materials: materialsHydrated,
      photos,
      ...(signatureUrl ? { signature_url: signatureUrl } : {}),
    })
    .eq('id', id)
    .select()
    .single()
  if (updateErr) throw updateErr
  return rowToInstallation(updated as any)
}

/**
 * Update installation: upload any new photo blobs from FormData with service role, then update row.
 * FormData keys: installationId, input (JSON), payload (JSON { materials, photos }), file_<photoId> (File)
 */
export async function updateInstallationWithServiceRoleFromFormData(formData: FormData): Promise<Installation> {
  const installationId = formData.get('installationId')
  if (typeof installationId !== 'string' || !installationId) throw new Error('Missing installation id')

  const inputJson = formData.get('input')
  const payloadJson = formData.get('payload')
  if (typeof inputJson !== 'string' || typeof payloadJson !== 'string') {
    throw new Error('Missing input or payload')
  }
  const input = JSON.parse(inputJson) as CreateInstallationInput
  const payload = JSON.parse(payloadJson) as { materials: Material[]; photos: InstallationPhotoMeta[] }

  const supabase = createSupabaseServerClient({ useServiceRole: true })
  const { data: current, error: fetchErr } = await q(supabase).from('installations').select('*').eq('id', installationId).single()
  if (fetchErr || !current) throw fetchErr ?? new Error('Installation not found')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentRow = current as any

  const existingById = new Map(
    ((currentRow.photos ?? []) as InstallationPhotoMeta[]).map((p: InstallationPhotoMeta) => [p.id, p])
  )

  const photos: InstallationPhotoMeta[] = await Promise.all(
    payload.photos.map(async (p) => {
      const file = formData.get(`file_${p.id}`)
      if (file instanceof Blob && file.size > 0) {
        const name = file instanceof File ? file.name : `photo_${p.id}.jpg`
        const url = await uploadInstallationPhotoFileServer(installationId, p.id, p.category, file, name)
        return {
          ...p,
          file: { name, type: file.type || 'image/jpeg', size: file.size },
          url,
        }
      }
      const prev = existingById.get(p.id)
      const url = p.url ?? prev?.url
      return url ? { ...p, url } : p
    })
  )

  const materialsHydrated = await hydrateMaterialsFromFormData(
    installationId,
    payload.materials,
    formData,
    (currentRow.materials ?? []) as Material[]
  )

  const sigBlob = formData.get('file_signature')
  let signaturePatch: { signature_url: string } | Record<string, never> = {}
  if (sigBlob instanceof Blob && sigBlob.size > 0) {
    const name = sigBlob instanceof File ? sigBlob.name : 'signature.png'
    const uploaded = await uploadInstallationPhotoFileServer(
      installationId,
      'signature',
      'overall',
      sigBlob,
      name
    )
    signaturePatch = { signature_url: uploaded }
  }

  const updates = {
    project_id: input.projectId ?? null,
    survey_id: input.surveyId ?? null,
    customer_name: input.customerName,
    address: input.address,
    engineer_name: input.engineerName ?? null,
    engineer_id: input.engineerId ?? null,
    materials: materialsHydrated,
    photos,
    ...createInstallationWizardDbColumns(input),
    ...signaturePatch,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await q(supabase).from('installations').update(updates as any).eq('id', installationId).select().single()
  if (error) throw error
  return rowToInstallation(data as any)
}

