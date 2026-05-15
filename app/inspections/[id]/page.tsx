"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useInstallationPhotoDisplayUrls } from "@/lib/supabase/installation-photo-urls"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SolarWatermark } from "@/components/solar-watermark"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, Pencil, MapPin } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import * as inspectionsData from "@/lib/data/inspections"
import * as installationsData from "@/lib/data/installations"
import * as surveysData from "@/lib/data/surveys"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useUsers } from "@/lib/data/hooks"
import { WorkflowSummarySection } from "@/components/workflow-summary-section"
import { parseStoredGps } from "@/lib/installation-photo-gps"
import { formatSafeDateTime } from "@/lib/format-safe-date"
import { useRole } from "@/contexts/role-context"

import { InspectionDetailPageSkeleton } from "@/components/inspections-loading-skeletons"

export default function InspectionDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id
  const { role, currentUser } = useRole()
  const [govRemarks, setGovRemarks] = useState("")
  const [inspection, setInspection] = useState<any>(null)
  const [installation, setInstallation] = useState<any>(null)
  const [linkedSurvey, setLinkedSurvey] = useState<any>(null)
  const [inspectorId, setInspectorId] = useState<string>("__none__")
  const [loading, setLoading] = useState(true)
  const { data: users = [] } = useUsers()
  const getUserById = useCallback(
    (uid: string | undefined) => (uid ? users.find((u) => u.id === uid) : undefined),
    [users]
  )

  const installationPhotoUrlInputs = useMemo(() => {
    const photos = installation?.photos
    if (!Array.isArray(photos) || photos.length === 0) return []
    return photos.map((p: Record<string, unknown>, i: number) => {
      const pid = typeof p.id === "string" && p.id ? p.id : `photo-${i}`
      const fileMeta = p.file ?? p.file_meta
      const fileObj =
        fileMeta && typeof fileMeta === "object" && !Array.isArray(fileMeta)
          ? (fileMeta as Record<string, unknown>)
          : null
      const fileName = fileObj && typeof fileObj.name === "string" ? fileObj.name : undefined
      return {
        id: pid,
        url: typeof p.url === "string" ? p.url : undefined,
        category: typeof p.category === "string" ? p.category : undefined,
        file: fileName ? { name: fileName } : undefined,
      }
    })
  }, [installation])

  const installationPhotoDisplayUrls = useInstallationPhotoDisplayUrls(
    installationPhotoUrlInputs,
    installation?.id
  )

  useEffect(() => {
    const loadData = async () => {
      if (!id) return
      setLoading(true)
      setInspection(null)
      setInstallation(null)
      setLinkedSurvey(null)
      try {
        const storedInspection = await inspectionsData.getInspectionById(id)
        if (!storedInspection) {
          return
        }
        setInspection(storedInspection)
        setInspectorId(storedInspection.inspectorId ?? "__none__")
        const storedInstallation = await installationsData.getInstallationById(storedInspection.installationId)
        setInstallation(storedInstallation ?? null)
        const surveyId = storedInstallation?.surveyId ?? (storedInspection as { surveyId?: string }).surveyId
        if (surveyId) {
          const survey = await surveysData.getSurveyById(surveyId)
          setLinkedSurvey(survey ?? null)
        }
      } catch (e) {
        console.error("Error loading inspection:", e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  if (loading) {
    return <InspectionDetailPageSkeleton showWatermark />
  }

  if (!inspection) {
    return (
      <div className="min-h-full bg-page relative">
        <SolarWatermark />
        <main className="mx-auto max-w-7xl px-4 py-8 relative z-10">
          <p className="text-muted-foreground">Inspection not found.</p>
          <Link href="/inspections">
            <Button variant="outline" className="mt-4">
              Back to Inspections
            </Button>
          </Link>
        </main>
      </div>
    )
  }

  if (!installation) {
    return (
      <div className="min-h-full bg-page relative">
        <SolarWatermark />
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 relative z-10">
          <Link href="/inspections">
            <Button variant="ghost" className="mb-6 text-primary hover:bg-muted">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Inspections
            </Button>
          </Link>
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Linked installation missing</CardTitle>
              <p className="text-sm text-muted-foreground">
                Inspection {inspection.id} has no matching installation record ({inspection.installationId}). It may have been removed or the link is invalid.
              </p>
            </CardHeader>
          </Card>
        </main>
      </div>
    )
  }

  const approvedByEvent = linkedSurvey && Array.isArray(linkedSurvey.activity)
    ? linkedSurvey.activity.find((e: any) => e.action === "status_changed" && (e.meta as any)?.status === "approved")
    : null
  const approvedByUser = approvedByEvent?.actorId ? getUserById(approvedByEvent.actorId) : null
  const inspectorUser = inspection.inspectorId ? getUserById(inspection.inspectorId) : null
  const inspectorNameDisplay = inspection.governmentInspection?.inspectorName ?? inspectorUser?.name

  const handleAssignInspector = async (value: string) => {
    if (!id) return
    try {
      const nextId = value === "__none__" ? undefined : value
      const updated = await inspectionsData.assignInspectionInspector(id, nextId)
      setInspection(updated)
      setInspectorId(value)
      toast({ title: "Inspector assigned" })
    } catch (e) {
      toast({ title: "Failed to assign inspector", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    }
  }

  const handleGovApprove = async () => {
    if (!govRemarks) {
      toast({ title: "Remarks required", description: "Please provide inspection remarks.", variant: "destructive" })
      return
    }
    try {
      if (!id) return
      const actorName = inspection.inspectorId ? getUserById(inspection.inspectorId)?.name : undefined
      const updated = await inspectionsData.setGovernmentInspection(id, true, govRemarks, actorName ?? "Inspector")
      setInspection(updated)
      toast({ title: "Government approved", description: "Project completed." })
      router.push("/inspections")
    } catch (e) {
      toast({ title: "Failed to approve", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    }
  }

  const handleGovReject = async () => {
    if (!govRemarks) {
      toast({ title: "Remarks required", description: "Please provide remarks for rejection.", variant: "destructive" })
      return
    }
    try {
      if (!id) return
      const actorName = inspection.inspectorId ? getUserById(inspection.inspectorId)?.name : undefined
      const updated = await inspectionsData.setGovernmentInspection(id, false, govRemarks, actorName ?? "Inspector")
      setInspection(updated)
      toast({ title: "Government rejected", description: "Inspection reopened for corrections." })
      router.push("/inspections")
    } catch (e) {
      toast({ title: "Failed to reject", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    }
  }

  return (
    <div className="min-h-screen bg-background relative">
      <SolarWatermark />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 relative z-10">
        <Link href="/inspections">
          <Button variant="ghost" className="mb-6 text-primary hover:bg-muted">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Inspections
          </Button>
        </Link>

        <div className="space-y-6">
          {/* Header */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-2xl text-foreground">{inspection.customerName}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Inspection ID: {inspection.id}</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                    inspection.status === "approved"
                      ? "bg-green-100 text-green-800"
                      : inspection.status === "rejected"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {inspection.status}
                </span>
              </div>
              <div className="mt-4 flex justify-end">
                <Link href={`/inspections/${inspection.id}/edit`}>
                  <Button type="button" variant="outline" size="sm" className="border-solar bg-transparent">
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </Link>
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
            inspectionDate={inspection.createdAt ? formatSafeDateTime(inspection.createdAt) : "—"}
          />

          <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Inspector Assignment</CardTitle>
                <p className="text-sm text-muted-foreground">Assign a govt-role user to approve/reject</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={inspectorId} onValueChange={handleAssignInspector}>
                  <SelectTrigger className="w-full border-solar bg-background">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {users
                      .filter((u) => u.role === "government")
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.id})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Current:{" "}
                  {inspection.inspectorId ? getUserById(inspection.inspectorId)?.name ?? inspection.inspectorId : "Unassigned"}
                </p>
              </CardContent>
            </Card>

          {/* Installation Reference */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Installation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Address</p>
                  <p className="mt-1 text-sm text-foreground">{inspection.address}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Installation ID</p>
                  <p className="mt-1 text-sm text-foreground">{inspection.installationId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Project ID</p>
                  <p className="mt-1 text-sm text-foreground">{inspection.projectId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Inspection Date</p>
                  <p className="mt-1 text-sm text-foreground">
                    {new Date(inspection.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
              </div>
              <div className="pt-2">
                <Link href={`/installations/${inspection.installationId}`}>
                  <Button variant="outline" size="sm" className="border-solar text-foreground bg-transparent">
                    View Full Installation Details
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Installation Photos */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Installation Photos</CardTitle>
            </CardHeader>
            <CardContent>
              {(installation.photos && installation.photos.length > 0) || (installation.installationImages && installation.installationImages.length > 0) ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {((installation.photos || installation.installationImages) as Array<{id?: string, url?: string, description?: string, category?: string}>).map((image: any, idx: number) => {
                    const stableId = typeof image.id === "string" && image.id ? image.id : `photo-${idx}`
                    const resolved = installationPhotoDisplayUrls[stableId] || image.url
                    const gps = parseStoredGps(image as Record<string, unknown>)
                    return (
                    <div key={stableId} className="space-y-2">
                      <div className="overflow-hidden rounded-lg border border-solar">
                        <img
                          src={resolved || "/placeholder.svg"}
                          alt={image.description || "Installation photo"}
                          className="h-64 w-full object-cover"
                        />
                      </div>
                      <div>
                        <span className="inline-flex items-center rounded-full bg-solar-yellow px-2 py-1 text-xs font-medium text-foreground">
                          {(image.category ?? "").replace(/_/g, " ") || "photo"}
                        </span>
                        <p className="mt-1 text-sm text-muted-foreground">{image.description || "-"}</p>
                        {gps && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
                  )})}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">No photos available.</p>
              )}
            </CardContent>
          </Card>

          {/* Inspector Decision (Gov-role) */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle className={`h-5 w-5 ${inspection.governmentInspection?.approved ? "text-green-600" : "text-muted-foreground300"}`} />
                <CardTitle className="text-lg text-foreground">Inspection Decision</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {inspection.governmentInspection ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                        inspection.governmentInspection.approved ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {inspection.governmentInspection.approved ? "Approved" : "Rejected"}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Inspector</p>
                    <p className="mt-1 text-sm text-foreground">
                      {inspection.governmentInspection.inspectorName || (inspection.inspectorId ? getUserById(inspection.inspectorId)?.name : "-")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Date</p>
                    <p className="mt-1 text-sm text-foreground">
                      {inspection.governmentInspection.inspectedAt ? new Date(inspection.governmentInspection.inspectedAt).toLocaleDateString("en-IN") : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Remarks</p>
                    <p className="mt-1 text-sm text-foreground">{inspection.governmentInspection.remarks}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-4">
                    <AlertCircle className="h-5 w-5 text-blue-600" />
                    <p className="text-sm text-blue-800">Pending inspection decision</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Inspection Remarks</label>
                    <Textarea
                      placeholder="Add inspection remarks..."
                      value={govRemarks}
                      onChange={(e) => setGovRemarks(e.target.value)}
                      className="mt-2 border-solar"
                      rows={3}
                    />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                    <Button onClick={handleGovApprove} className="w-full flex-1 bg-green-600 text-white hover:bg-green-700">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      onClick={handleGovReject}
                      variant="outline"
                      className="w-full flex-1 border-red-600 text-destructive hover:bg-destructive/10 bg-transparent"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Log */}
          {Array.isArray(inspection.activity) && inspection.activity.length > 0 && (
            <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Activity Log</CardTitle>
                <p className="text-sm text-muted-foreground">Who did what and when</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {inspection.activity
                    .slice()
                    .sort((a: any, b: any) => String(b.at).localeCompare(String(a.at)))
                    .map((evt: any, idx: number) => {
                      const actor = evt.actorId ? getUserById(evt.actorId)?.name ?? evt.actorId : "System"
                      return (
                        <div key={idx} className="flex gap-3 rounded-lg border border-solar bg-background p-3">
                          <div className="mt-1 h-2 w-2 rounded-full bg-solar-yellow" />
                          <div className="min-w-0">
                            <p className="text-sm text-foreground">
                              <span className="font-medium">{actor}</span> — {evt.message}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {evt.at ? formatSafeDateTime(evt.at) : "-"} • {evt.action}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
