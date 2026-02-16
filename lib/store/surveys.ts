import { z } from "zod"

import { readLocalStorageJSON, writeLocalStorageJSON } from "@/lib/store/storage"
import { listUsers } from "@/lib/store/users"

export type FileMeta = {
  name: string
  type: string
  size: number
  /** Public URL after upload to storage (e.g. Supabase Storage). */
  url?: string
}

export type SurveyUploadKeys =
  | "aadhaarCard"
  | "panCard"
  | "bankProof"
  | "eBill"
  | "beneficiaryPhoto"
  | "siteLayout"
  | "roofTerraceNorth"
  | "roofTerraceSouth"
  | "earthingAreaPic"
  | "inverterAreaPic"

export type SurveyActivityAction =
  | "submitted"
  | "status_changed"
  | "edited"
  | "installer_assigned"
  | "installation_created"
  | "inspection_submitted"

export type SurveyActivityEvent = {
  at: string
  actorId?: string
  action: SurveyActivityAction
  message: string
  meta?: Record<string, unknown>
}

export type Survey = {
  id: string
  projectId?: string
  beneficiaryName: string
  serviceNo: string
  aadharNo: string
  mobile?: string
  panNo: string
  contractedLoad?: number
  status: "pending" | "approved" | "rejected" | "completed"
  uploadDate: string
  approvedDate?: string
  submittedById?: string
  submittedAt: string
  installerId?: string
  discomName: "APSPDCL" | "APCPDCL" | "APEPDCL"
  plantType: "On Grid"
  buildingHeight: number
  totalRoofs: "G" | "G+1" | "G+2" | "G+3"
  roofType: "RCC" | "Metal Shed" | "Cement Shed" | "Ground Mount"
  siteDetails?: {
    gpsLat?: string
    gpsLng?: string
    accuracyMeters?: number
    capturedAt?: string
    meterAcCableMeters?: number
    meterDcCableMeters?: number
    slabThicknessInches?: number
  }
  siteLocation: {
    section?: string
    subDivision?: string
    division?: string
    circle?: string
    address?: string
    mandal?: string
    district: string
    pinCode: string
    state?: string
    city?: string
  }
  bankDetails: {
    bankName: string
    accountNo: string
    ifsc: string
    branch?: string
  }
  remarks?: string
  uploads: Partial<Record<SurveyUploadKeys, FileMeta>>
  activity: SurveyActivityEvent[]
  createdAt: string
}

const STORAGE_KEY = "solarepc.surveys.v2"

const FileMetaSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  size: z.number().nonnegative(),
  url: z.string().optional(),
})

const SurveyActivityEventSchema = z.object({
  at: z.string().min(1),
  actorId: z.string().optional(),
  action: z.enum(["submitted", "status_changed", "edited", "installer_assigned", "installation_created", "inspection_submitted"]),
  message: z.string().min(1),
  meta: z.record(z.unknown()).optional(),
})

const OptionalTrimmedString = z.preprocess(
  (v) => (typeof v === "string" && v.trim().length === 0 ? undefined : v),
  z.string().max(250).optional(),
)

