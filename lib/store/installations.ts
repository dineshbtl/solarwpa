import { z } from "zod"

import { readLocalStorageJSON, writeLocalStorageJSON } from "@/lib/store/storage"

export type InstallationStatus = "pending" | "in_progress" | "completed" | "inspection_pending"

export type Material = {
  id: string
  name: string
  serialNumber: string
  barcode: string
  /** For DC/AC cable and earthing wire (no serial). Stored as string for form input (e.g. "12.5"). */
  lengthMeters?: string
  /** Solar panel set: capture 4 panel serials on one line. */
  panelSerials?: string[]
  /** Solar panel set: one barcode per panel (4 total). */
  panelBarcodes?: string[]
  /** Optional material evidence image (single) */
  photo?: {
    name: string
    type: string
    size: number
    url?: string
  }
  /** Optional solar panel evidence images (up to 4) */
  panelPhotos?: Array<{
    name: string
    type: string
    size: number
    url?: string
  }>
  scannedAt?: string
  /** For kit/counted items tracked by quantity instead of serial. */
  quantity?: number
  /** GPS per panel photo (up to 4) */
  panelPhotoGps?: Array<{
    latitude?: number
    longitude?: number
    gpsAccuracyMeters?: number
    gpsSource?: "exif" | "device" | "manual"
  } | null>
}

export type InstallationPhotoMeta = {
  id: string
  category: "panel_placement" | "wiring" | "inverter" | "meter" | "overall" | "earthing"
  description: string
  file?: { name: string; type: string; size: number }
  /** Public or data URL after upload (required for detail view to show the image). */
  url?: string
  uploadedAt?: string
  /** Optional GPS for site evidence (EXIF from file, device capture, or manual entry). */
  latitude?: number
  longitude?: number
  gpsAccuracyMeters?: number
  gpsSource?: "exif" | "device" | "manual"
}

export type InstallationActivityAction =
  | "created"
  | "step_saved"
  | "material_scanned"
  | "photo_uploaded"
  | "commissioning_check"
  | "fault_reported"
  | "quality_checked"
  | "declaration_signed"
  | "status_changed"
  | "edited"

export type InstallationActivityEvent = {
  at: string
  actorId?: string
  actorName?: string
  action: InstallationActivityAction
  message: string
  meta?: Record<string, unknown>
}

export type InstallationChecklist = {
  panelsInstalled?: boolean
  structureFixed?: boolean
  inverterInstalled?: boolean
  dcCabling?: boolean
  acCabling?: boolean
  earthing?: boolean
}

export type CommissioningData = {
  powerOn?: boolean
  inverterStartup?: boolean
  powerGenerated?: boolean
  safetyChecks?: boolean
  status?: "approved" | "pending"
  notes?: string
  checkedAt?: string
  checkedBy?: string
}

export type QualityCheck = {
  systemPerformance?: "normal" | "not_normal"
  physicalInspection?: "ok" | "needs_attention"
  monitoringAvailable?: boolean
  notes?: string
}

export type FaultReport = {
  faultDetected?: boolean
  faultType?: "inverter" | "panel" | "wiring" | "monitoring" | "other"
  description?: string
  actionTaken?: string
  status?: "resolved" | "pending"
  reportedAt?: string
  reportedBy?: string
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
  visitType?: "installation" | "commissioning"
  arrivalTime?: string
  departureTime?: string
  siteAccessible?: boolean
  siteGps?: { lat?: number; lng?: number; accuracy?: number; source?: string }
  installationChecklist?: InstallationChecklist
  commissioningData?: CommissioningData
  qualityCheck?: QualityCheck
  faultReport?: FaultReport
  signatureUrl?: string
  declarationConfirmed?: boolean
  submittedAt?: string
  activity?: InstallationActivityEvent[]
}

const STORAGE_KEY = "solarepc.installations.v1"

const InstallationStatusSchema = z.enum(["pending", "in_progress", "completed", "inspection_pending"])

const MaterialSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  serialNumber: z.string().optional().default(""),
  barcode: z.string().optional().default(""),
  lengthMeters: z.string().optional(),
  panelSerials: z.array(z.string()).optional(),
  panelBarcodes: z.array(z.string()).optional(),
  photo: z
    .object({
      name: z.string().min(1),
      type: z.string().min(1),
      size: z.number().nonnegative(),
      url: z.string().optional(),
    })
    .optional(),
  panelPhotos: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.string().min(1),
        size: z.number().nonnegative(),
        url: z.string().optional(),
      })
    )
    .optional(),
  scannedAt: z.string().optional(),
  quantity: z.number().nonnegative().optional(),
  panelPhotoGps: z
    .array(
      z
        .object({
          latitude: z.number().min(-90).max(90).optional(),
          longitude: z.number().min(-180).max(180).optional(),
          gpsAccuracyMeters: z.number().nonnegative().optional(),
          gpsSource: z.enum(["exif", "device", "manual"]).optional(),
        })
        .nullable()
    )
    .optional(),
})

const PhotoSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["panel_placement", "wiring", "inverter", "meter", "overall", "earthing"]),
  description: z.string().optional().default(""),
  file: z
    .object({
      name: z.string().min(1),
      type: z.string().min(1),
      size: z.number().nonnegative(),
    })
    .optional(),
  url: z.string().optional(),
  uploadedAt: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  gpsAccuracyMeters: z.number().nonnegative().optional(),
  gpsSource: z.enum(["exif", "device", "manual"]).optional(),
})

/** Persisted wizard fields (create/update payload); activity is not client-controlled here. */
export const InstallationWizardFieldsSchema = z.object({
  visitType: z.enum(["installation", "commissioning"]).optional(),
  arrivalTime: z.string().optional(),
  departureTime: z.string().optional(),
  siteAccessible: z.boolean().optional(),
  siteGps: z
    .object({
      lat: z.number().optional(),
      lng: z.number().optional(),
      accuracy: z.number().optional(),
      source: z.string().optional(),
    })
    .optional(),
  installationChecklist: z
    .object({
      panelsInstalled: z.boolean().optional(),
      structureFixed: z.boolean().optional(),
      inverterInstalled: z.boolean().optional(),
      dcCabling: z.boolean().optional(),
      acCabling: z.boolean().optional(),
      earthing: z.boolean().optional(),
    })
    .optional(),
  commissioningData: z
    .object({
      powerOn: z.boolean().optional(),
      inverterStartup: z.boolean().optional(),
      powerGenerated: z.boolean().optional(),
      safetyChecks: z.boolean().optional(),
      status: z.enum(["approved", "pending"]).optional(),
      notes: z.string().optional(),
      checkedAt: z.string().optional(),
      checkedBy: z.string().optional(),
    })
    .optional(),
  qualityCheck: z
    .object({
      systemPerformance: z.enum(["normal", "not_normal"]).optional(),
      physicalInspection: z.enum(["ok", "needs_attention"]).optional(),
      monitoringAvailable: z.boolean().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  faultReport: z
    .object({
      faultDetected: z.boolean().optional(),
      faultType: z.enum(["inverter", "panel", "wiring", "monitoring", "other"]).optional(),
      description: z.string().optional(),
      actionTaken: z.string().optional(),
      status: z.enum(["resolved", "pending"]).optional(),
      reportedAt: z.string().optional(),
      reportedBy: z.string().optional(),
    })
    .optional(),
  signatureUrl: z.string().optional(),
  declarationConfirmed: z.boolean().optional(),
  submittedAt: z.string().optional(),
})

export const CreateInstallationSchema = z
  .object({
    projectId: z.string().trim().min(1).optional(),
    surveyId: z.string().trim().min(1).optional(),
    customerName: z.string().trim().min(2, "Customer name is required").max(120),
    address: z.string().trim().min(10, "Address must be at least 10 characters").max(240),
    engineerName: z.string().trim().min(2).max(80).optional(),
    engineerId: z.string().trim().min(2).max(40).optional(),
  })
  .merge(InstallationWizardFieldsSchema)

export type CreateInstallationInput = z.infer<typeof CreateInstallationSchema>

/** Maps wizard fields from create/update API input to Supabase `installations` column names. Omits undefined keys. */
export function createInstallationWizardDbColumns(
  input: CreateInstallationInput
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (input.visitType !== undefined) out.visit_type = input.visitType
  if (input.arrivalTime !== undefined) out.arrival_time = input.arrivalTime
  if (input.departureTime !== undefined) out.departure_time = input.departureTime
  if (input.siteAccessible !== undefined) out.site_accessible = input.siteAccessible
  if (input.siteGps !== undefined) out.site_gps = input.siteGps
  if (input.installationChecklist !== undefined) out.installation_checklist = input.installationChecklist
  if (input.commissioningData !== undefined) out.commissioning_data = input.commissioningData
  if (input.qualityCheck !== undefined) out.quality_check = input.qualityCheck
  if (input.faultReport !== undefined) out.fault_report = input.faultReport
  if (input.signatureUrl !== undefined) out.signature_url = input.signatureUrl
  if (input.declarationConfirmed !== undefined) out.declaration_confirmed = input.declarationConfirmed
  if (input.submittedAt !== undefined) out.submitted_at = input.submittedAt
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const InstallationSchema = z
  .object({
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
  .merge(InstallationWizardFieldsSchema)
  .extend({
  activity: z
    .array(
      z.object({
        at: z.string(),
        actorId: z.string().optional(),
        actorName: z.string().optional(),
        action: z.enum([
          "created",
          "step_saved",
          "material_scanned",
          "photo_uploaded",
          "commissioning_check",
          "fault_reported",
          "quality_checked",
          "declaration_signed",
          "status_changed",
          "edited",
        ]),
        message: z.string(),
        meta: z.record(z.unknown()).optional(),
      })
    )
    .optional(),
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

