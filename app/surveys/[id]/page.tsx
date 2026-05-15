"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SolarWatermark } from "@/components/solar-watermark"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, MapPin, CheckCircle, XCircle, UserCog, Pencil, FileImage, ChevronLeft, ChevronRight, X } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import * as surveysData from "@/lib/data/surveys"
import * as installationsData from "@/lib/data/installations"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRole } from "@/contexts/role-context"
import { WorkflowSummarySection } from "@/components/workflow-summary-section"
import { useSurvey, useUsers, useInstallationBySurveyId, useInspectionByInstallationId } from "@/lib/data/hooks"
import { Skeleton } from "@/components/ui/skeleton"
import type { User } from "@/lib/store/users"
import type { SurveyUploadKeys } from "@/lib/store/surveys"
import { extractStoragePathFromUrl, rewriteStorageUrl } from "@/lib/supabase/installation-photo-urls"
import { formatSafeDateTime } from "@/lib/format-safe-date"

const BUCKET = "solar_bucket"

function useSignedUploadUrls(
  uploads: Record<string, { name?: string; url?: string }> | undefined
) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!uploads) return
    let cancelled = false

    async function resolve() {
      const rewrittenMap: Record<string, string> = {}
      const entries = Object.entries(uploads!).filter(
        ([, meta]) => meta?.url && !meta.url.startsWith("data:")
      )
      for (const [key, meta] of entries) {
        rewrittenMap[key] = rewriteStorageUrl(meta.url!)
      }
      if (!cancelled) setSignedUrls(rewrittenMap)

      try {
        const { getSupabaseBrowserClient } = await import("@/lib/supabase/client")
        const supabase = getSupabaseBrowserClient()
        if (entries.length === 0) return

        const paths = entries
          .map(([key, meta]) => {
            const path = extractStoragePathFromUrl(meta.url!)
            return path ? { key, path } : null
          })
          .filter(Boolean) as { key: string; path: string }[]

        if (paths.length === 0) return

        const { data, error } = await supabase.storage
          .from(BUCKET)
          .createSignedUrls(
            paths.map((p) => p.path),
            3600
          )

        if (error || !data || cancelled) return
        const map: Record<string, string> = { ...rewrittenMap }
        data.forEach((item, i) => {
          if (item.signedUrl) map[paths[i].key] = item.signedUrl
        })
        if (!cancelled) setSignedUrls(map)
      } catch {
        // signed URL generation failed; rewritten public URLs already set as fallback
      }
    }

    resolve()
    return () => { cancelled = true }
  }, [uploads])

  return signedUrls
}

type GalleryItem = { src: string; label: string }

function ImageGalleryLightbox({
  items,
  currentIndex,
  onClose,
  onNavigate,
}: {
  items: GalleryItem[]
  currentIndex: number
  onClose: () => void
  onNavigate: (index: number) => void
}) {
  const current = items[currentIndex]
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < items.length - 1

  const goPrev = useCallback(() => { if (hasPrev) onNavigate(currentIndex - 1) }, [hasPrev, onNavigate, currentIndex])
  const goNext = useCallback(() => { if (hasNext) onNavigate(currentIndex + 1) }, [hasNext, onNavigate, currentIndex])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") goPrev()
      if (e.key === "ArrowRight") goNext()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [onClose, goPrev, goNext])

  // Lock body scroll while lightbox is open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  if (!current) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[10000] rounded-full bg-white/15 p-2 text-white hover:bg-white/30 transition-colors"
        aria-label="Close preview"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Counter */}
      <span className="absolute top-5 left-1/2 -translate-x-1/2 text-sm text-white/70 font-medium">
        {currentIndex + 1} / {items.length}
      </span>

      {/* Prev */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-[10000] rounded-full bg-white/15 p-3 text-white hover:bg-white/30 transition-colors"
          aria-label="Previous image"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>
      )}

      {/* Next */}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-[10000] rounded-full bg-white/15 p-3 text-white hover:bg-white/30 transition-colors"
          aria-label="Next image"
        >
          <ChevronRight className="h-8 w-8" />
        </button>
      )}

      {/* Image */}
      <img
        src={current.src}
        alt={current.label}
        className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Label */}
      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-white/80 bg-black/50 px-4 py-2 rounded-full font-medium">
        {current.label}
      </p>
    </div>,
    document.body
  )
}

