"use client"

import type React from "react"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Plus, Trash2, Upload, Save, Package, Camera, Scan, CheckCircle, Loader2 } from "lucide-react"
import { compressImage } from "@/lib/image-compress"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import * as installationsData from "@/lib/data/installations"
import * as surveysData from "@/lib/data/surveys"
import type { InstallationPhotoMeta, Material } from "@/lib/store/installations"
import type { Survey } from "@/lib/store/surveys"
import { useInstallation, useProjects } from "@/lib/data/hooks"
import { SurveySelect } from "@/components/survey-select"

function PhotoPreviewCell({
  file,
  existingFile,
}: { file: File | null; existingFile?: { name: string; type: string; size: number } }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const prevUrlRef = useRef<string | null>(null)
  const fileId = file ? `${file.name}-${file.size}-${file.lastModified}` : ""
  useEffect(() => {
    if (!file) {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current)
        prevUrlRef.current = null
      }
      setObjectUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
    prevUrlRef.current = url
    setObjectUrl(url)
    return () => {
      if (prevUrlRef.current === url) {
        URL.revokeObjectURL(url)
        prevUrlRef.current = null
      }
    }
  }, [fileId])
  if (objectUrl) {
    return (
      <img
        src={objectUrl}
        alt="Preview"
        className="block h-full w-full object-cover"
        style={{ minHeight: 140 }}
      />
    )
  }
  return (
    <div className="flex min-h-[140px] flex-col items-center justify-center gap-2 bg-muted/30 text-center text-sm text-muted-foreground" style={{ minHeight: 140 }}>
      <Camera className="h-10 w-10 shrink-0 text-muted-foreground/60" />
      {existingFile?.name ? (
        <span className="font-medium text-foreground">{existingFile.name}</span>
      ) : (
        <span>No image</span>
      )}
    </div>
  )
}

type LocalPhoto = {
  id: string
  category: InstallationPhotoMeta["category"]
  description: string
  file: File | null
  existingFile?: { name: string; type: string; size: number }
}

const PHOTO_CATEGORIES = [
  "panel_placement",
  "wiring",
  "inverter",
  "meter",
  "overall",
] as const

const MATERIAL_NAME_OPTIONS = [
  "Solar Panel 450W",
  "Solar Panel 550W",
  "Inverter 5kW",
  "Inverter 10kW",
  "Mounting Structure",
  "DC Cable",
  "AC Cable",
  "Junction Box",
] as const

function normalizePhotoFromInstallation(
  p: InstallationPhotoMeta | Record<string, unknown>,
  index: number
): LocalPhoto {
  const raw = p as Record<string, unknown>
  const id = typeof raw.id === "string" ? raw.id : `PHOTO-${index + 1}`
  const cat = (raw.category as string) ?? "overall"
  const category: LocalPhoto["category"] = PHOTO_CATEGORIES.includes(cat as any) ? (cat as LocalPhoto["category"]) : "overall"
  const description = typeof raw.description === "string" ? raw.description : ""
  let existingFile: { name: string; type: string; size: number } | undefined
  const fileMeta = raw.file ?? raw.file_meta
  if (fileMeta && typeof fileMeta === "object" && !Array.isArray(fileMeta)) {
    const f = fileMeta as Record<string, unknown>
    const name = typeof f.name === "string" ? f.name : "photo"
    const type = typeof f.type === "string" ? f.type : "image/*"
    const size = typeof f.size === "number" ? f.size : 0
    existingFile = { name, type, size }
  }
  return { id, category, description, file: null, existingFile }
}

