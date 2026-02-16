import { z } from "zod"

import { readLocalStorageJSON, writeLocalStorageJSON } from "@/lib/store/storage"

export type InstallationStatus = "pending" | "in_progress" | "completed" | "inspection_pending"

export type Material = {
  id: string
  name: string
  serialNumber: string
  barcode: string
  scannedAt?: string
}

export type InstallationPhotoMeta = {
  id: string
  category: "panel_placement" | "wiring" | "inverter" | "meter" | "overall"
  description: string
  file?: { name: string; type: string; size: number }
  uploadedAt?: string
}

export type Installation = {
  id: string
  projectId?: string
  surveyId?: string
  customerName: string
  address: string
  engineerName?: string
  engineerId?: string
  status: InstallationStatus
  startedAt?: string
  completedAt?: string
  materials: Material[]
  photos: InstallationPhotoMeta[]
  createdAt: string
}

const STORAGE_KEY = "solarepc.installations.v1"

const InstallationStatusSchema = z.enum(["pending", "in_progress", "completed", "inspection_pending"])

const MaterialSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  serialNumber: z.string().min(1),
  barcode: z.string().optional().default(""),
  scannedAt: z.string().optional(),
})

const PhotoSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["panel_placement", "wiring", "inverter", "meter", "overall"]),
  description: z.string().optional().default(""),
  file: z
    .object({
      name: z.string().min(1),
      type: z.string().min(1),
      size: z.number().nonnegative(),
    })
    .optional(),
  uploadedAt: z.string().optional(),
})

export const CreateInstallationSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
  surveyId: z.string().trim().min(1).optional(),
  customerName: z.string().trim().min(2, "Customer name is required").max(120),
  address: z.string().trim().min(10, "Address must be at least 10 characters").max(240),
  engineerName: z.string().trim().min(2).max(80).optional(),
  engineerId: z.string().trim().min(2).max(40).optional(),
})

export type CreateInstallationInput = z.infer<typeof CreateInstallationSchema>

const InstallationSchema: z.ZodType<Installation> = z.object({
  id: z.string().min(1),
  projectId: z.string().optional(),
  surveyId: z.string().optional(),
  customerName: z.string().min(1),
  address: z.string().min(1),
  engineerName: z.string().optional(),
  engineerId: z.string().optional(),
  status: InstallationStatusSchema,
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  materials: z.array(MaterialSchema).default([]),
  photos: z.array(PhotoSchema).default([]),
  createdAt: z.string().min(1),
})

function nowISO() {
  return new Date().toISOString()
}

function genInstallationId(existingCount: number) {
  const n = (existingCount + 1).toString().padStart(3, "0")
  return `INST-${n}`
}

export function listInstallations(): Installation[] {
  const raw = readLocalStorageJSON<unknown>(STORAGE_KEY)
  const parsed = z.array(InstallationSchema).safeParse(raw)
  if (!parsed.success) {
    writeLocalStorageJSON<Installation[]>(STORAGE_KEY, [])
    return []
  }
  return parsed.data
}

export function getInstallationById(id: string): Installation | undefined {
  return listInstallations().find((i) => i.id === id)
}

export function createInstallation(
  input: CreateInstallationInput,
  payload: { materials: Material[]; photos: InstallationPhotoMeta[] },
) {
  const validated = CreateInstallationSchema.parse(input)
  const installations = listInstallations()
  const createdAt = nowISO()
  const installation: Installation = {
    id: genInstallationId(installations.length),
    status: "pending",
    materials: payload.materials,
    photos: payload.photos,
    createdAt,
    ...validated,
  }
  const next = [installation, ...installations]
  writeLocalStorageJSON(STORAGE_KEY, next)
  return installation
}

export function updateInstallation(
  id: string,
  input: CreateInstallationInput,
  payload: { materials: Material[]; photos: InstallationPhotoMeta[] },
) {
  const validated = CreateInstallationSchema.parse(input)
  const installations = listInstallations()
  const idx = installations.findIndex((i) => i.id === id)
  if (idx === -1) throw new Error("Installation not found")

  const prev = installations[idx]
  const nextItem: Installation = {
    ...prev,
    ...validated,
    materials: payload.materials,
    photos: payload.photos,
    // preserve workflow fields
    status: prev.status,
    startedAt: prev.startedAt,
    completedAt: prev.completedAt,
    createdAt: prev.createdAt,
  }

  const next = [...installations]
  next[idx] = nextItem
  writeLocalStorageJSON(STORAGE_KEY, next)
  return nextItem
}

export function updateInstallationStatus(id: string, status: InstallationStatus) {
  const installations = listInstallations()
  const idx = installations.findIndex((i) => i.id === id)
  if (idx === -1) throw new Error("Installation not found")

  const prev = installations[idx]
  const now = nowISO()
  const nextItem: Installation = {
    ...prev,
    status,
    startedAt: status === "in_progress" ? prev.startedAt ?? now : prev.startedAt,
    completedAt:
      status === "completed" || status === "inspection_pending" ? prev.completedAt ?? now : prev.completedAt,
  }

  const next = [...installations]
  next[idx] = nextItem
  writeLocalStorageJSON(STORAGE_KEY, next)
  return nextItem
}