function UploadPreview({ src, alt, onClick }: { src: string; alt: string; onClick: () => void }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className="flex flex-col items-center gap-2 text-muted-foreground p-4">
        <FileImage className="h-10 w-10" />
        <span className="text-xs">Image unavailable</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
      onError={() => setFailed(true)}
      onClick={onClick}
    />
  )
}

const UPLOAD_ENTRIES: readonly (readonly [string, string])[] = [
  ["aadhaarCard", "Aadhar Card Upload"],
  ["panCard", "PAN Upload"],
  ["bankProof", "Cancelled Cheque / Pass Book Photo"],
  ["eBill", "E-Bill Photo"],
  ["beneficiaryPhoto", "Beneficiary Photo with Site Location (GPRS Cam)"],
  ["siteLayout", "Site Layout (Draw and Upload)"],
  ["roofTerraceNorth", "Rooftop terrace (from north location)"],
  ["roofTerraceSouth", "Rooftop terrace (from south location)"],
  ["earthingAreaPic", "Earthing Area pic"],
  ["inverterAreaPic", "Inverter area (pic upload)"],
] as const

function UploadGallerySection({
  survey,
  signedUrls,
}: {
  survey: { uploads?: Record<string, { name?: string; url?: string }> }
  signedUrls: Record<string, string>
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const galleryItems: GalleryItem[] = []
  const keyToGalleryIndex: Record<string, number> = {}

  for (const [key, label] of UPLOAD_ENTRIES) {
    const meta = survey.uploads?.[key]
    const url = signedUrls[key] || meta?.url
    if (url) {
      keyToGalleryIndex[key] = galleryItems.length
      galleryItems.push({ src: url, label })
    }
  }

  return (
    <>
      <Card className="border-solar bg-solar-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Uploads (Optional)</CardTitle>
          <p className="text-sm text-muted-foreground">Aadhar, PAN, Bank Proof, E-Bill, Beneficiary Photo, Site Layout, Site Photos</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end">
            {UPLOAD_ENTRIES.map(([key, label]) => {
              const meta = survey.uploads?.[key]
              const fileName = meta?.name
              const imageUrl = signedUrls[key] || meta?.url
              return (
                <div key={key} className="overflow-hidden rounded-lg border border-solar bg-white">
                  <div className="aspect-[4/3] w-full bg-muted flex items-center justify-center overflow-hidden">
                    {imageUrl ? (
                      <UploadPreview
                        src={imageUrl}
                        alt={label}
                        onClick={() => setLightboxIndex(keyToGalleryIndex[key] ?? null)}
                      />
                    ) : fileName ? (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground p-4">
                        <FileImage className="h-10 w-10" />
                        <span className="text-xs">File saved (no preview)</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground p-4">
                        <FileImage className="h-10 w-10" />
                        <span className="text-xs">Not uploaded</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-solar">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground truncate">{fileName ?? "—"}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {lightboxIndex !== null && galleryItems.length > 0 && (
        <ImageGalleryLightbox
          items={galleryItems}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(i) => setLightboxIndex(i)}
        />
      )}
    </>
  )
}

export default function SurveyDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id ?? null
  const { canApproveSurveys, role, resolvePermissionsForRole } = useRole()
  const [remarks, setRemarks] = useState("")
  const [installerId, setInstallerId] = useState<string>("__none__")

  const { data: survey, loading, error, refetch } = useSurvey(id)
  const { data: users = [] } = useUsers()
  const installerUsers = users.filter((u) => u.role === "installer")
  const { data: linkedInstallation, refetch: refetchLinkedInstallation } = useInstallationBySurveyId(id)
  const { data: linkedInspection } = useInspectionByInstallationId(linkedInstallation?.id ?? null)
  const rolePermissions = resolvePermissionsForRole(role)
  const canManageInstallationFlow =
    canApproveSurveys ||
    rolePermissions.includes("create_installations") ||
    rolePermissions.includes("assign_staff")

  const getUserById = useCallback(
    (uid: string | undefined) => (uid ? users.find((u) => u.id === uid) : undefined),
    [users]
  )

  const signedUrls = useSignedUploadUrls(survey?.uploads as Record<string, { name?: string; url?: string }> | undefined)

  useEffect(() => {
    if (survey?.installerId) setInstallerId(survey.installerId)
    else if (survey) setInstallerId("__none__")
  }, [survey?.id, survey?.installerId])

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 relative z-10">
          <Skeleton className="mb-3 h-5 w-16" />
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen p-6 sm:p-8">
        <p className="text-destructive">Failed to load survey.</p>
        <Link href="/surveys">
          <Button variant="outline" className="mt-4">Back to Surveys</Button>
        </Link>
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="min-h-screen p-6 sm:p-8">
        <p className="text-muted-foreground">Survey not found.</p>
        <Link href="/surveys">
          <Button variant="outline" className="mt-4">Back to Surveys</Button>
        </Link>
      </div>
    )
  }

  const handleApprove = async () => {
    if (!id) return
    try {
      await surveysData.updateSurveyStatus(id, "approved")
      await refetch()
      toast({ title: "Survey approved", description: "Status updated to Approved." })
    } catch (e) {
      toast({ title: "Could not approve", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" })
    }
  }

  const handleReject = async () => {
    if (!remarks.trim()) {
      toast({ title: "Remarks required", description: "Please provide remarks for rejection.", variant: "destructive" })
      return
    }
    if (!id) return
    try {
      await surveysData.updateSurveyStatus(id, "rejected")
      await refetch()
      toast({ title: "Survey rejected" })
    } catch (e) {
      toast({ title: "Could not reject", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" })
    }
  }

  const handleMarkCompleted = async () => {
    if (!id) return
    try {
      await surveysData.updateSurveyStatus(id, "completed")
      await refetch()
      toast({ title: "Survey completed" })
    } catch (e) {
      toast({
        title: "Could not mark completed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleAssignInstaller = async (installerIdValue: string) => {
    if (!params?.id) return
    const nextId = installerIdValue === "__none__" ? undefined : installerIdValue
    try {
      await surveysData.assignSurveyInstaller(params.id, nextId)
      setInstallerId(installerIdValue)
      await refetch()
      toast({ title: "Installer assigned" })
    } catch (e) {
      toast({ title: "Could not assign installer", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" })
    }
  }

  const handleCreateInstallation = async () => {
    if (!id) return
    if (!survey.installerId) {
      toast({ title: "Assign installer first", description: "Please assign an installer first.", variant: "destructive" })
      return
    }
    if (linkedInstallation) {
      toast({ title: "Installation already exists", description: `Opening ${linkedInstallation.id}` })
      router.push(`/installations/${linkedInstallation.id}`)
      return
    }
    const engineer = getUserById(survey.installerId)
    try {
      const created = await installationsData.createInstallation(
        {
          projectId: survey.projectId,
          surveyId: id,
          customerName: survey.beneficiaryName ?? "",
          address:
            survey.siteLocation?.address ||
            `${survey.siteLocation?.district || ""} ${survey.siteLocation?.pinCode || ""}`.trim(),
          engineerName: engineer?.name,
          engineerId: engineer?.id,
        },
        { materials: [], photos: [] }
      )
      try {
        await surveysData.appendSurveyActivity(id, {
          actorId: survey.installerId,
          action: "installation_created",
          message: `Installation created (${created.id})`,
          meta: { installationId: created.id },
        })
      } catch (_) {}
      await refetch()
      await refetchLinkedInstallation()
      toast({ title: "Installation created", description: created.id })
      router.push(`/installations/${created.id}`)
    } catch (e) {
      toast({
        title: "Could not create installation",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      })
    }
  }

  // Manager: from activity (who did status_changed / installer_assigned) or first manager user
  let managerUser: User | undefined = users.find((u) => u.role === "manager" || u.role === "admin")
  if (Array.isArray(survey.activity)) {
    const byManager = survey.activity
      .slice()
      .sort((a: any, b: any) => String(b.at).localeCompare(String(a.at)))
      .map((e: any) => (e.actorId ? getUserById(e.actorId) : null))
      .find((u: User | null | undefined) => u?.role === "manager" || u?.role === "admin")
    if (byManager) managerUser = byManager
  }
  const surveyorUser = survey.submittedById ? getUserById(survey.submittedById) : null
  const installerUser = survey.installerId ? getUserById(survey.installerId) : null
  const inspectorUser = linkedInspection?.inspectorId ? getUserById(linkedInspection.inspectorId) : null
  const inspectorNameDisplay = linkedInspection?.governmentInspection?.inspectorName ?? inspectorUser?.name

  // Approved by: from activity (who set status to approved)
  const approvedByEvent = Array.isArray(survey.activity)
    ? survey.activity.find((e: any) => e.action === "status_changed" && (e.meta as any)?.status === "approved")
    : null
  const approvedByUser = approvedByEvent?.actorId ? getUserById(approvedByEvent.actorId) : null

  // Same section structure as survey form; use real data or dummy placeholder so layout is never confusing
  const siteLocation = survey?.siteLocation ?? {}
  const bankDetails = survey?.bankDetails ?? {}
  const v = (x: string | number | undefined | null, dummy?: string): string =>
    x !== undefined && x !== null && x !== "" ? String(x) : (dummy ?? "-")
  // Dummy placeholders when no data (so section-wise layout is clear)
  const dummy = {
    beneficiary: "—",
    serviceNo: "—",
    aadhar: "—",
    pan: "—",
    mobile: "—",
    load: "—",
    section: "—",
    subDiv: "—",
    division: "—",
    circle: "—",
    mandal: "—",
    district: "—",
    pin: "—",
    city: "—",
    state: "—",
    address: "—",
    plantType: "On Grid",
    height: "—",
    roofs: "G",
    roofType: "RCC",
    discom: "APSPDCL",
    bankName: "—",
    branch: "—",
    account: "—",
    ifsc: "—",
    gps: "—",
    captured: "—",
  }
  const beneficiaryName = survey.beneficiaryName || dummy.beneficiary
  const surveyorName = survey.submittedById
    ? (getUserById(survey.submittedById)?.name ?? survey.submittedById)
    : dummy.beneficiary
  const gpsLat = survey.siteDetails?.gpsLat ?? dummy.gps
  const gpsLng = survey.siteDetails?.gpsLng ?? dummy.gps

  return (
    <div className="min-h-screen relative">
      <SolarWatermark />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 relative z-10">
        <Link href="/surveys">
          <Button variant="ghost" className="mb-6 text-primary hover:bg-muted">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Surveys
          </Button>
        </Link>

        <div className="rounded-2xl bg-white shadow-xl border border-border p-4 sm:p-6">
        <div className="space-y-6">
          {/* Header */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-2xl text-foreground">
                    {survey.beneficiaryName}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Survey ID: {survey.id}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                      survey.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : survey.status === "rejected"
                          ? "bg-red-100 text-red-800"
                          : survey.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                          : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {survey.status}
                  </span>
                  <Link href={`/surveys/${survey.id}/edit`}>
                    <Button type="button" variant="outline" size="sm" className="border-solar bg-transparent">
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Workflow Summary — surveyor, approved by, installer, inspector (same section on survey/installation/inspection pages) */}
          <WorkflowSummarySection
            surveyorName={surveyorUser?.name ?? (survey as any).engineerName ?? "—"}
            surveySubmitDate={
              survey.uploadDate
                ? formatSafeDateTime(survey.uploadDate)
                : survey.submittedAt
                  ? formatSafeDateTime(survey.submittedAt)
                  : (survey as any).createdAt
                    ? formatSafeDateTime((survey as any).createdAt)
                    : "—"
            }
            approvedByName={approvedByUser?.name ?? "—"}
            approvedDate={survey.approvedDate ? formatSafeDateTime(survey.approvedDate) : "—"}
            installerName={installerUser?.name ?? "—"}
            installationDate={linkedInstallation?.createdAt ? formatSafeDateTime(linkedInstallation.createdAt) : "—"}
            inspectorName={inspectorNameDisplay ?? inspectorUser?.name ?? "—"}
            inspectionDate={linkedInspection?.createdAt ? formatSafeDateTime(linkedInspection.createdAt) : "—"}
          />

          {/* 1. Consumer Details */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Consumer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Name</p>
                  <p className="mt-1 text-sm text-foreground capitalize">{beneficiaryName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Mobile No.</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.mobile, dummy.mobile)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Electricity Consumer No.</p>
                  <p className="mt-1 text-sm text-foreground">{v(siteLocation.electricityConsumerNo, "—")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">DISCOM</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.discomName, dummy.discom)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Connection Type</p>
                  <p className="mt-1 text-sm text-foreground">{v(siteLocation.connectionType, "—")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Phase</p>
                  <p className="mt-1 text-sm text-foreground">{v(siteLocation.phase, "—")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sanctioned Load (kW)</p>
                  <p className="mt-1 text-sm text-foreground">{siteLocation.sanctionedLoadKw != null && siteLocation.sanctionedLoadKw !== "" ? String(siteLocation.sanctionedLoadKw) : "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg. Monthly Bill (₹)</p>
                  <p className="mt-1 text-sm text-foreground">{siteLocation.avgMonthlyBillRupees != null && siteLocation.avgMonthlyBillRupees !== "" ? String(siteLocation.avgMonthlyBillRupees) : "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Address</p>
                <p className="mt-1 text-sm text-foreground">{v(siteLocation.address ?? (survey as any).address, dummy.address)}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Mandal</p>
                  <p className="mt-1 text-sm text-foreground capitalize">{v(siteLocation.mandal, dummy.mandal)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Village</p>
                  <p className="mt-1 text-sm text-foreground capitalize">{v(siteLocation.village, "—")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pincode</p>
                  <p className="mt-1 text-sm text-foreground">{v(siteLocation.pinCode, dummy.pin)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Latitude</p>
                  <p className="mt-1 text-sm text-foreground">{v(siteLocation.latitude ?? survey.siteDetails?.gpsLat, gpsLat)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Longitude</p>
                  <p className="mt-1 text-sm text-foreground">{v(siteLocation.longitude ?? survey.siteDetails?.gpsLng, gpsLng)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Beneficiary Details (surveyor, name, service no, aadhar, pan, mobile) */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Beneficiary Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Surveyor (submitted by)</p>
                  <p className="mt-1 text-sm text-foreground">{surveyorName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Name of the Beneficiary</p>
                  <p className="mt-1 text-sm text-foreground capitalize">{beneficiaryName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Service No</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.serviceNo, dummy.serviceNo)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Aadhar No</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.aadharNo, dummy.aadhar)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">PAN No</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.panNo, dummy.pan)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Mobile</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.mobile, dummy.mobile)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Contracted Load</p>
                  <p className="mt-1 text-sm text-foreground">{survey.contractedLoad != null ? String(survey.contractedLoad) : dummy.load}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Site Location */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Site Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end">
                <div><p className="text-sm font-medium text-muted-foreground">Section</p><p className="mt-1 text-sm text-foreground">{v(siteLocation.section, dummy.section)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Sub Division</p><p className="mt-1 text-sm text-foreground">{v(siteLocation.subDivision, dummy.subDiv)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Division</p><p className="mt-1 text-sm text-foreground">{v(siteLocation.division, dummy.division)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Circle</p><p className="mt-1 text-sm text-foreground">{v(siteLocation.circle, dummy.circle)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Mandal</p><p className="mt-1 text-sm text-foreground">{v(siteLocation.mandal, dummy.mandal)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">District</p><p className="mt-1 text-sm text-foreground">{v(siteLocation.district, dummy.district)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Pin Code</p><p className="mt-1 text-sm text-foreground">{v(siteLocation.pinCode, dummy.pin)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">City</p><p className="mt-1 text-sm text-foreground">{v(siteLocation.city, dummy.city)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">State</p><p className="mt-1 text-sm text-foreground">{v(siteLocation.state, dummy.state)}</p></div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Address of the Location</p>
                <p className="mt-1 text-sm text-foreground">{v(siteLocation.address ?? (survey as any).address, dummy.address)}</p>
              </div>
            </CardContent>
          </Card>

          {/* 2. Rooftop Ownership & Consent */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Rooftop Ownership &amp; Consent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 items-end">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Roof Ownership</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.siteDetails?.roofOwnership, "—")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Owner Consent Available (if applicable)</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.siteDetails?.ownerConsentAvailable, "—")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Rooftop & Space Details */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Rooftop &amp; Space Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Roof Type</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.roofType, dummy.roofType)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Available Roof Area (approx.)</p>
                  <p className="mt-1 text-sm text-foreground">{survey.siteDetails?.availableRoofAreaSqm != null ? `${survey.siteDetails.availableRoofAreaSqm} sq.m` : "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Shadow-free area available</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.siteDetails?.shadowFreeAreaAvailable, "—")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Roof Orientation</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.siteDetails?.roofOrientation, "—")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Roof Condition</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.siteDetails?.roofCondition, "—")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Shading & Obstructions */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Shading &amp; Obstructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 items-end">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nearby shading objects</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.siteDetails?.shadingObjects, "—")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Shading Duration</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.siteDetails?.shadingDuration, "—")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 5. Electrical Feasibility */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Electrical Feasibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Distance Roof to Meter (m)</p>
                  <p className="mt-1 text-sm text-foreground">{survey.siteDetails?.distanceRoofToMeterM != null ? String(survey.siteDetails.distanceRoofToMeterM) : "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Inverter installation space available</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.siteDetails?.inverterSpaceAvailable, "—")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Existing Earthing</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.siteDetails?.existingEarthing, "—")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Earth Pits Feasibility</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.siteDetails?.earthPitsFeasibility, "—")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cable routing feasible</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.siteDetails?.cableRoutingFeasible, "—")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">USC No</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.siteDetails?.uscNo, "—")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">DTR Capacity</p>
                  <p className="mt-1 text-sm text-foreground">{survey.siteDetails?.dtrCapacity != null ? String(survey.siteDetails.dtrCapacity) : "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Age of the Building</p>
                  <p className="mt-1 text-sm text-foreground">{survey.siteDetails?.ageOfBuildingYears != null ? String(survey.siteDetails.ageOfBuildingYears) : "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Plant & Roof Details */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Plant & Roof Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end">
                <div><p className="text-sm font-medium text-muted-foreground">Type of Solar Power Plant</p><p className="mt-1 text-sm text-foreground">{v(survey.plantType, dummy.plantType)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Building Height</p><p className="mt-1 text-sm text-foreground">{survey.buildingHeight != null && survey.buildingHeight > 0 ? String(survey.buildingHeight) : dummy.height}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Total No of Roofs</p><p className="mt-1 text-sm text-foreground">{v(survey.totalRoofs, dummy.roofs)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Type of Roof</p><p className="mt-1 text-sm text-foreground">{v(survey.roofType, dummy.roofType)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">DISCOM Name</p><p className="mt-1 text-sm text-foreground">{v(survey.discomName, dummy.discom)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Meter AC Cable (m)</p><p className="mt-1 text-sm text-foreground">{survey.siteDetails?.meterAcCableMeters != null ? String(survey.siteDetails.meterAcCableMeters) : "—"}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Meter DC Cable (m)</p><p className="mt-1 text-sm text-foreground">{survey.siteDetails?.meterDcCableMeters != null ? String(survey.siteDetails.meterDcCableMeters) : "—"}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* 6. Feasibility Result (Surveyor Assessment) */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Feasibility Result (Surveyor Assessment)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Recommended System Size</p>
                  <p className="mt-1 text-sm text-foreground">{survey.siteDetails?.recommendedSystemSizeKw != null ? `${survey.siteDetails.recommendedSystemSizeKw} kW` : "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overall Feasibility</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.siteDetails?.overallFeasibility, "—")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">If Not Feasible, Reason</p>
                  <p className="mt-1 text-sm text-foreground">{v(survey.siteDetails?.notFeasibleReason, "—")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Bank Details */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Bank Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end">
                <div><p className="text-sm font-medium text-muted-foreground">Bank Name</p><p className="mt-1 text-sm text-foreground">{v(bankDetails.bankName, dummy.bankName)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Branch</p><p className="mt-1 text-sm text-foreground">{v(bankDetails.branch, dummy.branch)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Account No</p><p className="mt-1 text-sm text-foreground">{v(bankDetails.accountNo, dummy.account)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">IFSC</p><p className="mt-1 text-sm text-foreground">{v(bankDetails.ifsc, dummy.ifsc)}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* 5. Site Details (GPRS Cam) */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Site Details (GPRS Cam)</CardTitle>
              <p className="text-sm text-muted-foreground">Capture location to auto-fill site details</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 items-end">
                <div><p className="text-sm font-medium text-muted-foreground">Latitude</p><p className="mt-1 text-sm text-foreground">{gpsLat}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Longitude</p><p className="mt-1 text-sm text-foreground">{gpsLng}</p></div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 items-end">
                <div><p className="text-sm font-medium text-muted-foreground">GPS Accuracy (m)</p><p className="mt-1 text-sm text-foreground">{survey.siteDetails?.accuracyMeters != null ? String(survey.siteDetails.accuracyMeters) : dummy.gps}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Captured At</p><p className="mt-1 text-sm text-foreground">{survey.siteDetails?.capturedAt ? formatSafeDateTime(survey.siteDetails.capturedAt) : dummy.captured}</p></div>
              </div>
              {gpsLat !== dummy.gps && gpsLng !== dummy.gps ? (
                <Button variant="outline" size="sm" className="border-solar text-foreground bg-transparent" asChild>
                  <a
                    href={`https://www.google.com/maps?q=${encodeURIComponent(gpsLat)},${encodeURIComponent(gpsLng)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    Site navigation
                  </a>
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="border-solar text-foreground bg-transparent" disabled>
                  <MapPin className="mr-2 h-4 w-4" />
                  Site navigation (capture GPS first)
                </Button>
              )}
            </CardContent>
          </Card>

          {/* 6. Uploads (Optional) */}
          <UploadGallerySection survey={survey} signedUrls={signedUrls} />

          <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Workflow</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {canApproveSurveys ? "Update Status" : "Status"}
                  </p>
                  {canApproveSurveys ? (
                    <Select
                      value={survey.status}
                      onValueChange={async (v) => {
                        if (!id) return
                        try {
                          await surveysData.updateSurveyStatus(id, v as "pending" | "approved" | "rejected" | "completed")
                          await refetch()
                          toast({ title: "Status updated" })
                        } catch (e) {
                          toast({
                            title: "Could not update status",
                            description: e instanceof Error ? e.message : "Please try again.",
                            variant: "destructive",
                          })
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="mt-1 text-sm font-medium text-foreground capitalize">{survey.status}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Upload Date: {survey.uploadDate ? formatSafeDateTime(survey.uploadDate) : "-"}
                    {survey.approvedDate ? ` • Approved: ${formatSafeDateTime(survey.approvedDate)}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitted by:{" "}
                    <span className="font-medium">
                      {survey.submittedById ? getUserById(survey.submittedById)?.name ?? survey.submittedById : "-"}
                    </span>{" "}
                    {survey.submittedAt ? `• ${formatSafeDateTime(survey.submittedAt)}` : ""}
                  </p>
                </div>

                {canManageInstallationFlow && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Assign installer{" "}
                      <span className="text-xs font-normal">(Supervisor, engineer, or manager)</span>
                    </p>
                    <Select value={installerId} onValueChange={handleAssignInstaller}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {installerUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} ({u.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {installerUsers.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No users with the Installer role yet. Add them under{" "}
                        <Link href="/users" className="font-medium text-foreground underline underline-offset-2">
                          Users
                        </Link>
                        .
                      </p>
                    )}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button type="button" variant="outline" onClick={handleApprove} className="w-full sm:w-auto">
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button type="button" variant="outline" onClick={handleMarkCompleted} className="w-full sm:w-auto">
                        <UserCog className="mr-2 h-4 w-4" />
                        Mark Completed
                      </Button>
                    </div>
                    <div className="pt-2">
                      <Button
                        type="button"
                        className="w-full bg-gradient-primary-button text-white hover:opacity-90"
                        onClick={handleCreateInstallation}
                      >
                        {linkedInstallation ? "Open Installation" : "Create Installation"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Linked Records</CardTitle>
                <p className="text-sm text-muted-foreground">Quick navigation across workflow</p>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-solar bg-background p-4">
                  <p className="text-sm font-medium text-foreground">Installation</p>
                  <p className="mt-1 text-sm text-muted-foreground">{linkedInstallation ? linkedInstallation.id : "Not created"}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!linkedInstallation}
                      onClick={() => linkedInstallation && router.push(`/installations/${linkedInstallation.id}`)}
                    >
                      Open
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-solar bg-background p-4">
                  <p className="text-sm font-medium text-foreground">Inspection</p>
                  <p className="mt-1 text-sm text-muted-foreground">{linkedInspection ? linkedInspection.id : "Not submitted"}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!linkedInspection}
                      onClick={() => linkedInspection && router.push(`/inspections/${linkedInspection.id}`)}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

          {/* Manager, Surveyor, Installer & Inspection details — name, role, number */}
          <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Assigned People &amp; Roles</CardTitle>
                <p className="text-sm text-muted-foreground">Manager, Surveyor, Installer and Inspection details with name, role and contact</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-solar bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Manager</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{managerUser?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{managerUser?.role ?? "—"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">ID: {managerUser?.id ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{managerUser?.email ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border border-solar bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Surveyor</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{surveyorUser?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{surveyorUser?.role ?? "—"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">ID: {surveyorUser?.id ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{surveyorUser?.email ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border border-solar bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Installer</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{installerUser?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{installerUser?.role ?? "—"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">ID: {installerUser?.id ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{installerUser?.email ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border border-solar bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Inspection (Inspector)</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{inspectorNameDisplay ?? (inspectorUser?.name ?? "—")}</p>
                    <p className="text-xs text-muted-foreground capitalize">{inspectorUser ? inspectorUser.role : "—"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">ID: {inspectorUser?.id ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{inspectorUser?.email ?? "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

          {/* Activity Log — with name and role of actor */}
          <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Activity Log</CardTitle>
                <p className="text-sm text-muted-foreground">Who did what and when — with name and role</p>
              </CardHeader>
              <CardContent>
                {Array.isArray(survey.activity) && survey.activity.length > 0 ? (
                  <div className="space-y-3">
                    {survey.activity
                      .slice()
                      .sort((a: any, b: any) => String(b.at).localeCompare(String(a.at)))
                      .map((evt: any, idx: number) => {
                        const actor = evt.actorId ? getUserById(evt.actorId) : null
                        const actorName = actor?.name ?? evt.actorId ?? "System"
                        const actorRole = actor?.role ? String(actor.role).replace(/_/g, " ") : ""
                        return (
                          <div key={idx} className="flex gap-3 rounded-lg border border-solar bg-background p-3">
                            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-solar-yellow" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-foreground">
                                <span className="font-medium">{actorName}</span>
                                {actorRole && <span className="text-muted-foreground"> ({actorRole})</span>}
                                {" — "}
                                {evt.message}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {evt.at ? formatSafeDateTime(evt.at) : "-"} • {String(evt.action).replace(/_/g, " ")}
                              </p>
                              {actor && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {actor.id} · {actor.email}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                )}
              </CardContent>
            </Card>

          {/* Manager Actions - only for manager (or admin) */}
          {canApproveSurveys && survey.status === "pending" && (
            <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Manager Approval</CardTitle>
                <p className="text-sm text-muted-foreground">Approve or reject this survey (manager only)</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Remarks</label>
                  <Textarea
                    placeholder="Add remarks or feedback..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="mt-2 border-solar"
                    rows={3}
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <Button onClick={handleApprove} className="flex-1 bg-green-600 text-white hover:bg-green-700">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve Survey
                  </Button>
                  <Button
                    onClick={handleReject}
                    variant="outline"
                    className="flex-1 border-red-600 text-destructive hover:bg-destructive/10 bg-transparent"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject Survey
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        </div>
      </main>
    </div>
  )
}
