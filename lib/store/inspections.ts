import { z } from "zod"

import { readLocalStorageJSON, writeLocalStorageJSON } from "@/lib/store/storage"
import { listUsers } from "@/lib/store/users"

export type InspectionStatus = "pending" | "approved" | "rejected" | "reopened"

export type InspectionActivityAction =
  | "created"
  | "inspector_assigned"
  | "approved"
  | "rejected"
  | "edited"
  | "status_changed"

export type InspectionActivityEvent = {
  at: string
  actorId?: string
  action: InspectionActivityAction
  message: string
  meta?: Record<string, unknown>
}

export type Inspection = {
  id: string
  installationId: string
  projectId?: string
  surveyId?: string
  customerName: string
  address: string
  status: InspectionStatus
  inspectorId?: string
  managerApproval: {
    approved: boolean
    remarks: string
    approvedAt?: string
    approvedBy?: string
  }
  governmentInspection?: {
    approved: boolean
    remarks: string
    inspectedAt?: string
    inspectorName?: string
  }
  activity: InspectionActivityEvent[]
  createdAt: string
}

const STORAGE_KEY = "solarepc.inspections.v1"

const InspectionActivityEventSchema = z.object({
  at: z.string().min(1),
  actorId: z.string().optional(),
  action: z.enum(["created", "inspector_assigned", "approved", "rejected", "edited", "status_changed"]),
  message: z.string().min(1),
  meta: z.record(z.unknown()).optional(),
})

const InspectionSchema: z.ZodType<Inspection> = z.object({
  id: z.string().min(1),
  installationId: z.string().min(1),
  projectId: z.string().optional(),
  surveyId: z.string().optional(),
  customerName: z.string().min(1),
  address: z.string().min(1),
  status: z.enum(["pending", "approved", "rejected", "reopened"]),
  inspectorId: z.string().optional(),
  managerApproval: z.object({
    approved: z.boolean(),
    remarks: z.string().optional().default(""),
    approvedAt: z.string().optional(),
    approvedBy: z.string().optional(),
  }),
  governmentInspection: z
    .object({
      approved: z.boolean(),
      remarks: z.string().optional().default(""),
      inspectedAt: z.string().optional(),
      inspectorName: z.string().optional(),
    })
    .optional(),
  activity: z.array(InspectionActivityEventSchema).default([]),
  createdAt: z.string().min(1),
})

function nowISO() {
  return new Date().toISOString()
}

function defaultGovInspectorId(): string | undefined {
  return listUsers().find((u) => u.role === "government")?.id
}

function genInspectionId(existingCount: number) {
  const n = (existingCount + 1).toString().padStart(3, "0")
  return `INSP-${n}`
}

export function listInspections(): Inspection[] {
  const raw = readLocalStorageJSON<unknown>(STORAGE_KEY)
  const parsed = z.array(InspectionSchema).safeParse(raw)
  if (!parsed.success) {
    writeLocalStorageJSON<Inspection[]>(STORAGE_KEY, [])
    return []
  }
  return parsed.data
}

export function getInspectionById(id: string): Inspection | undefined {
  return listInspections().find((i) => i.id === id)
}

export function getInspectionByInstallationId(installationId: string): Inspection | undefined {
  return listInspections().find((i) => i.installationId === installationId)
}

export function createInspection(input: {
  installationId: string
  projectId?: string
  surveyId?: string
  customerName: string
  address: string
}): Inspection {
  const inspections = listInspections()
  const createdAt = nowISO()
  const actorId = defaultGovInspectorId()
  const inspection: Inspection = {
    id: genInspectionId(inspections.length),
    status: "pending",
    inspectorId: actorId,
    managerApproval: { approved: false, remarks: "" },
    activity: [
      {
        at: createdAt,
        actorId,
        action: "created",
        message: "Inspection created",
      },
    ],
    createdAt,
    ...input,
  }
  const next = [inspection, ...inspections]
  writeLocalStorageJSON(STORAGE_KEY, next)
  return inspection
}