export const CreateSurveySchema = z.object({
  beneficiaryName: z.string().trim().min(2, "Name of the beneficiary is required").max(120),
  serviceNo: z.string().trim().min(2, "Service No is required").max(40),
  aadharNo: z
    .string()
    .trim()
    .min(12, "Aadhar No must be 12 digits")
    .max(12, "Aadhar No must be 12 digits")
    .regex(/^[0-9]+$/, "Aadhar No must be numbers only"),
  mobile: z
    .preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z
    .string()
    .trim()
    .min(10, "Mobile must be at least 10 digits")
    .max(15, "Mobile is too long")
    .regex(/^[0-9]+$/, "Mobile must be numbers only")
    .optional()),
  panNo: z
    .preprocess((v) => (v == null || (typeof v === "string" && v.trim() === "") ? undefined : v), z
    .string()
    .trim()
    .min(10, "PAN No must be 10 characters")
    .max(10, "PAN No must be 10 characters")
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i, "PAN format is invalid (e.g. ABCDE1234F)")
    .optional()),
  contractedLoad: z
    .preprocess((v) => {
      if (v === "" || v == null || v === 0 || v === "0") return undefined
      if (typeof v === "number" && Number.isNaN(v)) return undefined
      return v
    }, z.coerce.number().positive("Contracted Load must be > 0").optional())
    .optional(),
  discomName: z.enum(["APSPDCL", "APCPDCL", "APEPDCL"]),
  plantType: z.literal("On Grid").default("On Grid"),
  buildingHeight: z
    .preprocess((v) => {
      if (v === "" || v == null || v === 0 || v === "0") return undefined
      if (typeof v === "number" && Number.isNaN(v)) return undefined
      return v
    }, z.coerce.number().positive("Building height must be > 0").optional())
    .optional(),
  totalRoofs: z.enum(["G", "G+1", "G+2", "G+3"]),
  roofType: z.enum(["RCC", "Metal Shed", "Cement Shed", "Ground Mount"]),
  siteLocation: z.object({
    section: OptionalTrimmedString,
    subDivision: OptionalTrimmedString,
    division: OptionalTrimmedString,
    circle: OptionalTrimmedString,
    address: OptionalTrimmedString,
    mandal: OptionalTrimmedString,
    district: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().min(2, "District must be at least 2 characters").max(80).optional()),
    pinCode: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().trim().min(4, "Pin Code must be 4–12 digits").max(12).regex(/^[0-9]+$/, "Pin Code must be numbers only").optional()
    ),
    state: OptionalTrimmedString,
    city: OptionalTrimmedString,
  }),
  bankDetails: z
    .object({
      bankName: z.preprocess((v) => (v == null || (typeof v === "string" && v.trim() === "") ? undefined : v), z.string().trim().min(2, "Bank name must be at least 2 characters").max(120).optional()),
      accountNo: z.preprocess((v) => (v == null || (typeof v === "string" && v.trim() === "") ? undefined : v), z.string().trim().min(6, "Account No must be at least 6 characters").max(30).optional()),
      ifsc: z.preprocess((v) => (v == null || (typeof v === "string" && v.trim() === "") ? undefined : v), z.string().trim().min(5, "IFSC must be valid").max(20).regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, "IFSC format is invalid (e.g. SBIN0001234)").optional()),
      branch: OptionalTrimmedString,
    })
    .optional()
    .default({}),
  remarks: z.preprocess(
    (v) => (typeof v === "string" && v.trim().length === 0 ? undefined : v),
    z.string().max(2000, "Remarks must be 2000 characters or less").optional(),
  ),
})

export type CreateSurveyInput = z.infer<typeof CreateSurveySchema>

const SurveySchema: z.ZodType<Survey> = z.object({
  id: z.string().min(1),
  beneficiaryName: z.string().min(1),
  serviceNo: z.string().min(1),
  aadharNo: z.string().min(1),
  mobile: z.string().optional(),
  panNo: z.string().optional().default(""),
  contractedLoad: z.number().optional(),
  status: z.enum(["pending", "approved", "rejected", "completed"]),
  uploadDate: z.string().min(1),
  approvedDate: z.string().optional(),
  submittedById: z.string().optional(),
  submittedAt: z.string().min(1),
  installerId: z.string().optional(),
  discomName: z.enum(["APSPDCL", "APCPDCL", "APEPDCL"]),
  plantType: z.literal("On Grid"),
  buildingHeight: z.number().optional().default(0),
  totalRoofs: z.enum(["G", "G+1", "G+2", "G+3"]),
  roofType: z.enum(["RCC", "Metal Shed", "Cement Shed", "Ground Mount"]),
  siteDetails: z
    .object({
      gpsLat: z.string().optional(),
      gpsLng: z.string().optional(),
      accuracyMeters: z.number().optional(),
      capturedAt: z.string().optional(),
      meterAcCableMeters: z.number().optional(),
      meterDcCableMeters: z.number().optional(),
      slabThicknessInches: z.number().optional(),
    })
    .optional(),
  siteLocation: z.object({
    section: z.string().optional(),
    subDivision: z.string().optional(),
    division: z.string().optional(),
    circle: z.string().optional(),
    address: z.string().optional(),
    mandal: z.string().optional(),
    district: z.string().min(1),
    pinCode: z.string().min(1),
    state: z.string().optional(),
    city: z.string().optional(),
  }),
  bankDetails: z.object({
    bankName: z.string().optional().default(""),
    accountNo: z.string().optional().default(""),
    ifsc: z.string().optional().default(""),
    branch: z.string().optional(),
  }),
  remarks: z.string().optional(),
  // Zod v3: `partial()` is not available on `z.record(...)`
  uploads: z.record(FileMetaSchema).optional().default({}),
  activity: z.array(SurveyActivityEventSchema).default([]),
  createdAt: z.string().min(1),
})

