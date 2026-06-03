"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { createPortal } from "react-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SolarWatermark } from "@/components/solar-watermark"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Package, CheckCircle, Play, Send, Pencil, Camera, MapPin, Undo2 } from "lucide-react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { useInstallation, useSurvey, useInspectionByInstallationId, useUsers } from "@/lib/data/hooks"
import * as installationsData from "@/lib/data/installations"
import * as inspectionsData from "@/lib/data/inspections"
import * as surveysData from "@/lib/data/surveys"
import { WorkflowSummarySection } from "@/components/workflow-summary-section"
import {
  rewriteStorageUrl,
  useInstallationPhotoDisplayUrls,
  type InstallationPhotoUrlInput,
} from "@/lib/supabase/installation-photo-urls"
import type { Material } from "@/lib/data/installations"
import { materialUsesLengthInsteadOfSerial } from "@/lib/installation-material-options"
import { parseStoredGps } from "@/lib/installation-photo-gps"
import { InstallationDetailPageSkeleton } from "@/components/installations-loading-skeletons"
import { formatSafeDate, formatSafeDateTime } from "@/lib/format-safe-date"
import { listEntityActivity, type ActivityLogEntry } from "@/lib/supabase/activity-log"

function MaterialPhotoCard({
  title,
  subtitle,
  src,
  alt,
  onOpen,
}: {
  title: string
  subtitle: string
  src?: string
  alt: string
  onOpen: (src: string, alt: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-md border border-solar bg-background">
      <div className="h-24 w-full overflow-hidden border-b border-solar bg-muted/40">
        {src ? (
          <img
            src={src}
            alt={alt}
            className="h-full w-full cursor-zoom-in object-contain bg-white"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onClick={() => onOpen(src, alt)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No photo</div>
        )}
      </div>
      <div className="space-y-0.5 p-2">
        <p className="truncate text-xs font-semibold text-foreground">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  )
}

function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string
  alt: string
  onClose: () => void
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-2 -top-2 rounded-full bg-white px-2 py-1 text-xs font-semibold text-black shadow"
        >
          Close
        </button>
        <img src={src} alt={alt} className="max-h-[90vh] max-w-[90vw] rounded object-contain" />
      </div>
    </div>,
    document.body
  )
}

function InstallationDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams?.get("id") ?? null

  const { data: installation, loading, error, refetch } = useInstallation(id)

  const installationPhotoUrlInputs = useMemo((): InstallationPhotoUrlInput[] => {
    return (
      installation?.photos?.map((p, i) => {
        const raw = p as Record<string, unknown>
        const pid = typeof raw.id === "string" && raw.id ? raw.id : `photo-${i}`
        const fileMeta = raw.file ?? raw.file_meta
        const fileObj =
          fileMeta && typeof fileMeta === "object" && !Array.isArray(fileMeta)
            ? (fileMeta as Record<string, unknown>)
            : null
        const fileName = fileObj && typeof fileObj.name === "string" ? fileObj.name : undefined
        return {
          id: pid,
          url: typeof raw.url === "string" ? raw.url : undefined,
          category: typeof raw.category === "string" ? raw.category : undefined,
          file: fileName ? { name: fileName } : undefined,
        }
      }) ?? []
    )
  }, [installation?.photos])

  const materialEvidenceUrlInputs = useMemo((): InstallationPhotoUrlInput[] => {
    const mats = installation?.materials ?? []
    const out: InstallationPhotoUrlInput[] = []
    for (const mat of mats) {
      const m = mat as Material
      const evidenceUrl = typeof m.photo?.url === "string" ? m.photo.url.trim() : ""
      if (evidenceUrl) {
        out.push({
          id: `mat-${m.id}-evidence`,
          url: evidenceUrl,
          file: m.photo?.name ? { name: m.photo.name } : undefined,
        })
      }
      if (m.name === "Solar PV Module") {
        for (let idx = 0; idx < 4; idx++) {
          const pp = m.panelPhotos?.[idx]
          const u = typeof pp?.url === "string" ? pp.url.trim() : ""
          if (u) {
            out.push({
              id: `mat-${m.id}-panel-${idx}`,
              url: u,
              file: pp?.name ? { name: pp.name } : undefined,
            })
          }
        }
      }
    }
    return out
  }, [installation?.materials])

  const allInstallationImageUrlInputs = useMemo(
    () => [...installationPhotoUrlInputs, ...materialEvidenceUrlInputs],
    [installationPhotoUrlInputs, materialEvidenceUrlInputs]
  )

  const photoDisplayUrls = useInstallationPhotoDisplayUrls(allInstallationImageUrlInputs, installation?.id)
  const { data: linkedSurvey } = useSurvey(installation?.surveyId ?? null)
  const { data: linkedInspection } = useInspectionByInstallationId(id)
  const { data: users = [] } = useUsers()
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null)
  const [revertPendingOpen, setRevertPendingOpen] = useState(false)
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([])

  const getUserById = (userId: string) => users.find((u) => u.id === userId)

  useEffect(() => {
    if (!id) return
    void listEntityActivity("installation", id)
      .then(setActivityLogs)
      .catch(() => setActivityLogs([]))
  }, [id])

  const approvedByEvent = linkedSurvey && Array.isArray(linkedSurvey.activity)
    ? linkedSurvey.activity.find((e: { action: string; meta?: { status?: string } }) => e.action === "status_changed" && e.meta?.status === "approved")
    : null
  const approvedByUser = approvedByEvent?.actorId ? getUserById(approvedByEvent.actorId) : null
  const inspectorUser = linkedInspection?.inspectorId ? getUserById(linkedInspection.inspectorId) : null
  const inspectorNameDisplay = linkedInspection?.governmentInspection?.inspectorName ?? inspectorUser?.name

  const handleStart = async () => {
    if (!id) return
    try {
      const updated = await installationsData.updateInstallationStatus(id, "in_progress")
      refetch()
      toast({ title: "Installation started" })
    } catch (e) {
      toast({ title: "Failed to update", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    }
  }

  const handleComplete = async () => {
    if (!id) return
    try {
      await installationsData.updateInstallationStatus(id, "completed")
      refetch()
      toast({ title: "Installation completed", description: "You can now submit for inspection." })
    } catch (e) {
      toast({ title: "Failed to update", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    }
  }

  const handleRevertToPending = async () => {
    if (!id) return
    try {
      await installationsData.updateInstallationStatus(id, "pending")
      setRevertPendingOpen(false)
      refetch()
      toast({ title: "Moved to pending", description: "Installation is back in the pending stage." })
    } catch (e) {
      toast({ title: "Failed to update", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    }
  }

  const handleSubmitForInspection = async () => {
    if (!id || !installation) return
    try {
      const updated = await installationsData.updateInstallationStatus(id, "inspection_pending")
      let insp = await inspectionsData.getInspectionByInstallationId(id)
      if (!insp) {
        insp = await inspectionsData.createInspection({
          installationId: id,
          projectId: updated.projectId ?? "",
          surveyId: updated.surveyId ?? "",
          customerName: updated.customerName,
          address: updated.address,
        })
      }
      if (updated.surveyId) {
        await surveysData.appendSurveyActivity(updated.surveyId, {
          action: "inspection_submitted",
          message: `Submitted for inspection (${insp.id})`,
          meta: { inspectionId: insp.id, installationId: id },
        })
      }
      toast({ title: "Submitted for inspection", description: `Inspection created: ${insp.id}` })
      router.push(`/inspection-details?id=${insp.id}`)
    } catch (e) {
      toast({ title: "Failed to submit", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    }
  }

  const startedDisplay = installation?.startedAt
    ? formatSafeDate(installation.startedAt, "en-IN")
    : null
  const completedDisplay = installation?.completedAt
    ? formatSafeDate(installation.completedAt, "en-IN")
    : null

  const progress = useMemo(() => {
    const inst = installation
    if (!inst) return { percent: 0, steps: [] }
    const hasMaterials = (inst.materials ?? []).length > 0
    const materialsScanned = hasMaterials && (inst.materials ?? []).every(m => {
      const raw = m as Record<string, unknown>
      if (raw.name === "Solar PV Module") return ((raw.panelSerials as string[]) ?? []).filter(Boolean).length === 4
      if (typeof raw.lengthMeters === "string") return raw.lengthMeters.trim() !== ""
      return typeof raw.serialNumber === "string" && raw.serialNumber.trim() !== ""
    })
    const panelMat = (inst.materials ?? []).find(m => (m as Record<string, unknown>).name === "Solar PV Module")
    const panelPhotos = panelMat ? ((panelMat as Record<string, unknown>).panelPhotos as unknown[]) ?? [] : []
    const panelsInstalled = panelPhotos.length >= 4
    const hasPhotos = (inst.photos ?? []).length > 0
    const comm = inst.commissioningData
    const commissioningDone = comm?.status === "approved"
    const declarationDone = inst.declarationConfirmed === true
    const faultOk = !inst.faultReport?.faultDetected || inst.faultReport?.status === "resolved"
    const steps = [
      { label: "Materials scanned", done: materialsScanned },
      { label: "Panel photos (4)", done: panelsInstalled },
      { label: "Site photos uploaded", done: hasPhotos },
      { label: "Commissioning approved", done: commissioningDone },
      { label: "Declaration signed", done: declarationDone },
      { label: "Faults resolved / none", done: faultOk },
      { label: "Inspection created", done: !!linkedInspection },
    ]
    const doneCount = steps.filter(s => s.done).length
    return { percent: Math.round((doneCount / steps.length) * 100), steps }
  }, [installation, linkedInspection])

  if (loading) {
    return <InstallationDetailPageSkeleton showWatermark />
  }

  if (error || !installation) {
    return (
      <div className="relative w-full pb-10">
        <SolarWatermark />
        <main className="mx-auto max-w-7xl px-4 py-8 relative z-10">
          <p className="text-muted-foreground">{error?.message ?? "Installation not found."}</p>
          <Link href="/installations" className="mt-4 inline-block">
            <Button variant="outline">Back to Installations</Button>
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="relative w-full pb-10">
      <SolarWatermark />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 relative z-10">
        <Link href="/installations">
          <Button variant="ghost" className="mb-6 text-primary hover:bg-muted">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Installations
          </Button>
        </Link>

        <div className="space-y-6">
          {/* Header */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-2xl text-foreground">{installation.customerName}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Installation ID: {installation.id}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                      installation.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : installation.status === "in_progress"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {installation.status.replace("_", " ")}
                  </span>
                  <Link href={`/installation-edit?id=${installation.id}`}>
                    <Button type="button" variant="outline" size="sm" className="border-solar bg-transparent">
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Workflow Summary — same section on survey, installation, inspection pages */}
          <WorkflowSummarySection
            surveyorName={linkedSurvey?.submittedById ? (getUserById(linkedSurvey.submittedById)?.name ?? "—") : "—"}
            surveySubmitDate={
              linkedSurvey?.uploadDate
                ? formatSafeDateTime(linkedSurvey.uploadDate)
                : linkedSurvey?.submittedAt
                  ? formatSafeDateTime(linkedSurvey.submittedAt)
                  : "—"
            }
            approvedByName={approvedByUser?.name ?? "—"}
            approvedDate={linkedSurvey?.approvedDate ? formatSafeDateTime(linkedSurvey.approvedDate) : "—"}
            installerName={installation.engineerName ?? (installation.engineerId ? getUserById(installation.engineerId)?.name : null) ?? "—"}
            installationDate={installation.createdAt ? formatSafeDateTime(installation.createdAt) : "—"}
            inspectorName={inspectorNameDisplay ?? inspectorUser?.name ?? "—"}
            inspectionDate={linkedInspection?.createdAt ? formatSafeDateTime(linkedInspection.createdAt) : "—"}
          />

          {/* Actions */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">Actions</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Move the job forward here. The Edit page shows status only. Use Revert to pending when work has not actually started or was marked completed by mistake.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                  {installation.status === "pending" && (
                    <Button
                      onClick={handleStart}
                      className="w-full bg-gradient-dark-green text-white hover:opacity-90 sm:w-auto [&_svg]:text-white"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Start
                    </Button>
                  )}
                  {installation.status === "in_progress" && (
                    <>
                      <Button
                        onClick={handleComplete}
                        className="w-full bg-gradient-dark-green text-white hover:opacity-90 sm:w-auto [&_svg]:text-white"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Mark Completed
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRevertToPending}
                        className="w-full border-solar sm:w-auto"
                      >
                        <Undo2 className="mr-2 h-4 w-4" />
                        Revert to pending
                      </Button>
                    </>
                  )}
                  {installation.status === "completed" && (
                    <>
                      <Button
                        onClick={handleSubmitForInspection}
                        className="w-full bg-gradient-dark-green text-white hover:opacity-90 sm:w-auto [&_svg]:text-white"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Submit for Inspection
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setRevertPendingOpen(true)} className="w-full border-solar sm:w-auto">
                        <Undo2 className="mr-2 h-4 w-4" />
                        Revert to pending
                      </Button>
                    </>
                  )}
                  {installation.status === "inspection_pending" && (
                    <Button variant="outline" disabled className="w-full sm:w-auto">
                      Inspection Pending
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Installation Info */}
            <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Installation Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Address</p>
                  <p className="mt-1 text-sm text-foreground">{installation.address}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Installation Engineer</p>
                  <p className="mt-1 text-sm text-foreground">{installation.engineerName || installation.engineerId || "—"}</p>
                  {installation.engineerId && <p className="text-xs text-muted-foreground">{installation.engineerId}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {startedDisplay && startedDisplay !== "N/A" && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Started</p>
                      <p className="mt-1 text-sm text-foreground">{startedDisplay}</p>
                    </div>
                  )}
                  {completedDisplay && completedDisplay !== "N/A" && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Completed</p>
                      <p className="mt-1 text-sm text-foreground">{completedDisplay}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Progress */}
            <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Installation Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Overall Progress</span>
                    <span className="font-semibold text-foreground">{progress.percent}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-solar-beige">
                    <div
                      className="h-full bg-solar-yellow transition-all"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {progress.steps.map((step) => (
                    <div key={step.label} className="flex items-center gap-3">
                      <CheckCircle
                        className={`h-5 w-5 ${step.done ? "text-green-600" : "text-muted-foreground/40"}`}
                      />
                      <span className={`text-sm ${step.done ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {(installation.visitType ||
            installation.arrivalTime ||
            installation.siteGps ||
            installation.commissioningData ||
            installation.qualityCheck ||
            installation.faultReport?.faultDetected ||
            installation.signatureUrl ||
            installation.declarationConfirmed) && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-solar bg-solar-card shadow-sm lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">Site visit &amp; handover</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-foreground">Visit</p>
                    <p className="text-muted-foreground">
                      Type: <span className="text-foreground">{installation.visitType ?? "—"}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Arrival:{" "}
                      <span className="text-foreground">
                        {installation.arrivalTime ? formatSafeDateTime(installation.arrivalTime) : "—"}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Departure:{" "}
                      <span className="text-foreground">
                        {installation.departureTime ? formatSafeDateTime(installation.departureTime) : "—"}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Site accessible:{" "}
                      <span className="text-foreground">{installation.siteAccessible === false ? "No" : "Yes"}</span>
                    </p>
                    {installation.siteGps?.lat != null && installation.siteGps?.lng != null && (
                      <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="font-mono text-foreground">
                          {installation.siteGps.lat.toFixed(5)}, {installation.siteGps.lng.toFixed(5)}
                        </span>
                      </p>
                    )}
                  </div>
                  {installation.commissioningData && Object.keys(installation.commissioningData).length > 0 && (
                    <div className="space-y-2 rounded-lg border border-solar/60 p-3 text-sm">
                      <p className="font-semibold text-foreground">Commissioning</p>
                      <p className="text-muted-foreground">
                        Status:{" "}
                        <span className="text-foreground">{installation.commissioningData.status ?? "—"}</span>
                      </p>
                      {installation.commissioningData.notes && (
                        <p className="text-muted-foreground">{installation.commissioningData.notes}</p>
                      )}
                    </div>
                  )}
                  {installation.qualityCheck && Object.keys(installation.qualityCheck).length > 0 && (
                    <div className="space-y-2 rounded-lg border border-solar/60 p-3 text-sm">
                      <p className="font-semibold text-foreground">Quality</p>
                      <p className="text-muted-foreground">
                        Performance:{" "}
                        <span className="text-foreground">{installation.qualityCheck.systemPerformance ?? "—"}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Inspection:{" "}
                        <span className="text-foreground">{installation.qualityCheck.physicalInspection ?? "—"}</span>
                      </p>
                    </div>
                  )}
                  {installation.faultReport?.faultDetected && (
                    <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm lg:col-span-2">
                      <p className="font-semibold text-destructive">Fault report</p>
                      <p className="text-foreground">{installation.faultReport.faultType ?? "—"}</p>
                      {installation.faultReport.description && (
                        <p className="text-muted-foreground">{installation.faultReport.description}</p>
                      )}
                      <p className="text-muted-foreground">
                        Status: <span className="font-medium text-foreground">{installation.faultReport.status ?? "—"}</span>
                      </p>
                    </div>
                  )}
                  {(installation.signatureUrl || installation.declarationConfirmed) && (
                    <div className="space-y-2 lg:col-span-2">
                      <p className="text-sm font-semibold text-foreground">Declaration &amp; signature</p>
                      <p className="text-sm text-muted-foreground">
                        Confirmed: {installation.declarationConfirmed ? "Yes" : "No"}
                      </p>
                      {installation.signatureUrl && (
                        <img
                          src={installation.signatureUrl}
                          alt="Installer signature"
                          className="max-h-40 max-w-md rounded border border-solar bg-white object-contain"
                        />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Materials */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-foreground">Materials</CardTitle>
                <div className="rounded-lg bg-solar-yellow px-3 py-1">
                  <span className="text-sm font-semibold text-foreground">{(installation.materials ?? []).length} items</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(installation.materials ?? []).map((material: Material) => (
                  <div key={material.id} className="rounded-lg border border-solar p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                    <div className="rounded-lg bg-solar-yellow p-2 self-start">
                      <Package className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{material.name}</h4>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {material.name === "Solar PV Module" ? (
                          <>
                            <span>
                              Panel serials: {(material.panelSerials ?? []).filter(Boolean).join(", ") || "—"}
                            </span>
                            <span>
                              Panel barcodes: {(material.panelBarcodes ?? []).filter(Boolean).join(", ") || "—"}
                            </span>
                          </>
                        ) : materialUsesLengthInsteadOfSerial(material.name) ? (
                          <span>Length: {material.lengthMeters?.trim() || "—"} m</span>
                        ) : (
                          <span>S/N: {material.serialNumber || "—"}</span>
                        )}
                        {material.name !== "Solar PV Module" && material.barcode ? (
                          <span>Barcode: {material.barcode}</span>
                        ) : null}
                      </div>
                      {material.name === "Solar PV Module" ? (
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {[0, 1, 2, 3].map((idx) => {
                            const panelSerial = material.panelSerials?.[idx]?.trim() || "No serial"
                            const panelBarcode = material.panelBarcodes?.[idx]?.trim() || "No barcode"
                            const panelPhotoRaw = material.panelPhotos?.[idx]?.url
                            const panelKey = `mat-${material.id}-panel-${idx}`
                            const panelPhoto =
                              photoDisplayUrls[panelKey] ??
                              (typeof panelPhotoRaw === "string" && panelPhotoRaw
                                ? rewriteStorageUrl(panelPhotoRaw)
                                : undefined)
                            return (
                              <MaterialPhotoCard
                                key={`${material.id}-panel-photo-${idx}`}
                                title={`Panel ${idx + 1}`}
                                subtitle={`Serial: ${panelSerial} · Barcode: ${panelBarcode}`}
                                src={panelPhoto}
                                alt={`${material.name} panel ${idx + 1}`}
                                onOpen={(src, alt) => setLightboxImage({ src, alt })}
                              />
                            )
                          })}
                        </div>
                      ) : null}
                      {material.name !== "Solar PV Module" ? (
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:max-w-sm">
                          <MaterialPhotoCard
                            title={material.name || "Material"}
                            subtitle={
                              materialUsesLengthInsteadOfSerial(material.name)
                                ? `Length: ${material.lengthMeters?.trim() || "—"} m`
                                : `Serial: ${material.serialNumber || "—"}`
                            }
                            src={
                              photoDisplayUrls[`mat-${material.id}-evidence`] ??
                              (typeof material.photo?.url === "string" && material.photo.url
                                ? rewriteStorageUrl(material.photo.url)
                                : undefined)
                            }
                            alt={`${material.name} evidence`}
                            onOpen={(src, alt) => setLightboxImage({ src, alt })}
                          />
                        </div>
                      ) : null}
                    </div>
                    <CheckCircle className="h-5 w-5 text-green-600 self-start sm:mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Installation Photos */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Installation Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(installation.photos ?? []).map((photo: Record<string, unknown>, idx: number) => {
                  const rawId = typeof photo.id === "string" ? photo.id : ""
                  const stableId = rawId || `photo-${idx}`
                  const fileMeta = photo.file ?? photo.file_meta
                  const file = fileMeta && typeof fileMeta === "object" && !Array.isArray(fileMeta)
                    ? (fileMeta as Record<string, unknown>)
                    : null
                  const fileName = file && typeof file.name === "string" ? file.name : null
                  const rawUrl = typeof photo.url === "string" ? photo.url : null
                  const url = photoDisplayUrls[stableId] || rawUrl
                  const category = typeof photo.category === "string" ? photo.category : ""
                  const description = typeof photo.description === "string" ? photo.description : ""
                  const gps = parseStoredGps(photo)
                  return (
                    <div key={stableId} className="overflow-hidden rounded-lg border border-solar bg-background">
                      <div className="flex h-40 items-center justify-center overflow-hidden border-b border-solar bg-muted/40">
                        {url ? (
                          <img
                            src={url}
                            alt={description || "Installation photo"}
                            className="h-full w-full cursor-zoom-in object-contain bg-white"
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            onClick={() =>
                              setLightboxImage({
                                src: url,
                                alt: description || "Installation photo",
                              })
                            }
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
                            <Camera className="h-10 w-10 text-muted-foreground/60" />
                            {fileName ? (
                              <span className="font-medium text-foreground">{fileName}</span>
                            ) : (
                              <span>Photo</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 p-2">
                        <span className="inline-flex items-center rounded-full bg-solar-yellow px-2 py-1 text-[11px] font-medium text-foreground">
                          {String(category || "").replace(/_/g, " ") || "photo"}
                        </span>
                        <p className="text-sm text-foreground">{description || fileName || "No description"}</p>
                        {gps && (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-mono">
                              {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)}
                              {gps.gpsAccuracyMeters != null ? ` (±${gps.gpsAccuracyMeters} m)` : ""}
                            </span>
                            <a
                              href={`https://www.google.com/maps?q=${encodeURIComponent(String(gps.latitude))},${encodeURIComponent(String(gps.longitude))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-solar-dark underline-offset-2 hover:underline"
                            >
                              Maps
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {(installation.photos ?? []).length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No photos yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          {(activityLogs.length > 0 || (Array.isArray((installation as unknown as { activity?: unknown[] }).activity) && (installation as unknown as { activity: unknown[] }).activity.length > 0)) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activity Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(activityLogs.length > 0
                    ? activityLogs.map((evt) => ({
                        at: evt.createdAt,
                        actorName: evt.actorName,
                        message: evt.message,
                        changedFields: Array.isArray(evt.meta?.changedFields) ? (evt.meta?.changedFields as string[]) : [],
                        key: evt.id,
                      }))
                    : ((installation as unknown as { activity: Array<{ at: string; actorName?: string; action: string; message: string }> }).activity)
                        .slice()
                        .reverse()
                        .map((evt, idx) => ({
                          at: evt.at,
                          actorName: evt.actorName,
                          message: evt.message,
                          changedFields: [],
                          key: String(idx),
                        }))
                  ).map((evt) => (
                      <div key={evt.key} className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                        <div className="mt-0.5 h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                          {evt.actorName?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{evt.message}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {evt.actorName ?? "System"} · {new Date(evt.at).toLocaleString("en-IN")}
                          </p>
                          {evt.changedFields.length > 0 && (
                            <p className="mt-1 text-xs text-muted-foreground">Changed: {evt.changedFields.join(", ")}</p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit for Inspection */}
          {installation.status === "completed" && (
            <Card className="border-solar bg-solar-card shadow-sm">
              <CardContent className="pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">Ready for Inspection</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Submit this installation for manager review and inspection
                    </p>
                  </div>
                  <Button
                    onClick={handleSubmitForInspection}
                    className="w-full bg-solar-dark text-white hover:bg-solar-dark/90 sm:w-auto"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Submit for Inspection
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      {lightboxImage ? (
        <ImageLightbox
          src={lightboxImage.src}
          alt={lightboxImage.alt}
          onClose={() => setLightboxImage(null)}
        />
      ) : null}

      <AlertDialog open={revertPendingOpen} onOpenChange={setRevertPendingOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert to pending?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears started and completed timestamps. Use if you marked completed by mistake before submitting for inspection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRevertToPending()}>Revert to pending</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function InstallationDetailPage() {
  return (
    <Suspense fallback={<InstallationDetailPageSkeleton showWatermark />}>
      <InstallationDetailContent />
    </Suspense>
  )
}
