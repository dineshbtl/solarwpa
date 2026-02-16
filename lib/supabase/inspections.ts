/**
 * Supabase-backed inspections CRUD. Maps DB rows to app Inspection type.
 */
import type { Database } from '@/lib/supabase/database.types'
import type { Inspection, InspectionStatus } from '@/lib/store/inspections'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

type InspectionRow = Database['public']['Tables']['inspections']['Row']

function rowToInspection(row: InspectionRow): Inspection {
  const managerApproval = (row.manager_approval ?? { approved: false, remarks: '' }) as {
    approved?: boolean
    remarks?: string
    approvedAt?: string
    approvedBy?: string
  }
  const governmentInspection = row.government_inspection as {
    approved?: boolean
    remarks?: string
    inspectedAt?: string
    inspectorName?: string
  } | null
  return {
    id: row.id,
    installationId: row.installation_id,
    projectId: row.project_id ?? undefined,
    surveyId: row.survey_id ?? undefined,
    customerName: row.customer_name,
    address: row.address,
    status: row.status as InspectionStatus,
    inspectorId: row.inspector_id ?? undefined,
    managerApproval: {
      approved: managerApproval?.approved ?? false,
      remarks: managerApproval?.remarks ?? '',
      approvedAt: managerApproval?.approvedAt,
      approvedBy: managerApproval?.approvedBy,
    },
    governmentInspection: governmentInspection
      ? {
          approved: governmentInspection.approved ?? false,
          remarks: governmentInspection.remarks ?? '',
          inspectedAt: governmentInspection.inspectedAt,
          inspectorName: governmentInspection.inspectorName,
        }
      : undefined,
    activity: (row.activity ?? []) as Inspection['activity'],
    createdAt: row.created_at,
  }
}

export async function listInspectionsFromSupabase(): Promise<Inspection[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.from('inspections').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToInspection)
}

export async function getInspectionByIdFromSupabase(id: string): Promise<Inspection | undefined> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.from('inspections').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? rowToInspection(data) : undefined
}

export async function getInspectionByInstallationIdFromSupabase(installationId: string): Promise<Inspection | undefined> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('inspections')
    .select('*')
    .eq('installation_id', installationId)
    .maybeSingle()
  if (error) throw error
  return data ? rowToInspection(data) : undefined
}

function nextInspectionId(existing: Inspection[]): string {
  const nums = existing.map((i) => parseInt(i.id.replace(/^INSP-/, ''), 10)).filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `INSP-${(max + 1).toString().padStart(3, '0')}`
}

export async function createInspectionInSupabase(input: {
  installationId: string
  projectId?: string
  surveyId?: string
  customerName: string
  address: string
}): Promise<Inspection> {
  const supabase = getSupabaseBrowserClient()
  const existing = await listInspectionsFromSupabase()
  const id = nextInspectionId(existing)
  const now = new Date().toISOString()
  const row = {
    id,
    installation_id: input.installationId,
    project_id: input.projectId ?? null,
    survey_id: input.surveyId ?? null,
    customer_name: input.customerName,
    address: input.address,
    status: 'pending',
    manager_approval: { approved: false, remarks: '' },
    activity: [{ at: now, action: 'created', message: 'Inspection created' }],
  }
  const { data, error } = await supabase.from('inspections').insert(row).select().single()
  if (error) throw error
  return rowToInspection(data)
}

export async function updateInspectionStatusInSupabase(id: string, status: InspectionStatus): Promise<Inspection> {
  const supabase = getSupabaseBrowserClient()
  const { data: current, error: fetchErr } = await supabase.from('inspections').select('activity').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr || new Error('Inspection not found')
  const now = new Date().toISOString()
  const activity = [...((current.activity ?? []) as Inspection['activity']), { at: now, action: 'status_changed' as const, message: `Status changed to ${status}`, meta: { status } }]
  const { data, error } = await supabase.from('inspections').update({ status, activity }).eq('id', id).select().single()
  if (error) throw error
  return rowToInspection(data)
}

export async function assignInspectionInspectorInSupabase(id: string, inspectorId?: string): Promise<Inspection> {
  const supabase = getSupabaseBrowserClient()
  const { data: current, error: fetchErr } = await supabase.from('inspections').select('*').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr || new Error('Inspection not found')
  const now = new Date().toISOString()
  const activity = [
    ...((current.activity ?? []) as Inspection['activity']),
    { at: now, action: 'inspector_assigned' as const, message: inspectorId ? `Inspector assigned (${inspectorId})` : 'Inspector unassigned', meta: { inspectorId: inspectorId ?? null } },
  ]
  const { data, error } = await supabase.from('inspections').update({ inspector_id: inspectorId ?? null, activity }).eq('id', id).select().single()
  if (error) throw error
  return rowToInspection(data)
}

export async function updateInspectionDetailsInSupabase(
  id: string,
  patch: { customerName: string; address: string; inspectorId?: string }
): Promise<Inspection> {
  const supabase = getSupabaseBrowserClient()
  const updates = {
    customer_name: patch.customerName,
    address: patch.address,
    inspector_id: patch.inspectorId ?? null,
  }
  const { data: current, error: fetchErr } = await supabase.from('inspections').select('activity').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr || new Error('Inspection not found')
  const now = new Date().toISOString()
  const activity = [...((current.activity ?? []) as Inspection['activity']), { at: now, action: 'edited' as const, message: 'Inspection updated' }]
  const { data, error } = await supabase.from('inspections').update({ ...updates, activity }).eq('id', id).select().single()
  if (error) throw error
  return rowToInspection(data)
}

export async function setManagerApprovalInSupabase(
  id: string,
  approved: boolean,
  remarks: string,
  approvedBy?: string
): Promise<Inspection> {
  const supabase = getSupabaseBrowserClient()
  const now = new Date().toISOString()
  const status = approved ? 'pending' : 'reopened'
  const { data, error } = await supabase
    .from('inspections')
    .update({
      status,
      manager_approval: { approved, remarks, approvedAt: now, approvedBy },
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return rowToInspection(data)
}

export async function setGovernmentInspectionInSupabase(
  id: string,
  approved: boolean,
  remarks: string,
  inspectorName?: string
): Promise<Inspection> {
  const supabase = getSupabaseBrowserClient()
  const now = new Date().toISOString()
  const status = approved ? 'approved' : 'reopened'
  const { data: current, error: fetchErr } = await supabase.from('inspections').select('activity').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr || new Error('Inspection not found')
  const activity = [
    ...((current.activity ?? []) as Inspection['activity']),
    { at: now, action: approved ? ('approved' as const) : ('rejected' as const), message: approved ? 'Inspection approved' : 'Inspection rejected', meta: { remarks } },
  ]
  const { data, error } = await supabase
    .from('inspections')
    .update({
      status,
      government_inspection: { approved, remarks, inspectedAt: now, inspectorName },
      activity,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return rowToInspection(data)
}