export default function EditInstallationPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id ?? null

  const { data: installation, loading, error, refetch } = useInstallation(id)
  const { data: projects = [] } = useProjects()

  const [jobInfo, setJobInfo] = useState({
    projectId: "",
    surveyId: "",
    customerName: "",
    address: "",
    engineerName: "",
    engineerId: "",
  })
  const [selectedSurveyDetail, setSelectedSurveyDetail] = useState<Survey | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [currentMaterial, setCurrentMaterial] = useState({ name: "", serialNumber: "", barcode: "" })
  const [photos, setPhotos] = useState<LocalPhoto[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const selectedProject = useMemo(() => projects.find((p) => p.id === jobInfo.projectId), [projects, jobInfo.projectId])

  const handleProjectChange = (value: string) => {
    const projectId = value === "__none__" ? "" : value
    setJobInfo((prev) => {
      const next = { ...prev, projectId }
      const project = projectId ? projects.find((p) => p.id === projectId) : null
      if (project) next.address = (project.address ?? [project.district, project.city, project.state, project.pincode].filter(Boolean).join(", ")) || prev.address
      return next
    })
  }

  const handleSurveySelect = (survey: Survey | null) => {
    setSelectedSurveyDetail(survey)
    setJobInfo((prev) => {
      const next = { ...prev, surveyId: survey?.id ?? "" }
      if (survey) {
        next.customerName = survey.beneficiaryName
        const addr = survey.siteLocation?.address
          || [survey.siteLocation?.district, survey.siteLocation?.pinCode, survey.siteLocation?.city, survey.siteLocation?.state]
            .filter(Boolean)
            .join(", ")
        next.address = addr || prev.address
      }
      return next
    })
  }

  const photoCategories = useMemo(
    () =>
      [
        { value: "panel_placement", label: "Panel Placement" },
        { value: "wiring", label: "Wiring" },
        { value: "inverter", label: "Inverter" },
        { value: "meter", label: "Meter" },
        { value: "overall", label: "Overall" },
      ] as const,
    [],
  )

  useEffect(() => {
    if (!installation) return
    setJobInfo({
      projectId: installation.projectId ?? "",
      surveyId: installation.surveyId ?? "",
      customerName: installation.customerName ?? "",
      address: installation.address ?? "",
      engineerName: installation.engineerName ?? "",
      engineerId: installation.engineerId ?? "",
    })
    setMaterials((installation.materials ?? []).map((m) => ({ ...m })))
    const rawPhotos = Array.isArray(installation.photos) ? installation.photos : []
    setPhotos(rawPhotos.map((p, i) => normalizePhotoFromInstallation(p as InstallationPhotoMeta, i)))
    if (installation.surveyId) {
      surveysData.getSurveyById(installation.surveyId).then((s) => setSelectedSurveyDetail(s ?? null))
    } else {
      setSelectedSurveyDetail(null)
    }
  }, [installation])

  const handleScanBarcode = () => {
    const mockBarcode = `789${Math.floor(Math.random() * 10000000000)}`
    setCurrentMaterial((prev) => ({ ...prev, barcode: mockBarcode }))
    toast({ title: "Barcode scanned", description: mockBarcode })
  }

  const addMaterial = () => {
    if (!currentMaterial.name.trim() || !currentMaterial.serialNumber.trim()) {
      toast({ title: "Missing material details", description: "Please select material name and enter serial number.", variant: "destructive" })
      return
    }
    setMaterials((prev) => [
      ...prev,
      {
        id: `MAT-${prev.length + 1}`,
        name: currentMaterial.name,
        serialNumber: currentMaterial.serialNumber,
        barcode: currentMaterial.barcode,
      },
    ])
    setCurrentMaterial({ name: "", serialNumber: "", barcode: "" })
    toast({ title: "Material added" })
  }

  const updateMaterial = (id: string, patch: Partial<Material>) => {
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  const removeMaterial = (id: string) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id))
    toast({ title: "Material removed" })
  }

  const addPhoto = () => {
    setPhotos((prev) => [
      ...prev,
      { id: `PHOTO-${prev.length + 1}`, category: "panel_placement", description: "", file: null },
    ])
    toast({ title: "Photo slot added" })
  }

  const updatePhoto = (id: string, patch: Partial<LocalPhoto>) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id))
    toast({ title: "Photo removed" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return

    if (!jobInfo.customerName.trim() || !jobInfo.address.trim()) {
      toast({
        title: "Missing installation details",
        description: "Please fill customer name and address.",
        variant: "destructive",
      })
      return
    }

    if (materials.length === 0) {
      toast({ title: "Missing materials", description: "Please add at least one material.", variant: "destructive" })
      return
    }
    const badMaterial = materials.find((m) => !m.name.trim() || !m.serialNumber.trim())
    if (badMaterial) {
      toast({
        title: "Material incomplete",
        description: "Each material needs name and serial number.",
        variant: "destructive",
      })
      return
    }

    if (photos.length === 0) {
      toast({ title: "Missing photos", description: "Please add at least one installation photo.", variant: "destructive" })
      return
    }

    const input = {
      projectId: jobInfo.projectId.trim() || undefined,
      surveyId: jobInfo.surveyId.trim() || undefined,
      customerName: jobInfo.customerName.trim(),
      address: jobInfo.address.trim(),
      engineerName: jobInfo.engineerName.trim() || undefined,
      engineerId: jobInfo.engineerId.trim() || undefined,
    }
    const payload = {
      materials: materials.map((m) => ({ ...m })),
      photos: photos.map((p) => ({
        id: p.id,
        category: p.category,
        description: p.description,
        file: p.file ? { name: p.file.name, type: p.file.type, size: p.file.size } : p.existingFile,
      })),
    }

    setIsSubmitting(true)
    try {
      await installationsData.updateInstallation(id, input, payload)
      toast({ title: "Installation updated" })
      router.push(`/installations/${id}`)
    } catch (err) {
      toast({
        title: "Could not update installation",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6 sm:p-8">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error || !installation) {
    return (
      <div className="min-h-screen p-6 sm:p-8">
        <p className="text-sm text-muted-foreground">Installation not found.</p>
        <div className="mt-4">
          <Link href="/installations">
            <Button variant="outline">Back</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link href={`/installations/${id}`}>
            <Button variant="ghost" className="text-foreground hover:bg-accent">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Installation
            </Button>
          </Link>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/installations/${id}`)}
            >
              Cancel
            </Button>
            <Button type="submit" form="installation-edit-form" disabled={isSubmitting} className="bg-solar-dark text-white hover:bg-solar-dark/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        <form id="installation-edit-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Header — same as view page */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl text-foreground">Edit Installation</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">ID: {installation?.id ?? id}</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                    installation?.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : installation?.status === "in_progress"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {(installation?.status ?? "pending").replace("_", " ")}
                </span>
              </div>
            </CardHeader>
          </Card>

          {/* Installation Details — same layout as new form */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Installation Details</CardTitle>
              <p className="text-sm text-muted-foreground">Job details (stored as project_id, survey_id, customer_name, address, engineer_name, engineer_id in backend).</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-foreground">Project (optional)</Label>
                  <Select value={jobInfo.projectId || "__none__"} onValueChange={handleProjectChange}>
                    <SelectTrigger className="mt-2 border-solar bg-background">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.projectName} ({p.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProject && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {selectedProject.projectName}
                      {selectedProject.district && ` · ${selectedProject.district}`}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-foreground">Survey (optional) — search & scroll to load more; auto-fills name & address</Label>
                  <div className="mt-2">
                    <SurveySelect
                      value={jobInfo.surveyId}
                      onSelect={handleSurveySelect}
                      selectedSurvey={selectedSurveyDetail}
                      placeholder="Select survey"
                    />
                  </div>
                </div>
              </div>
              {selectedSurveyDetail && (
                <div className="rounded-lg border border-solar bg-muted/40 p-3 text-sm">
                  <p className="font-medium text-foreground">Survey details</p>
                  <p className="mt-1 text-muted-foreground">ID: {selectedSurveyDetail.id} · Service: {selectedSurveyDetail.serviceNo}</p>
                  <p className="text-muted-foreground">Beneficiary: {selectedSurveyDetail.beneficiaryName}</p>
                  {(selectedSurveyDetail.siteLocation?.section || selectedSurveyDetail.siteLocation?.district) && (
                    <p className="text-muted-foreground">
                      Section: {selectedSurveyDetail.siteLocation?.section ?? "—"} · District: {selectedSurveyDetail.siteLocation?.district ?? "—"}
                    </p>
                  )}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="customerName" className="text-foreground">Customer Name *</Label>
                  <Input
                    id="customerName"
                    value={jobInfo.customerName}
                    onChange={(e) => setJobInfo({ ...jobInfo, customerName: e.target.value })}
                    className="mt-2 border-solar bg-background"
                    placeholder="Customer / homeowner"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="address" className="text-foreground">Address *</Label>
                  <Input
                    id="address"
                    value={jobInfo.address}
                    onChange={(e) => setJobInfo({ ...jobInfo, address: e.target.value })}
                    className="mt-2 border-solar bg-background"
                    placeholder="Full installation address"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="engineerName" className="text-foreground">Engineer Name (optional)</Label>
                  <Input
                    id="engineerName"
                    value={jobInfo.engineerName}
                    onChange={(e) => setJobInfo({ ...jobInfo, engineerName: e.target.value })}
                    className="mt-2 border-solar bg-background"
                    placeholder="e.g. Rahul Verma"
                  />
                </div>
                <div>
                  <Label htmlFor="engineerId" className="text-foreground">Engineer ID (optional)</Label>
                  <Input
                    id="engineerId"
                    value={jobInfo.engineerId}
                    onChange={(e) => setJobInfo({ ...jobInfo, engineerId: e.target.value })}
                    className="mt-2 border-solar bg-background"
                    placeholder="e.g. ENG-001"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Materials & Equipment — same as new form: Add Material + Added Materials list */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Materials & Equipment</CardTitle>
              <p className="text-sm text-muted-foreground">Scan barcodes and enter serial numbers for all materials</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 rounded-lg border border-solar bg-solar-beige p-4">
                <h3 className="font-semibold text-foreground">Add Material</h3>
                <div>
                  <Label className="text-foreground">Material Name</Label>
                  <Select
                    value={currentMaterial.name}
                    onValueChange={(v) => setCurrentMaterial({ ...currentMaterial, name: v })}
                  >
                    <SelectTrigger className="mt-2 border-solar bg-background">
                      <SelectValue placeholder="Select material type" />
                    </SelectTrigger>
<SelectContent>
                              <SelectItem value="__none__">— Select type —</SelectItem>
                              {MATERIAL_NAME_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-foreground">Serial Number</Label>
                  <Input
                    value={currentMaterial.serialNumber}
                    onChange={(e) => setCurrentMaterial({ ...currentMaterial, serialNumber: e.target.value })}
                    className="mt-2 border-solar bg-background"
                    placeholder="Enter or scan serial number"
                  />
                </div>
                <div>
                  <Label className="text-foreground">Barcode</Label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={currentMaterial.barcode}
                      onChange={(e) => setCurrentMaterial({ ...currentMaterial, barcode: e.target.value })}
                      className="border-solar bg-background"
                      placeholder="Scan or enter barcode"
                    />
                    <Button type="button" onClick={handleScanBarcode} className="bg-solar-yellow text-foreground hover:bg-solar-yellow/90">
                      <Scan className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button type="button" onClick={addMaterial} className="w-full bg-solar-dark text-white hover:bg-solar-dark/90">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Material
                </Button>
              </div>
              {materials.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground">Added Materials ({materials.length})</h3>
                  {materials.map((m) => (
                    <div key={m.id} className="flex items-center gap-4 rounded-lg border border-solar bg-background p-4">
                      <div className="rounded-lg bg-solar-yellow p-2">
                        <CheckCircle className="h-5 w-5 text-foreground" />
                      </div>
                      <div className="flex-1 grid gap-3 sm:grid-cols-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Material Name</Label>
                          <Select
                            value={m.name || "__none__"}
                            onValueChange={(v) => updateMaterial(m.id, { name: v === "__none__" ? "" : v })}
                          >
                            <SelectTrigger className="mt-1 border-solar bg-background">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Select type —</SelectItem>
                              {MATERIAL_NAME_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                              {m.name && !MATERIAL_NAME_OPTIONS.includes(m.name as any) && (
                                <SelectItem value={m.name}>{m.name}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Serial Number</Label>
                          <Input
                            value={m.serialNumber}
                            onChange={(e) => updateMaterial(m.id, { serialNumber: e.target.value })}
                            className="mt-1 border-solar bg-background"
                            placeholder="S/N"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Barcode</Label>
                          <Input
                            value={m.barcode}
                            onChange={(e) => updateMaterial(m.id, { barcode: e.target.value })}
                            className="mt-1 border-solar bg-background"
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMaterial(m.id)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {materials.length === 0 && <p className="text-sm text-muted-foreground">No materials yet. Use the form above to add.</p>}
            </CardContent>
          </Card>

          {/* Installation Photos — same as new form */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-foreground">Installation Photos</CardTitle>
                  <p className="text-sm text-muted-foreground">Upload photos of installation process and completed work</p>
                </div>
                <Button type="button" onClick={addPhoto} size="sm" className="bg-solar-yellow text-foreground hover:bg-solar-yellow/90">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Photo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {photos.map((p) => (
                <div key={p.id} className="space-y-3 rounded-lg border border-solar bg-solar-beige p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-foreground">Photo</h4>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removePhoto(p.id)} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="h-36 overflow-hidden rounded-lg border border-solar bg-background">
                    <PhotoPreviewCell file={p.file} existingFile={p.existingFile} />
                  </div>
                  <div>
                    <Label className="text-foreground">Category</Label>
                    <Select value={p.category} onValueChange={(v) => updatePhoto(p.id, { category: v as LocalPhoto["category"] })}>
                      <SelectTrigger className="mt-2 border-solar bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {photoCategories.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-foreground">Description</Label>
                    <Input
                      value={p.description}
                      onChange={(e) => updatePhoto(p.id, { description: e.target.value })}
                      className="mt-2 border-solar bg-background"
                      placeholder="Describe what this photo shows"
                    />
                  </div>
                  <div>
                    <Label className="text-foreground">Upload Photo</Label>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        ref={(el) => { fileInputRefs.current[p.id] = el }}
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={async (e) => {
                          const raw = e.target.files?.[0] ?? null
                          const f = raw ? await compressImage(raw) : null
                          updatePhoto(p.id, { file: f })
                          e.target.value = ""
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="border-solar bg-transparent flex-1"
                        onClick={() => fileInputRefs.current[p.id]?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {p.file || p.existingFile ? "Replace" : "Upload"}
                      </Button>
                      <Button type="button" size="icon" className="bg-solar-yellow text-foreground hover:bg-solar-yellow/90">
                        <Camera className="h-4 w-4" />
                      </Button>
                    </div>
                    {(p.file || p.existingFile) && (
                      <p className="mt-1 text-xs text-green-600">
                        {p.file ? `Selected: ${p.file.name}` : `Saved: ${p.existingFile?.name}`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {photos.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-solar bg-solar-beige p-8 text-center">
                  <Camera className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No photos added yet</p>
                  <Button type="button" onClick={addPhoto} className="mt-4 bg-solar-yellow text-foreground hover:bg-solar-yellow/90">
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Photo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit — same style as new form */}
          <div className="rounded-xl border-2 border-green-200 bg-muted/50/80 p-5">
            <p className="mb-4 text-sm font-medium text-green-800">Ready? Save your changes</p>
            <div className="flex flex-wrap gap-4">
              <Button type="button" variant="outline" size="lg" onClick={() => router.push(`/installations/${id}`)}>
                Cancel
              </Button>
              <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-[220px] bg-green-600 py-6 text-base font-semibold text-white shadow-lg hover:bg-green-700 focus-visible:ring-2 focus-visible:ring-green-500">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}