function nowISO() {
  return new Date().toISOString()
}

function defaultSurveyorId(): string | undefined {
  return listUsers().find((u) => u.role === "surveyor")?.id
}

function defaultManagerId(): string | undefined {
  return listUsers().find((u) => u.role === "manager" || u.role === "admin")?.id
}

function genSurveyId(existingCount: number) {
  const n = (existingCount + 1).toString().padStart(3, "0")
  return `SUR-${n}`
}

export function listSurveys(): Survey[] {
  const raw = readLocalStorageJSON<unknown>(STORAGE_KEY)
  const parsed = z.array(SurveySchema).safeParse(raw)
  if (!parsed.success) {
    writeLocalStorageJSON<Survey[]>(STORAGE_KEY, [])
    return []
  }
  return parsed.data
}

export function getSurveyById(id: string): Survey | undefined {
  return listSurveys().find((s) => s.id === id)
}

export function createSurvey(
  input: CreateSurveyInput,
  uploads: Partial<Record<SurveyUploadKeys, FileMeta>>,
  siteDetails: Survey["siteDetails"] | undefined,
  submittedById?: string,
) {
  const validated = CreateSurveySchema.parse(input)
  const surveys = listSurveys()
  const serviceNoTrim = validated.serviceNo.trim().toLowerCase()
  const duplicate = surveys.find((s) => s.serviceNo.trim().toLowerCase() === serviceNoTrim)
  if (duplicate) throw new Error("Service number is already used by another survey. Please use a unique service number.")

  const uploadDate = nowISO()
  const actorId = submittedById ?? defaultSurveyorId()

  const survey: Survey = {
    id: genSurveyId(surveys.length),
    beneficiaryName: validated.beneficiaryName,
    serviceNo: validated.serviceNo,
    aadharNo: validated.aadharNo,
    mobile: validated.mobile,
    panNo: (validated.panNo ?? "").toString().toUpperCase(),
    contractedLoad: validated.contractedLoad,
    status: "pending",
    uploadDate,
    approvedDate: undefined,
    submittedById: actorId,
    submittedAt: uploadDate,
    installerId: undefined,
    discomName: validated.discomName,
    plantType: validated.plantType,
    buildingHeight: validated.buildingHeight ?? 0,
    totalRoofs: validated.totalRoofs,
    roofType: validated.roofType,
    siteLocation: validated.siteLocation,
    bankDetails: {
      bankName: validated.bankDetails?.bankName ?? "",
      accountNo: validated.bankDetails?.accountNo ?? "",
      ifsc: (validated.bankDetails?.ifsc ?? "").toString().toUpperCase(),
      branch: validated.bankDetails?.branch ?? "",
    },
    remarks: validated.remarks,
    uploads,
    siteDetails,
    activity: [
      {
        at: uploadDate,
        actorId,
        action: "submitted",
        message: "Survey submitted",
      },
    ],
    createdAt: uploadDate,
  }

  const next = [survey, ...surveys]
  writeLocalStorageJSON(STORAGE_KEY, next)
  return survey
}

