/**
 * Unified data layer: Supabase when configured, else localStorage store.
 * All functions are async so the app can use the same API in both modes.
 */
import { isSupabaseConfigured } from '@/lib/supabase/config'
import * as store from '@/lib/store/projects'
import * as supabase from '@/lib/supabase/projects'
import type { Project, CreateProjectInput, UpdateProjectInput, ProjectAssignments } from '@/lib/store/projects'

export type { Project, CreateProjectInput, UpdateProjectInput, ProjectAssignments }

export async function listProjects(): Promise<Project[]> {
  if (isSupabaseConfigured()) return supabase.listProjectsFromSupabase()
  return Promise.resolve(store.listProjects())
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  if (isSupabaseConfigured()) return supabase.getProjectByIdFromSupabase(id)
  return Promise.resolve(store.getProjectById(id))
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  if (isSupabaseConfigured()) return supabase.createProjectInSupabase(input)
  return Promise.resolve(store.createProject(input))
}

export async function updateProject(projectId: string, input: UpdateProjectInput): Promise<Project> {
  if (isSupabaseConfigured()) return supabase.updateProjectInSupabase(projectId, input)
  return Promise.resolve(store.updateProject(projectId, input))
}

export async function updateProjectAssignments(projectId: string, assignments: ProjectAssignments): Promise<Project> {
  if (isSupabaseConfigured()) return supabase.updateProjectAssignmentsInSupabase(projectId, assignments)
  return Promise.resolve(store.updateProjectAssignments(projectId, assignments))
}

export async function deleteProject(projectId: string): Promise<void> {
  if (isSupabaseConfigured()) return supabase.deleteProjectInSupabase(projectId)
  store.deleteProject(projectId)
  return Promise.resolve()
}
