/**
 * Supabase-backed installations CRUD. Maps DB rows to app Installation type.
 */
import type { Database } from '@/lib/supabase/database.types'
import type {
  Installation,
  CreateInstallationInput,
  Material,
  InstallationPhotoMeta,
} from '@/lib/store/installations'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

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
  }
}

export async function listInstallationsFromSupabase(): Promise<Installation[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.from('installations').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToInstallation)
}

export async function getInstallationByIdFromSupabase(id: string): Promise<Installation | undefined> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.from('installations').select('*').eq('id', id).maybeSingle()
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
  payload: { materials: Material[]; photos: InstallationPhotoMeta[] }
): Promise<Installation> {
  const supabase = getSupabaseBrowserClient()
  const existing = await listInstallationsFromSupabase()
  const id = nextInstallationId(existing)
  const row = {
    id,
    project_id: input.projectId ?? null,
    survey_id: input.surveyId ?? null,
    customer_name: input.customerName,
    address: input.address,
    engineer_name: input.engineerName ?? null,
    engineer_id: input.engineerId ?? null,
    status: 'pending',
    materials: payload.materials,
    photos: payload.photos,
  }
  const { data, error } = await supabase.from('installations').insert(row).select().single()
  if (error) throw error
  return rowToInstallation(data)
}

export async function updateInstallationInSupabase(
  id: string,
  input: CreateInstallationInput,
  payload: { materials: Material[]; photos: InstallationPhotoMeta[] }
): Promise<Installation> {
  const supabase = getSupabaseBrowserClient()
  const updates = {
    project_id: input.projectId ?? null,
    survey_id: input.surveyId ?? null,
    customer_name: input.customerName,
    address: input.address,
    engineer_name: input.engineerName ?? null,
    engineer_id: input.engineerId ?? null,
    materials: payload.materials,
    photos: payload.photos,
  }
  const { data, error } = await supabase.from('installations').update(updates).eq('id', id).select().single()
  if (error) throw error
  return rowToInstallation(data)
}

export async function updateInstallationStatusInSupabase(
  id: string,
  status: Installation['status']
): Promise<Installation> {
  const supabase = getSupabaseBrowserClient()
  const { data: current, error: fetchErr } = await supabase.from('installations').select('*').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr || new Error('Installation not found')
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { status }
  if (status === 'in_progress' && !current.started_at) updates.started_at = now
  if ((status === 'completed' || status === 'inspection_pending') && !current.completed_at) updates.completed_at = now
  const { data, error } = await supabase.from('installations').update(updates).eq('id', id).select().single()
  if (error) throw error
  return rowToInstallation(data)
}
