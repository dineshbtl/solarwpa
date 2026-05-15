/**
 * Supabase-backed inspections CRUD. Maps DB rows to app Inspection type.
 */
import type { Database } from '@/lib/supabase/database.types'
import { ACTIVE_PROJECT_ID } from '@/lib/data/active-project'
import type { Inspection, InspectionStatus } from '@/lib/store/inspections'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

// Bypass Supabase v2 complex generic type inference to prevent `never` types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function q(client: ReturnType<typeof getSupabaseBrowserClient>): { from: (table: string) => any } {
  return client as unknown as { from: (table: string) => any }
}

type InspectionRow = Database['public']['Tables']['inspections']['Row']

/** Lightweight inspection for list views — excludes heavy activity JSONB. */
export type InspectionListItem = Omit<Inspection, 'activity'>

export type ListInspectionsParams = {
  limit: number
  offset: number
  search?: string
  status?: string
}

/** Narrow-column list query with server-side search, status filter and pagination. */
export async function listInspectionsFromSupabasePaginated(
  params: ListInspectionsParams
): Promise<{ items: InspectionListItem[]; total: number }> {
  const supabase = getSupabaseBrowserClient()
  const cols =
    'id,installation_id,project_id,survey_id,customer_name,address,status,inspector_id,manager_approval,government_inspection,created_at'

  let query = supabase
    .from('inspections')
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
    query = query.eq('status', params.status as Inspection['status'])
  }

  const { data, error, count } = await query
  if (error) throw error

  const items: InspectionListItem[] = (data ?? []).map((rawRow) => {
    const row = rawRow as Record<string, unknown>
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
      id: row.id as string,
      installationId: row.installation_id as string,
      projectId: (row.project_id as string) ?? undefined,
      surveyId: (row.survey_id as string) ?? undefined,
      customerName: row.customer_name as string,
      address: row.address as string,
      status: row.status as Inspection['status'],
      inspectorId: (row.inspector_id as string) ?? undefined,
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
      createdAt: row.created_at as string,
    }
  })

  return { items, total: count ?? 0 }
}

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

async function loadAllInspectionsForMutations(): Promise<Inspection[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await q(supabase).from('inspections').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToInspection)
}

export async function listInspectionsFromSupabase(): Promise<Inspection[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await q(supabase)
    .from('inspections')
    .select('*')
    .eq('project_id', ACTIVE_PROJECT_ID)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToInspection)
}

export async function getInspectionByIdFromSupabase(id: string): Promise<Inspection | undefined> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await q(supabase).from('inspections').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? rowToInspection(data) : undefined
}

export async function getInspectionByInstallationIdFromSupabase(installationId: string): Promise<Inspection | undefined> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await q(supabase)
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
  const existing = await loadAllInspectionsForMutations()
  const id = nextInspectionId(existing)
  const now = new Date().toISOString()
  const row = {
    id,
    installation_id: input.installationId,
    project_id: input.projectId ?? ACTIVE_PROJECT_ID,
    survey_id: input.surveyId ?? null,
    customer_name: input.customerName,
    address: input.address,
    status: 'pending',
    manager_approval: { approved: false, remarks: '' },
    activity: [{ at: now, action: 'created', message: 'Inspection created' }],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await q(supabase).from('inspections').insert(row as any).select().single()
  if (error) throw error
  return rowToInspection(data as unknown as InspectionRow)
}

export async function updateInspectionStatusInSupabase(id: string, status: InspectionStatus): Promise<Inspection> {
  const supabase = getSupabaseBrowserClient()
  const { data: current, error: fetchErr } = await q(supabase).from('inspections').select('activity').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr || new Error('Inspection not found')
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentRow = current as any
  const activity = [...((currentRow.activity ?? []) as Inspection['activity']), { at: now, action: 'status_changed' as const, message: `Status changed to ${status}`, meta: { status } }]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await q(supabase).from('inspections').update({ status, activity } as any).eq('id', id).select().single()
  if (error) throw error
  return rowToInspection(data as unknown as InspectionRow)
}

export async function assignInspectionInspectorInSupabase(id: string, inspectorId?: string): Promise<Inspection> {
  const supabase = getSupabaseBrowserClient()
  const { data: current, error: fetchErr } = await q(supabase).from('inspections').select('*').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr || new Error('Inspection not found')
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentRow = current as any
  const activity = [
    ...((currentRow.activity ?? []) as Inspection['activity']),
    { at: now, action: 'inspector_assigned' as const, message: inspectorId ? `Inspector assigned (${inspectorId})` : 'Inspector unassigned', meta: { inspectorId: inspectorId ?? null } },
  ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await q(supabase).from('inspections').update({ inspector_id: inspectorId ?? null, activity } as any).eq('id', id).select().single()
  if (error) throw error
  return rowToInspection(data as unknown as InspectionRow)
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
  const { data: current, error: fetchErr } = await q(supabase).from('inspections').select('activity').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr || new Error('Inspection not found')
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentRow2 = current as any
  const activity = [...((currentRow2.activity ?? []) as Inspection['activity']), { at: now, action: 'edited' as const, message: 'Inspection updated' }]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await q(supabase).from('inspections').update({ ...updates, activity } as any).eq('id', id).select().single()
  if (error) throw error
  return rowToInspection(data as unknown as InspectionRow)
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
  const { data: current, error: fetchErr } = await q(supabase).from('inspections').select('activity').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr || new Error('Inspection not found')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentRow = current as any
  const activity = [
    ...((currentRow.activity ?? []) as Inspection['activity']),
    {
      at: now,
      actorId: approvedBy,
      action: approved ? ('approved' as const) : ('rejected' as const),
      message: approved ? 'Manager approved inspection' : 'Manager reopened inspection',
      meta: { remarks, by: 'manager', status },
    },
  ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await q(supabase)
    .from('inspections')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      status,
      manager_approval: { approved, remarks, approvedAt: now, approvedBy },
      activity,
    } as any)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return rowToInspection(data as unknown as InspectionRow)
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
  const { data: current, error: fetchErr } = await q(supabase).from('inspections').select('activity').eq('id', id).single()
  if (fetchErr || !current) throw fetchErr || new Error('Inspection not found')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentRow3 = current as any
  const activity = [
    ...((currentRow3.activity ?? []) as Inspection['activity']),
    { at: now, action: approved ? ('approved' as const) : ('rejected' as const), message: approved ? 'Inspection approved' : 'Inspection rejected', meta: { remarks } },
  ]
  const { data, error } = await q(supabase)
    .from('inspections')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      status,
      government_inspection: { approved, remarks, inspectedAt: now, inspectorName },
      activity,
    } as any)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return rowToInspection(data as unknown as InspectionRow)
}
