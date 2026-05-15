/**
 * Project data from Supabase only.
 */
import { assertSupabaseConfigured } from '@/lib/supabase/config'
import * as supabase from '@/lib/supabase/projects'
import type { Project, CreateProjectInput, UpdateProjectInput, ProjectAssignments } from '@/lib/store/projects'

export type { Project, CreateProjectInput, UpdateProjectInput, ProjectAssignments }

let listProjectsInflight: Promise<Project[]> | null = null

export async function listProjects(): Promise<Project[]> {
  assertSupabaseConfigured()
  if (!listProjectsInflight) {
    listProjectsInflight = supabase.listProjectsFromSupabase().finally(() => {
      listProjectsInflight = null
    })
  }
  return listProjectsInflight
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  assertSupabaseConfigured()
  return supabase.getProjectByIdFromSupabase(id)
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  assertSupabaseConfigured()
  return supabase.createProjectInSupabase(input)
}

export async function updateProject(projectId: string, input: UpdateProjectInput): Promise<Project> {
  assertSupabaseConfigured()
  return supabase.updateProjectInSupabase(projectId, input)
}

export async function updateProjectAssignments(projectId: string, assignments: ProjectAssignments): Promise<Project> {
  assertSupabaseConfigured()
  return supabase.updateProjectAssignmentsInSupabase(projectId, assignments)
}

export async function deleteProject(projectId: string): Promise<void> {
  assertSupabaseConfigured()
  return supabase.deleteProjectInSupabase(projectId)
}
