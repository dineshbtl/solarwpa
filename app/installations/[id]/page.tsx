"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SolarWatermark } from "@/components/solar-watermark"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Package, CheckCircle, Play, Send, Pencil, Camera } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { useInstallation, useSurvey, useInspectionByInstallationId, useUsers } from "@/lib/data/hooks"
import * as installationsData from "@/lib/data/installations"
import * as inspectionsData from "@/lib/data/inspections"
import * as surveysData from "@/lib/data/surveys"
import { WorkflowSummarySection } from "@/components/workflow-summary-section"

export default function InstallationDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id ?? null

  const { data: installation, loading, error, refetch } = useInstallation(id)
  const { data: linkedSurvey } = useSurvey(installation?.surveyId ?? null)
  const { data: linkedInspection } = useInspectionByInstallationId(id)
  const { data: users = [] } = useUsers()

  const getUserById = (userId: string) => users.find((u) => u.id === userId)

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
      router.push(`/inspections/${insp.id}`)
    } catch (e) {
      toast({ title: "Failed to submit", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white relative">
        <SolarWatermark />
        <main className="mx-auto max-w-7xl px-4 py-8 relative z-10">
          <p className="text-muted-foreground">Loading installation...</p>
        </main>
      </div>
    )
  }

  if (error || !installation) {
    return (
      <div className="min-h-screen bg-white relative">
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
    <div className="min-h-screen bg-white relative">
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
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl text-solar-dark">{installation.customerName}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Installation ID: {installation.id}</p>
                </div>
                <div className="flex items-center gap-2">
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
                  <Link href={`/installations/${installation.id}/edit`}>
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
            surveySubmitDate={linkedSurvey?.uploadDate ? new Date(linkedSurvey.uploadDate).toLocaleString() : linkedSurvey?.submittedAt ? new Date(linkedSurvey.submittedAt).toLocaleString() : "—"}
            approvedByName={approvedByUser?.name ?? "—"}
            approvedDate={linkedSurvey?.approvedDate ? new Date(linkedSurvey.approvedDate).toLocaleString() : "—"}
            installerName={installation.engineerName ?? (installation.engineerId ? getUserById(installation.engineerId)?.name : null) ?? "—"}
            installationDate={installation.createdAt ? new Date(installation.createdAt).toLocaleString() : "—"}
            inspectorName={inspectorNameDisplay ?? inspectorUser?.name ?? "—"}
            inspectionDate={linkedInspection?.createdAt ? new Date(linkedInspection.createdAt).toLocaleString() : "—"}
          />

          {/* Actions */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-solar-dark">Actions</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Update installation status as work progresses.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {installation.status === "pending" && (
                    <Button onClick={handleStart} className="bg-solar-dark text-black hover:bg-solar-dark/90">
                      <Play className="mr-2 h-4 w-4" />
                      Start
                    </Button>
                  )}
                  {installation.status === "in_progress" && (
                    <Button onClick={handleComplete} className="bg-solar-dark text-black hover:bg-solar-dark/90">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark Completed
                    </Button>
                  )}
                  {installation.status === "completed" && (
                    <Button onClick={handleSubmitForInspection} className="bg-solar-dark text-black  hover:bg-solar-dark/90">
                      <Send className="mr-2 h-4 w-4" />
                      Submit for Inspection
                    </Button>
                  )}
                  {installation.status === "inspection_pending" && (
                    <Button variant="outline" disabled>
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
                <CardTitle className="text-lg text-solar-dark">Installation Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Address</p>
                  <p className="mt-1 text-sm text-solar-dark">{installation.address}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Installation Engineer</p>
                  <p className="mt-1 text-sm text-solar-dark">{installation.engineerName || installation.engineerId || "—"}</p>
                  {installation.engineerId && <p className="text-xs text-muted-foreground">{installation.engineerId}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {installation.startedAt && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Started</p>
                      <p className="mt-1 text-sm text-solar-dark">
                        {new Date(installation.startedAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  )}
                  {installation.completedAt && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Completed</p>
                      <p className="mt-1 text-sm text-solar-dark">
                        {new Date(installation.completedAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Progress */}
            <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-solar-dark">Installation Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Overall Progress</span>
                    <span className="font-semibold text-solar-dark">
                      {installation.status === "completed" ? "100%" : "75%"}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-solar-beige">
                    <div
                      className="h-full bg-solar-yellow transition-all"
                      style={{ width: installation.status === "completed" ? "100%" : "75%" }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm text-solar-dark">Materials received and scanned</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm text-solar-dark">Panels installed</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm text-solar-dark">Wiring completed</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle
                      className={`h-5 w-5 ${installation.status === "completed" ? "text-green-600" : "text-gray-300"}`}
                    />
                    <span className="text-sm text-solar-dark">Final inspection</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Materials */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-solar-dark">Materials & Serial Numbers</CardTitle>
                <div className="rounded-lg bg-solar-yellow px-3 py-1">
                  <span className="text-sm font-semibold text-solar-dark">{(installation.materials ?? []).length} items</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(installation.materials ?? []).map((material) => (
                  <div key={material.id} className="flex items-center gap-4 rounded-lg border border-solar p-4">
                    <div className="rounded-lg bg-solar-yellow p-2">
                      <Package className="h-5 w-5 text-solar-dark" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-solar-dark">{material.name}</h4>
                      <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                        <span>S/N: {material.serialNumber}</span>
                        <span>Barcode: {material.barcode}</span>
                      </div>
                    </div>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Installation Photos */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-solar-dark">Installation Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(installation.photos ?? []).map((photo: Record<string, unknown>) => {
                  const id = typeof photo.id === "string" ? photo.id : `photo-${Math.random()}`
                  const fileMeta = photo.file ?? photo.file_meta
                  const file = fileMeta && typeof fileMeta === "object" && !Array.isArray(fileMeta)
                    ? (fileMeta as Record<string, unknown>)
                    : null
                  const fileName = file && typeof file.name === "string" ? file.name : null
                  const url = typeof photo.url === "string" ? photo.url : null
                  const category = typeof photo.category === "string" ? photo.category : ""
                  const description = typeof photo.description === "string" ? photo.description : ""
                  return (
                    <div key={id} className="space-y-2">
                      <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg border border-solar bg-muted/50">
                        {url ? (
                          <img src={url} alt={description || "Installation photo"} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
                            <Camera className="h-10 w-10 text-muted-foreground/60" />
                            {fileName ? (
                              <span className="font-medium text-solar-dark">{fileName}</span>
                            ) : (
                              <span>Photo</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="inline-flex items-center rounded-full bg-solar-yellow px-2 py-1 text-xs font-medium text-solar-dark">
                          {String(category || "").replace("_", " ") || "photo"}
                        </span>
                        <p className="mt-1 text-sm text-muted-foreground">{description || "-"}</p>
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

          {/* Submit for Inspection */}
          {installation.status === "completed" && (
            <Card className="border-solar bg-solar-card shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-solar-dark">Ready for Inspection</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Submit this installation for manager review and inspection
                    </p>
                  </div>
                  <Button
                    onClick={handleSubmitForInspection}
                    className="bg-solar-dark text-white hover:bg-solar-dark/90"
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
    </div>
  )
}
