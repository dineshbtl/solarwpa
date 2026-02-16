/**
 * Supabase-backed projects CRUD. Maps DB rows (snake_case) to app Project type (camelCase).
 */
import type { Database } from '@/lib/supabase/database.types'
import type { Project, ProjectAssignments, CreateProjectInput, UpdateProjectInput } from '@/lib/store/projects'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

type ProjectRow = Database['public']['Tables']['projects']['Row']

function rowToProject(row: ProjectRow): Project {
  const assignments = (row.assignments ?? {}) as Record<string, string>
  return {
    id: row.id,
    projectName: row.project_name,
    description: row.description ?? undefined,
    state: row.state ?? undefined,
    city: row.city ?? undefined,
    district: row.district ?? undefined,
    pincode: row.pincode ?? undefined,
    address: row.address ?? undefined,
    additionalInfo: row.additional_info ?? undefined,
    assignments: {
      managerId: assignments?.managerId ?? assignments?.manager_id,
      surveyorId: assignments?.surveyorId ?? assignments?.surveyor_id,
    } as ProjectAssignments,
    createdAt: row.created_at,
  }
}

export async function listProjectsFromSupabase(): Promise<Project[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToProject)
}

export async function getProjectByIdFromSupabase(id: string): Promise<Project | undefined> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? rowToProject(data) : undefined
}

function nextProjectId(existing: Project[]): string {
  const nums = existing.map((p) => parseInt(p.id.replace(/^PROJ-/, ''), 10)).filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `PROJ-${(max + 1).toString().padStart(3, '0')}`
}

export async function createProjectInSupabase(input: CreateProjectInput): Promise<Project> {
  const supabase = getSupabaseBrowserClient()
  const existing = await listProjectsFromSupabase()
  const id = nextProjectId(existing)
  const row = {
    id,
    project_name: input.projectName,
    description: input.description ?? null,
    state: input.state ?? null,
    city: input.city ?? null,
    district: input.district ?? null,
    pincode: input.pincode ?? null,
    address: input.address ?? null,
    additional_info: input.additionalInfo ?? null,
    assignments: input.assignments ?? {},
  }
  const { data, error } = await supabase.from('projects').insert(row).select().single()
  if (error) throw error
  return rowToProject(data)
}

export async function updateProjectInSupabase(projectId: string, input: UpdateProjectInput): Promise<Project> {
  const supabase = getSupabaseBrowserClient()
  const updates: Record<string, unknown> = {
    project_name: input.projectName,
    description: input.description ?? null,
    state: input.state ?? null,
    city: input.city ?? null,
    district: input.district ?? null,
    pincode: input.pincode ?? null,
    address: input.address ?? null,
    additional_info: input.additionalInfo ?? null,
  }
  if (input.assignments !== undefined) {
    updates.assignments = input.assignments
  }
  const { data, error } = await supabase.from('projects').update(updates).eq('id', projectId).select().single()
  if (error) throw error
  return rowToProject(data)
}

export async function updateProjectAssignmentsInSupabase(
  projectId: string,
  assignments: ProjectAssignments
): Promise<Project> {
  const supabase = getSupabaseBrowserClient()
  const { data: current, error: fetchError } = await supabase.from('projects').select('assignments').eq('id', projectId).single()
  if (fetchError || !current) throw fetchError || new Error('Project not found')
  const merged = { ...(current.assignments as object), ...assignments }
  const { data, error } = await supabase.from('projects').update({ assignments: merged }).eq('id', projectId).select().single()
  if (error) throw error
  return rowToProject(data)
}

export async function deleteProjectInSupabase(projectId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) throw error
}
