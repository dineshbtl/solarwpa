import { z } from 'zod'

import { readLocalStorageJSON, writeLocalStorageJSON } from '@/lib/store/storage'

export type ProjectAssignments = {
  managerId?: string
  surveyorId?: string
}

export type Project = {
  id: string
  projectName: string
  description?: string
  state?: string
  city?: string
  district?: string
  pincode?: string
  address?: string
  additionalInfo?: string
  assignments: ProjectAssignments
  createdAt: string
}

const STORAGE_KEY = 'solarepc.projects.v1'

const AssignmentsSchema = z.object({
  managerId: z.string().min(1).optional(),
  surveyorId: z.string().min(1).optional(),
})

const OptionalAddressSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
  z
    .string()
    .min(10, 'Address must be at least 10 characters')
    .max(240)
    .optional(),
)

// NOTE: Backward-compatible schema. Older stored projects may have `customerName`
// and may not have the new fields. We transform into the current `Project` shape.
const StoredProjectSchema = z
  .object({
    id: z.string().min(1),
    projectName: z.string().min(2).max(120).optional(),
    // legacy
    customerName: z.string().min(2).max(120).optional(),
    description: z.string().max(500).optional(),
    state: z.string().max(60).optional(),
    city: z.string().max(80).optional(),
    district: z.string().max(80).optional(),
    pincode: z.string().max(12).optional(),
    address: z.string().max(240).optional(),
    additionalInfo: z.string().max(800).optional(),
    assignments: AssignmentsSchema.default({}),
    createdAt: z.string().min(1),
  })
  .transform((p) => {
    const projectName = p.projectName ?? p.customerName ?? p.id
    return {
      id: p.id,
      projectName,
      description: p.description,
      state: p.state,
      city: p.city,
      district: p.district,
      pincode: p.pincode,
      address: typeof p.address === 'string' && p.address.trim().length > 0 ? p.address : undefined,
      additionalInfo: p.additionalInfo,
      assignments: p.assignments ?? {},
      createdAt: p.createdAt,
    } satisfies Project
  })

export const ProjectSchema = z.object({
  id: z.string().min(1),
  projectName: z.string().min(2, 'Project name must be at least 2 characters').max(120),
  description: z.string().max(500).optional(),
  state: z.string().max(60).optional(),
  city: z.string().max(80).optional(),
  district: z.string().max(80).optional(),
  pincode: z.string().max(12).optional(),
  address: OptionalAddressSchema,
  additionalInfo: z.string().max(800).optional(),
  assignments: AssignmentsSchema,
  createdAt: z.string().min(1),
})

export const CreateProjectSchema = z.object({
  projectName: z.string().min(2, 'Project name must be at least 2 characters').max(120),
  description: z.string().max(500).optional(),
  state: z.string().min(2, 'State is required').max(60),
  city: z.string().min(2, 'City is required').max(80),
  district: z.string().min(2, 'District is required').max(80),
  pincode: z
    .string()
    .trim()
    .min(4, 'Pincode is required')
    .max(12, 'Pincode is too long')
    .regex(/^[0-9]+$/, 'Pincode must be numbers only'),
  address: OptionalAddressSchema,
  additionalInfo: z.string().max(800).optional(),
  assignments: AssignmentsSchema.default({}),
})

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>

export const UpdateProjectSchema = CreateProjectSchema.extend({
  assignments: AssignmentsSchema.optional(),
})

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>

function nowISO() {
  return new Date().toISOString()
}

function genProjectId(existingCount: number) {
  const n = (existingCount + 1).toString().padStart(3, '0')
  return `PROJ-${n}`
}

export function listProjects(): Project[] {
  const raw = readLocalStorageJSON<unknown>(STORAGE_KEY)
  const parsed = z.array(StoredProjectSchema).safeParse(raw)
  if (!parsed.success) {
    writeLocalStorageJSON<Project[]>(STORAGE_KEY, [])
    return []
  }
  return parsed.data
}

export function getProjectById(id: string): Project | undefined {
  return listProjects().find((p) => p.id === id)
}

export function createProject(input: CreateProjectInput): Project {
  const validated = CreateProjectSchema.parse(input)
  const projects = listProjects()

  const project: Project = {
    id: genProjectId(projects.length),
    createdAt: nowISO(),
    ...validated,
  }

  const next = [project, ...projects]
  writeLocalStorageJSON(STORAGE_KEY, next)
  return project
}

export function updateProject(projectId: string, input: UpdateProjectInput): Project {
  const validated = UpdateProjectSchema.parse(input)
  const projects = listProjects()
  const idx = projects.findIndex((p) => p.id === projectId)
  if (idx === -1) throw new Error('Project not found')

  const prev = projects[idx]
  const nextProject: Project = {
    ...prev,
    ...validated,
    assignments: { ...(prev.assignments ?? {}), ...(validated.assignments ?? {}) },
  }

  const next = [...projects]
  next[idx] = nextProject
  writeLocalStorageJSON(STORAGE_KEY, next)
  return nextProject
}

export function updateProjectAssignments(projectId: string, assignments: ProjectAssignments): Project {
  const projects = listProjects()
  const idx = projects.findIndex((p) => p.id === projectId)
  if (idx === -1) throw new Error('Project not found')

  const nextProject: Project = {
    ...projects[idx],
    assignments: { ...projects[idx].assignments, ...assignments },
  }

  const next = [...projects]
  next[idx] = nextProject
  writeLocalStorageJSON(STORAGE_KEY, next)
  return nextProject
}

export function deleteProject(projectId: string) {
  const projects = listProjects()
  const next = projects.filter((p) => p.id !== projectId)
  writeLocalStorageJSON(STORAGE_KEY, next)
}

