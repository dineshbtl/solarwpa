/**
 * Project data from Supabase only.
 */
import { assertSupabaseConfigured } from '@/lib/supabase/config'
import * as supabase from '@/lib/supabase/projects'
import type { Project, CreateProjectInput, UpdateProjectInput, ProjectAssignments } from '@/lib/store/projects'

import { offlineDB } from '@/lib/data/offline-db'

export type { Project, CreateProjectInput, UpdateProjectInput, ProjectAssignments }

let listProjectsInflight: Promise<Project[]> | null = null

export async function listProjects(): Promise<Project[]> {
  assertSupabaseConfigured()
  try {
    const list = await supabase.listProjectsFromSupabase()
    if (typeof window !== 'undefined') {
      await offlineDB.putMany('projects', list, { silent: true })
    }
    return list
  } catch (err) {
    const local = await offlineDB.getAll('projects')
    if (local.length > 0) return local
    throw err
  }
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  assertSupabaseConfigured()
  try {
    const one = await supabase.getProjectByIdFromSupabase(id)
    if (one && typeof window !== 'undefined') {
      await offlineDB.putOne('projects', one)
    }
    return one
  } catch (err) {
    const local = await offlineDB.getOne('projects', id)
    if (local) return local as Project
    throw err
  }
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