export function updateInspectionStatus(id: string, status: InspectionStatus): Inspection {
  const inspections = listInspections()
  const idx = inspections.findIndex((i) => i.id === id)
  if (idx === -1) throw new Error("Inspection not found")
  const prev = inspections[idx]
  const nextItem: Inspection = {
    ...prev,
    status,
    activity: [
      ...(prev.activity ?? []),
      { at: nowISO(), actorId: defaultGovInspectorId(), action: "status_changed", message: `Status changed to ${status}`, meta: { status } },
    ],
  }
  const next = [...inspections]
  next[idx] = nextItem
  writeLocalStorageJSON(STORAGE_KEY, next)
  return nextItem
}

export function assignInspectionInspector(id: string, inspectorId?: string) {
  const inspections = listInspections()
  const idx = inspections.findIndex((i) => i.id === id)
  if (idx === -1) throw new Error("Inspection not found")
  const prev = inspections[idx]
  const now = nowISO()
  const nextItem: Inspection = {
    ...prev,
    inspectorId,
    activity: [
      ...(prev.activity ?? []),
      {
        at: now,
        actorId: defaultGovInspectorId(),
        action: "inspector_assigned",
        message: inspectorId ? `Inspector assigned (${inspectorId})` : "Inspector unassigned",
        meta: { inspectorId: inspectorId ?? null },
      },
    ],
  }
  const next = [...inspections]
  next[idx] = nextItem
  writeLocalStorageJSON(STORAGE_KEY, next)
  return nextItem
}

export function updateInspectionDetails(id: string, patch: { customerName: string; address: string; inspectorId?: string }) {
  const inspections = listInspections()
  const idx = inspections.findIndex((i) => i.id === id)
  if (idx === -1) throw new Error("Inspection not found")
  const prev = inspections[idx]
  const now = nowISO()

  const nextItem: Inspection = {
    ...prev,
    customerName: patch.customerName,
    address: patch.address,
    inspectorId: patch.inspectorId,
    activity: [
      ...(prev.activity ?? []),
      {
        at: now,
        actorId: patch.inspectorId ?? prev.inspectorId ?? defaultGovInspectorId(),
        action: "edited",
        message: "Inspection updated",
      },
    ],
  }

  const next = [...inspections]
  next[idx] = nextItem
  writeLocalStorageJSON(STORAGE_KEY, next)
  return nextItem
}

export function setManagerApproval(id: string, approved: boolean, remarks: string, approvedBy?: string): Inspection {
  const inspections = listInspections()
  const idx = inspections.findIndex((i) => i.id === id)
  if (idx === -1) throw new Error("Inspection not found")
  const now = nowISO()
  const prev = inspections[idx]
  const status: InspectionStatus = approved ? "pending" : "reopened"
  const nextItem: Inspection = {
    ...prev,
    status,
    managerApproval: {
      approved,
      remarks,
      approvedAt: now,
      approvedBy,
    },
  }
  const next = [...inspections]
  next[idx] = nextItem
  writeLocalStorageJSON(STORAGE_KEY, next)
  return nextItem
}

export function setGovernmentInspection(
  id: string,
  approved: boolean,
  remarks: string,
  inspectorName?: string,
): Inspection {
  const inspections = listInspections()
  const idx = inspections.findIndex((i) => i.id === id)
  if (idx === -1) throw new Error("Inspection not found")
  const now = nowISO()
  const prev = inspections[idx]
  const status: InspectionStatus = approved ? "approved" : "reopened"
  const nextItem: Inspection = {
    ...prev,
    status,
    governmentInspection: {
      approved,
      remarks,
      inspectedAt: now,
      inspectorName,
    },
    activity: [
      ...(prev.activity ?? []),
      {
        at: now,
        actorId: prev.inspectorId ?? defaultGovInspectorId(),
        action: approved ? "approved" : "rejected",
        message: approved ? "Inspection approved" : "Inspection rejected",
        meta: { remarks },
      },
    ],
  }
  const next = [...inspections]
  next[idx] = nextItem
  writeLocalStorageJSON(STORAGE_KEY, next)
  return nextItem
}

