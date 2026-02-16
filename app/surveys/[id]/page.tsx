"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SolarWatermark } from "@/components/solar-watermark"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, MapPin, CheckCircle, XCircle, UserCog, Pencil, FileImage } from "lucide-react"
import { mockSurveys } from "@/lib/mock-data"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import * as surveysData from "@/lib/data/surveys"
import { getUserById, listUsers, seedUsers } from "@/lib/store/users"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createInstallation, listInstallations } from "@/lib/store/installations"
import { getInspectionByInstallationId } from "@/lib/store/inspections"
import { useRole } from "@/contexts/role-context"
import { WorkflowSummarySection } from "@/components/workflow-summary-section"
import { useSurvey } from "@/lib/data/hooks"
import { Skeleton } from "@/components/ui/skeleton"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export default function SurveyDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id ?? null
  const { canApproveSurveys } = useRole()
  const [remarks, setRemarks] = useState("")
  const [installerId, setInstallerId] = useState<string>("__none__")

  const { data: surveyFromDb, loading, error, refetch } = useSurvey(id)
  const legacySurvey = !isSupabaseConfigured() && id ? mockSurveys.find((s) => s.id === id) : null
  const isStored = !!surveyFromDb
  const survey = surveyFromDb ?? legacySurvey ?? null

  useEffect(() => {
    seedUsers()
  }, [])

  useEffect(() => {
    if (survey?.installerId) setInstallerId(survey.installerId)
    else if (survey) setInstallerId("__none__")
  }, [survey?.id, survey?.installerId])

  if (loading) {
    return (
      <div className="min-h-screen bg-background relative">
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
      <div className="min-h-screen bg-background p-6 sm:p-8">
        <p className="text-destructive">Failed to load survey.</p>
        <Link href="/surveys">
          <Button variant="outline" className="mt-4">Back to Surveys</Button>
        </Link>
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-background p-6 sm:p-8">
        <p className="text-muted-foreground">Survey not found.</p>
        <Link href="/surveys">
          <Button variant="outline" className="mt-4">Back to Surveys</Button>
        </Link>
      </div>
    )
  }

  const handleApprove = async () => {
    if (!isStored) {
      toast({ title: "Demo record", description: "This survey comes from mock data and can't be updated." })
      return
    }
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
    if (!isStored) {
      toast({ title: "Demo record", description: "This survey comes from mock data and can't be updated." })
      return
    }
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
    if (!isStored) {
      toast({ title: "Demo record", description: "This survey comes from mock data and can't be updated." })
      return
    }
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
    if (!isStored) {
      toast({ title: "Demo record", description: "This survey comes from mock data and can't be updated." })
      return
    }
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
    if (!isStored) {
      toast({ title: "Demo record", description: "This survey comes from mock data." })
      return
    }
    if (!id) return
    if (!survey.installerId) {
      toast({ title: "Assign installer first", description: "Please assign an installer (engineer) first.", variant: "destructive" })
      return
    }
    const existing = listInstallations().find((i) => i.surveyId === id)
    if (existing) {
      toast({ title: "Installation already exists", description: `Opening ${existing.id}` })
      router.push(`/installations/${existing.id}`)
      return
    }
    const engineer = getUserById(survey.installerId)
    const created = createInstallation(
      {
        surveyId: id,
        customerName: survey.beneficiaryName,
        address: survey.siteLocation?.address || `${survey.siteLocation?.district || ""} ${survey.siteLocation?.pinCode || ""}`.trim(),
        engineerName: engineer?.name,
        engineerId: engineer?.id,
      },
      { materials: [], photos: [] },
    )
    try {
      await surveysData.appendSurveyActivity(id, {
        actorId: survey.installerId,
        action: "installation_created",
        message: `Installation created (${created.id})`,
        meta: { installationId: created.id },
      })
      await refetch()
    } catch (_) {}
    toast({ title: "Installation created", description: created.id })
    router.push(`/installations/${created.id}`)
  }

  const linkedInstallation = isStored && id ? listInstallations().find((i) => i.surveyId === id) : undefined
  const linkedInspection = linkedInstallation ? getInspectionByInstallationId(linkedInstallation.id) : undefined

  // Manager: from activity (who did status_changed / installer_assigned) or first manager user
  let managerUser: ReturnType<typeof getUserById> = listUsers().find((u) => u.role === "manager" || u.role === "admin")
  if (isStored && Array.isArray(survey.activity)) {
    const byManager = survey.activity
      .slice()
      .sort((a: any, b: any) => String(b.at).localeCompare(String(a.at)))
      .map((e: any) => (e.actorId ? getUserById(e.actorId) : null))
      .find((u: ReturnType<typeof getUserById>) => u?.role === "manager" || u?.role === "admin")
    if (byManager) managerUser = byManager
  }
  const surveyorUser = survey.submittedById ? getUserById(survey.submittedById) : null
  const installerUser = survey.installerId ? getUserById(survey.installerId) : null
  const inspectorUser = linkedInspection?.inspectorId ? getUserById(linkedInspection.inspectorId) : null
  const inspectorNameDisplay = linkedInspection?.governmentInspection?.inspectorName ?? inspectorUser?.name

  // Approved by: from activity (who set status to approved)
  const approvedByEvent = isStored && Array.isArray(survey.activity)
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
  const beneficiaryName = isStored ? (survey.beneficiaryName || dummy.beneficiary) : (survey.customerName ?? dummy.beneficiary)
  const surveyorName = isStored && survey.submittedById ? (getUserById(survey.submittedById)?.name ?? survey.submittedById) : (survey as any).engineerName ?? dummy.beneficiary
  const gpsLat = isStored ? (survey.siteDetails?.gpsLat ?? dummy.gps) : (survey.gpsLocation?.lat != null ? String(survey.gpsLocation.lat) : dummy.gps)
  const gpsLng = isStored ? (survey.siteDetails?.gpsLng ?? dummy.gps) : (survey.gpsLocation?.lng != null ? String(survey.gpsLocation.lng) : dummy.gps)

  return (
    <div className="min-h-screen bg-white relative">
      <SolarWatermark />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 relative z-10">
        <Link href="/surveys">
          <Button variant="ghost" className="mb-6 text-primary hover:bg-muted">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Surveys
          </Button>
        </Link>

        <div className="space-y-6">
          {/* Header */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl text-solar-dark">
                    {isStored ? survey.beneficiaryName : survey.customerName}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Survey ID: {survey.id}</p>
                </div>
                <div className="flex items-center gap-2">
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
                  {isStored ? (
                    <Link href={`/surveys/${survey.id}/edit`}>
                      <Button type="button" variant="outline" size="sm" className="border-solar bg-transparent">
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-solar bg-transparent"
                      onClick={() =>
                        toast({ title: "Demo record", description: "This survey comes from mock data and can't be edited." })
                      }
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Workflow Summary — surveyor, approved by, installer, inspector (same section on survey/installation/inspection pages) */}
          <WorkflowSummarySection
            surveyorName={surveyorUser?.name ?? (survey as any).engineerName ?? "—"}
            surveySubmitDate={survey.uploadDate ? new Date(survey.uploadDate).toLocaleString() : (survey.submittedAt ? new Date(survey.submittedAt).toLocaleString() : (survey as any).createdAt ? new Date((survey as any).createdAt).toLocaleString() : "—")}
            approvedByName={approvedByUser?.name ?? "—"}
            approvedDate={survey.approvedDate ? new Date(survey.approvedDate).toLocaleString() : "—"}
            installerName={installerUser?.name ?? "—"}
            installationDate={linkedInstallation?.createdAt ? new Date(linkedInstallation.createdAt).toLocaleString() : "—"}
            inspectorName={inspectorNameDisplay ?? inspectorUser?.name ?? "—"}
            inspectionDate={linkedInspection?.createdAt ? new Date(linkedInspection.createdAt).toLocaleString() : "—"}
          />

          {/* 1. Beneficiary Details — same section order as survey form */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-solar-dark">Beneficiary Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Surveyor (submitted by)</p>
                  <p className="mt-1 text-sm text-solar-dark">{surveyorName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Name of the Beneficiary</p>
                  <p className="mt-1 text-sm text-solar-dark">{beneficiaryName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Service No</p>
                  <p className="mt-1 text-sm text-solar-dark">{v(isStored ? survey.serviceNo : undefined, dummy.serviceNo)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Aadhar No</p>
                  <p className="mt-1 text-sm text-solar-dark">{v(isStored ? survey.aadharNo : undefined, dummy.aadhar)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">PAN No</p>
                  <p className="mt-1 text-sm text-solar-dark">{v(isStored ? survey.panNo : undefined, dummy.pan)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Mobile</p>
                  <p className="mt-1 text-sm text-solar-dark">{v(isStored ? survey.mobile : undefined, dummy.mobile)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Contracted Load</p>
                  <p className="mt-1 text-sm text-solar-dark">{survey.contractedLoad != null ? String(survey.contractedLoad) : dummy.load}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Site Location */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-solar-dark">Site Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div><p className="text-sm font-medium text-muted-foreground">Section</p><p className="mt-1 text-sm text-solar-dark">{v(siteLocation.section, dummy.section)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Sub Division</p><p className="mt-1 text-sm text-solar-dark">{v(siteLocation.subDivision, dummy.subDiv)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Division</p><p className="mt-1 text-sm text-solar-dark">{v(siteLocation.division, dummy.division)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Circle</p><p className="mt-1 text-sm text-solar-dark">{v(siteLocation.circle, dummy.circle)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Mandal</p><p className="mt-1 text-sm text-solar-dark">{v(siteLocation.mandal, dummy.mandal)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">District</p><p className="mt-1 text-sm text-solar-dark">{v(siteLocation.district, dummy.district)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Pin Code</p><p className="mt-1 text-sm text-solar-dark">{v(siteLocation.pinCode, dummy.pin)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">City</p><p className="mt-1 text-sm text-solar-dark">{v(siteLocation.city, dummy.city)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">State</p><p className="mt-1 text-sm text-solar-dark">{v(siteLocation.state, dummy.state)}</p></div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Address of the Location</p>
                <p className="mt-1 text-sm text-solar-dark">{v(siteLocation.address ?? (survey as any).address, dummy.address)}</p>
              </div>
            </CardContent>
          </Card>

          {/* 3. Plant & Roof Details */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-solar-dark">Plant & Roof Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div><p className="text-sm font-medium text-muted-foreground">Type of Solar Power Plant</p><p className="mt-1 text-sm text-solar-dark">{v(isStored ? survey.plantType : undefined, dummy.plantType)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Building Height</p><p className="mt-1 text-sm text-solar-dark">{survey.buildingHeight != null && survey.buildingHeight > 0 ? String(survey.buildingHeight) : dummy.height}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Total No of Roofs</p><p className="mt-1 text-sm text-solar-dark">{v(isStored ? survey.totalRoofs : undefined, dummy.roofs)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Type of Roof</p><p className="mt-1 text-sm text-solar-dark">{v(isStored ? survey.roofType : undefined, dummy.roofType)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">DISCOM Name</p><p className="mt-1 text-sm text-solar-dark">{v(isStored ? survey.discomName : undefined, dummy.discom)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Meter AC Cable (m)</p><p className="mt-1 text-sm text-solar-dark">{survey.siteDetails?.meterAcCableMeters != null ? String(survey.siteDetails.meterAcCableMeters) : "—"}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Meter DC Cable (m)</p><p className="mt-1 text-sm text-solar-dark">{survey.siteDetails?.meterDcCableMeters != null ? String(survey.siteDetails.meterDcCableMeters) : "—"}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Bank Details */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-solar-dark">Bank Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div><p className="text-sm font-medium text-muted-foreground">Bank Name</p><p className="mt-1 text-sm text-solar-dark">{v(bankDetails.bankName, dummy.bankName)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Branch</p><p className="mt-1 text-sm text-solar-dark">{v(bankDetails.branch, dummy.branch)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Account No</p><p className="mt-1 text-sm text-solar-dark">{v(bankDetails.accountNo, dummy.account)}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">IFSC</p><p className="mt-1 text-sm text-solar-dark">{v(bankDetails.ifsc, dummy.ifsc)}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* 5. Site Details (GPRS Cam) */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-solar-dark">Site Details (GPRS Cam)</CardTitle>
              <p className="text-sm text-muted-foreground">Capture location to auto-fill site details</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="text-sm font-medium text-muted-foreground">Latitude</p><p className="mt-1 text-sm text-solar-dark">{gpsLat}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Longitude</p><p className="mt-1 text-sm text-solar-dark">{gpsLng}</p></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="text-sm font-medium text-muted-foreground">GPS Accuracy (m)</p><p className="mt-1 text-sm text-solar-dark">{survey.siteDetails?.accuracyMeters != null ? String(survey.siteDetails.accuracyMeters) : dummy.gps}</p></div>
                <div><p className="text-sm font-medium text-muted-foreground">Captured At</p><p className="mt-1 text-sm text-solar-dark">{survey.siteDetails?.capturedAt ? new Date(survey.siteDetails.capturedAt).toLocaleString() : dummy.captured}</p></div>
              </div>
              {gpsLat !== dummy.gps && gpsLng !== dummy.gps ? (
                <Button variant="outline" size="sm" className="border-solar text-solar-dark bg-transparent" asChild>
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
                <Button variant="outline" size="sm" className="border-solar text-solar-dark bg-transparent" disabled>
                  <MapPin className="mr-2 h-4 w-4" />
                  Site navigation (capture GPS first)
                </Button>
              )}
            </CardContent>
          </Card>

          {/* 6. Uploads (Optional) */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-solar-dark">Uploads (Optional)</CardTitle>
              <p className="text-sm text-muted-foreground">Aadhar, PAN, Bank Proof, E-Bill, Beneficiary Photo, Site Layout, Site Photos</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ["aadhaarCard", "Aadhar Card Upload"],
                    ["panCard", "PAN Upload"],
                    ["bankProof", "Cancelled Cheque / Pass Book Photo"],
                    ["eBill", "E-Bill Photo"],
                    ["beneficiaryPhoto", "Beneficiary Photo with Site Location (GPRS Cam)"],
                    ["siteLayout", "Site Layout (Draw and Upload)"],
                    ["roofTerraceNorth", "Rooftop terrace (from north location)"],
                    ["roofTerraceSouth", "Rooftop terrace (from south location)"],
                    ["earthingAreaPic", "Earthing Area pic"],
                  ] as const
                ).map(([key, label]) => {
                  const meta = survey.uploads?.[key] as { name?: string; url?: string } | undefined
                  const fileName = meta?.name
                  const imageUrl = meta?.url
                  const isDataUrl = typeof imageUrl === "string" && imageUrl.startsWith("data:")
                  return (
                    <div key={key} className="overflow-hidden rounded-lg border border-solar bg-background">
                      <div className="aspect-[4/3] w-full bg-muted flex items-center justify-center overflow-hidden">
                        {imageUrl ? (
                          <div className="relative h-full w-full">
                            <img
                              src={imageUrl}
                              alt={label}
                              className="h-full w-full object-cover"
                              referrerPolicy={isDataUrl ? undefined : "no-referrer"}
                              crossOrigin={isDataUrl ? undefined : "anonymous"}
                              onError={(e) => {
                                e.currentTarget.style.display = "none"
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
                                if (fallback) fallback.classList.remove("hidden")
                              }}
                            />
                            <div className="absolute inset-0 hidden flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground p-4 survey-upload-fallback">
                              <FileImage className="h-10 w-10" />
                              <span className="text-xs">Image unavailable</span>
                            </div>
                          </div>
                        ) : fileName ? (
                          <img src="/placeholder.svg?height=200&width=280&text=Document" alt={label} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground p-4">
                            <FileImage className="h-10 w-10" />
                            <span className="text-xs">Not uploaded</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3 border-t border-solar">
                        <p className="text-sm font-medium text-solar-dark">{label}</p>
                        <p className="text-xs text-muted-foreground truncate">{fileName ?? "—"}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {isStored && (
            <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-solar-dark">Workflow</CardTitle>
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
                    <p className="mt-1 text-sm font-medium text-solar-dark capitalize">{survey.status}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Upload Date: {survey.uploadDate ? new Date(survey.uploadDate).toLocaleString() : "-"}
                    {survey.approvedDate ? ` • Approved: ${new Date(survey.approvedDate).toLocaleString()}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitted by:{" "}
                    <span className="font-medium">
                      {survey.submittedById ? getUserById(survey.submittedById)?.name ?? survey.submittedById : "-"}
                    </span>{" "}
                    {survey.submittedAt ? `• ${new Date(survey.submittedAt).toLocaleString()}` : ""}
                  </p>
                </div>

                {canApproveSurveys && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Assign Installer <span className="text-xs">(Engineer)</span>
                    </p>
                    <Select value={installerId} onValueChange={handleAssignInstaller}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {listUsers()
                          .filter((u) => u.role === "engineer")
                          .map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name} ({u.id})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={handleApprove}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button type="button" variant="outline" onClick={handleMarkCompleted}>
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
          )}

          {isStored && (
            <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-solar-dark">Linked Records</CardTitle>
                <p className="text-sm text-muted-foreground">Quick navigation across workflow</p>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-solar bg-background p-4">
                  <p className="text-sm font-medium text-solar-dark">Installation</p>
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
                  <p className="text-sm font-medium text-solar-dark">Inspection</p>
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
          )}

          {/* Manager, Surveyor, Installer & Inspection details — name, role, number */}
          {isStored && (
            <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-solar-dark">Assigned People &amp; Roles</CardTitle>
                <p className="text-sm text-muted-foreground">Manager, Surveyor, Installer and Inspection details with name, role and contact</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-solar bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Manager</p>
                    <p className="mt-1 text-sm font-medium text-solar-dark">{managerUser?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{managerUser?.role ?? "—"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">ID: {managerUser?.id ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{managerUser?.email ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border border-solar bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Surveyor</p>
                    <p className="mt-1 text-sm font-medium text-solar-dark">{surveyorUser?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{surveyorUser?.role ?? "—"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">ID: {surveyorUser?.id ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{surveyorUser?.email ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border border-solar bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Installer (Engineer)</p>
                    <p className="mt-1 text-sm font-medium text-solar-dark">{installerUser?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{installerUser?.role ?? "—"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">ID: {installerUser?.id ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{installerUser?.email ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border border-solar bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Inspection (Inspector)</p>
                    <p className="mt-1 text-sm font-medium text-solar-dark">{inspectorNameDisplay ?? (inspectorUser?.name ?? "—")}</p>
                    <p className="text-xs text-muted-foreground capitalize">{inspectorUser ? inspectorUser.role : "—"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">ID: {inspectorUser?.id ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{inspectorUser?.email ?? "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activity Log — with name and role of actor */}
          {isStored && (
            <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-solar-dark">Activity Log</CardTitle>
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
                              <p className="text-sm text-solar-dark">
                                <span className="font-medium">{actorName}</span>
                                {actorRole && <span className="text-muted-foreground"> ({actorRole})</span>}
                                {" — "}
                                {evt.message}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {evt.at ? new Date(evt.at).toLocaleString() : "-"} • {String(evt.action).replace(/_/g, " ")}
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
          )}

          {/* Survey Notes - legacy only */}
          {!isStored && (
            <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-solar-dark">Survey Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-solar-dark">{survey.notes ?? "-"}</p>
              </CardContent>
            </Card>
          )}

          {/* Manager Actions - only for manager (or admin) */}
          {canApproveSurveys && survey.status === "pending" && (
            <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-solar-dark">Manager Approval</CardTitle>
                <p className="text-sm text-muted-foreground">Approve or reject this survey (manager only)</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-solar-dark">Remarks</label>
                  <Textarea
                    placeholder="Add remarks or feedback..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="mt-2 border-solar"
                    rows={3}
                  />
                </div>
                <div className="flex gap-4">
                  <Button onClick={handleApprove} className="flex-1 bg-green-600 text-white hover:bg-green-700">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve Survey
                  </Button>
                  <Button
                    onClick={handleReject}
                    variant="outline"
                    className="flex-1 border-red-600 text-red-600 hover:bg-red-50 bg-transparent"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject Survey
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