export function updateSurvey(
  id: string,
  input: CreateSurveyInput,
  uploads: Partial<Record<SurveyUploadKeys, FileMeta>>,
  siteDetails: Survey["siteDetails"] | undefined,
  submittedById?: string,
) {
  const validated = CreateSurveySchema.parse(input)
  const surveys = listSurveys()
  const idx = surveys.findIndex((s) => s.id === id)
  if (idx === -1) throw new Error("Survey not found")

  const serviceNoTrim = validated.serviceNo.trim().toLowerCase()
  const duplicate = surveys.find((s) => s.id !== id && s.serviceNo.trim().toLowerCase() === serviceNoTrim)
  if (duplicate) throw new Error("Service number is already used by another survey. Please use a unique service number.")

  const prev = surveys[idx]
  const now = nowISO()
  const actorId = defaultManagerId()

  const nextItem: Survey = {
    ...prev,
    beneficiaryName: validated.beneficiaryName,
    serviceNo: validated.serviceNo,
    aadharNo: validated.aadharNo,
    mobile: validated.mobile,
    panNo: (validated.panNo ?? "").toString().toUpperCase(),
    contractedLoad: validated.contractedLoad,
    discomName: validated.discomName,
    plantType: validated.plantType,
    buildingHeight: validated.buildingHeight ?? 0,
    totalRoofs: validated.totalRoofs,
    roofType: validated.roofType,
    siteLocation: validated.siteLocation,
    bankDetails: {
      bankName: validated.bankDetails?.bankName ?? "",
      accountNo: validated.bankDetails?.accountNo ?? "",
      ifsc: (validated.bankDetails?.ifsc ?? "").toString().toUpperCase(),
      branch: validated.bankDetails?.branch ?? "",
    },
    remarks: validated.remarks,
    uploads,
    siteDetails,
    submittedById: submittedById ?? prev.submittedById,
    activity: [
      ...(prev.activity ?? []),
      {
        at: now,
        actorId,
        action: "edited",
        message: "Survey updated",
      },
    ],
  }

  const next = [...surveys]
  next[idx] = nextItem
  writeLocalStorageJSON(STORAGE_KEY, next)
  return nextItem
}

export function updateSurveyStatus(id: string, status: Survey["status"]) {
  const surveys = listSurveys()
  const idx = surveys.findIndex((s) => s.id === id)
  if (idx === -1) throw new Error("Survey not found")

  const now = nowISO()
  const prev = surveys[idx]
  if (status === "completed" && !prev.installerId) {
    throw new Error("Assign installer before marking survey as completed")
  }
  const actorId = defaultManagerId()
  const nextItem: Survey = {
    ...prev,
    status,
    approvedDate:
      status === "approved" || status === "completed"
        ? prev.approvedDate ?? now
        : prev.approvedDate,
    activity: [
      ...(prev.activity ?? []),
      {
        at: now,
        actorId,
        action: "status_changed",
        message: `Status changed to ${status}`,
        meta: { status },
      },
    ],
  }

  const next = [...surveys]
  next[idx] = nextItem
  writeLocalStorageJSON(STORAGE_KEY, next)
  return nextItem
}

export function assignSurveyInstaller(id: string, installerId?: string) {
  const surveys = listSurveys()
  const idx = surveys.findIndex((s) => s.id === id)
  if (idx === -1) throw new Error("Survey not found")

  const prev = surveys[idx]
  const now = nowISO()
  const actorId = defaultManagerId()
  const nextItem: Survey = { ...prev, installerId }
  nextItem.activity = [
    ...(prev.activity ?? []),
    {
      at: now,
      actorId,
      action: "installer_assigned",
      message: installerId ? `Installer assigned (${installerId})` : "Installer unassigned",
      meta: { installerId: installerId ?? null },
    },
  ]
  const next = [...surveys]
  next[idx] = nextItem
  writeLocalStorageJSON(STORAGE_KEY, next)
  return nextItem
}

export function appendSurveyActivity(id: string, event: Omit<SurveyActivityEvent, "at"> & { at?: string }) {
  const surveys = listSurveys()
  const idx = surveys.findIndex((s) => s.id === id)
  if (idx === -1) throw new Error("Survey not found")
  const prev = surveys[idx]
  const nextEvent: SurveyActivityEvent = { at: event.at ?? nowISO(), actorId: event.actorId, action: event.action, message: event.message, meta: event.meta }
  const nextItem: Survey = { ...prev, activity: [...(prev.activity ?? []), nextEvent] }
  const next = [...surveys]
  next[idx] = nextItem
  writeLocalStorageJSON(STORAGE_KEY, next)
  return nextItem
}

export function deleteSurvey(id: string): void {
  const surveys = listSurveys()
  const idx = surveys.findIndex((s) => s.id === id)
  if (idx === -1) throw new Error("Survey not found")
  const next = surveys.filter((_, i) => i !== idx)
  writeLocalStorageJSON(STORAGE_KEY, next)
}

