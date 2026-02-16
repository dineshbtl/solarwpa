"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Plus, Trash2, Camera, Scan, CheckCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import * as installationsData from "@/lib/data/installations"
import type { CreateInstallationInput, Material as StoreMaterial, InstallationPhotoMeta } from "@/lib/store/installations"
import type { Survey } from "@/lib/store/surveys"
import { useProjects } from "@/lib/data/hooks"
import { SurveySelect } from "@/components/survey-select"
import { compressImage } from "@/lib/image-compress"

interface Material {
  id: string
  name: string
  serialNumber: string
  barcode: string
}

interface InstallationPhoto {
  id: string
  file: File | null
  category: string
  description: string
}

export default function NewInstallationPage() {
  const router = useRouter()
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [materials, setMaterials] = useState<Material[]>([])
  const [photos, setPhotos] = useState<InstallationPhoto[]>([])
  const [currentMaterial, setCurrentMaterial] = useState({
    name: "",
    serialNumber: "",
    barcode: "",
  })

  const selectedProject = useMemo(() => projects.find((p) => p.id === jobInfo.projectId), [projects, jobInfo.projectId])

  const handleProjectChange = (value: string) => {
    const id = value === "__none__" ? "" : value
    const project = id ? projects.find((p) => p.id === id) : null
    setJobInfo((prev) => {
      const next = { ...prev, projectId: id }
      if (project) {
        next.address = (project.address ?? [project.district, project.city, project.state, project.pincode].filter(Boolean).join(", ")) || prev.address
      }
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

  const handleScanBarcode = () => {
    // Simulate barcode scan
    const mockBarcode = `789${Math.floor(Math.random() * 10000000000)}`
    setCurrentMaterial({ ...currentMaterial, barcode: mockBarcode })
    toast({
      title: "Barcode scanned",
      description: mockBarcode,
    })
  }

  const handleAddMaterial = () => {
    if (!currentMaterial.name || !currentMaterial.serialNumber) {
      toast({
        title: "Missing material details",
        description: "Please fill in material name and serial number.",
        variant: "destructive",
      })
      return
    }

    setMaterials([
      ...materials,
      {
        id: `MAT-${materials.length + 1}`,
        ...currentMaterial,
      },
    ])

    setCurrentMaterial({ name: "", serialNumber: "", barcode: "" })
    toast({
      title: "Material added",
      description: "Material was added to the list.",
    })
  }

  const handleRemoveMaterial = (id: string) => {
    setMaterials(materials.filter((m) => m.id !== id))
    toast({ title: "Material removed" })
  }

  const handleAddPhoto = () => {
    setPhotos([
      ...photos,
      {
        id: `PHOTO-${photos.length + 1}`,
        file: null,
        category: "panel_placement",
        description: "",
      },
    ])
    toast({ title: "Photo slot added" })
  }

  const handlePhotoUpload = async (id: string, file: File) => {
    const compressed = await compressImage(file)
    setPhotos(photos.map((p) => (p.id === id ? { ...p, file: compressed } : p)))
    toast({ title: "Photo selected", description: compressed.name })
  }

  const handlePhotoChange = (id: string, field: string, value: string) => {
    setPhotos(photos.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  const handleRemovePhoto = (id: string) => {
    setPhotos(photos.filter((p) => p.id !== id))
    toast({ title: "Photo removed" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!jobInfo.customerName.trim() || !jobInfo.address.trim()) {
      toast({
        title: "Missing installation details",
        description: "Please fill customer name and address.",
        variant: "destructive",
      })
      return
    }

    if (materials.length === 0) {
      toast({
        title: "Missing materials",
        description: "Please add at least one material.",
        variant: "destructive",
      })
      return
    }

    if (photos.length === 0) {
      toast({
        title: "Missing photos",
        description: "Please add at least one installation photo.",
        variant: "destructive",
      })
      return
    }

    const input: CreateInstallationInput = {
      projectId: jobInfo.projectId.trim() || undefined,
      surveyId: jobInfo.surveyId.trim() || undefined,
      customerName: jobInfo.customerName.trim(),
      address: jobInfo.address.trim(),
      engineerName: jobInfo.engineerName.trim() || undefined,
      engineerId: jobInfo.engineerId.trim() || undefined,
    }
    const payloadMaterials: StoreMaterial[] = materials.map((m) => ({
      id: m.id,
      name: m.name,
      serialNumber: m.serialNumber,
      barcode: m.barcode || "",
    }))
    const payloadPhotos: InstallationPhotoMeta[] = photos.map((p) => ({
      id: p.id,
      category: (p.category as InstallationPhotoMeta["category"]) || "panel_placement",
      description: p.description,
      file: p.file ? { name: p.file.name, type: p.file.type, size: p.file.size } : undefined,
    }))

    setIsSubmitting(true)
    try {
      const saved = await installationsData.createInstallation(input, {
        materials: payloadMaterials,
        photos: payloadPhotos,
      })
      toast({ title: "Installation recorded", description: `Saved as ${saved.id}.` })
      router.push("/installations")
    } catch (err) {
      toast({
        title: "Could not save installation",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-solar bg-solar-beige/50 px-4 py-3 sm:px-5">
          <Link href="/installations">
            <Button variant="ghost" className="text-solar-dark hover:bg-solar-beige">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Installations
            </Button>
          </Link>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => router.push("/installations")}
              className="border-solar text-solar-dark"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="installation-new-form"
              size="lg"
              disabled={isSubmitting}
              className="min-w-[200px] bg-green-600 text-white shadow-md hover:bg-green-700 focus-visible:ring-2 focus-visible:ring-green-500"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Saving..." : "Complete Installation"}
            </Button>
          </div>
        </div>

        <form id="installation-new-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Installation Details — fields map to backend: projectId, surveyId, customerName, address, engineerName, engineerId */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-solar-dark">Installation Details</CardTitle>
              <p className="text-sm text-muted-foreground">Job details (stored as project_id, survey_id, customer_name, address, engineer_name, engineer_id in backend).</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-solar-dark">Project (optional)</Label>
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
                  <Label className="text-solar-dark">Survey (optional) — search & scroll to load more; auto-fills name & address</Label>
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
                  <p className="font-medium text-solar-dark">Survey details</p>
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
                  <Label htmlFor="customerName" className="text-solar-dark">Customer Name *</Label>
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
                  <Label htmlFor="address" className="text-solar-dark">Address *</Label>
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
                  <Label htmlFor="engineerName" className="text-solar-dark">Engineer Name (optional)</Label>
                  <Input
                    id="engineerName"
                    value={jobInfo.engineerName}
                    onChange={(e) => setJobInfo({ ...jobInfo, engineerName: e.target.value })}
                    className="mt-2 border-solar bg-background"
                    placeholder="e.g. Rahul Verma"
                  />
                </div>
                <div>
                  <Label htmlFor="engineerId" className="text-solar-dark">Engineer ID (optional)</Label>
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

          {/* Materials Section */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-solar-dark">Materials & Equipment</CardTitle>
              <p className="text-sm text-muted-foreground">Scan barcodes and enter serial numbers for all materials</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Material Form */}
              <div className="space-y-4 rounded-lg border border-solar bg-solar-beige p-4">
                <h3 className="font-semibold text-solar-dark">Add Material</h3>

                <div>
                  <Label htmlFor="materialName" className="text-solar-dark">
                    Material Name
                  </Label>
                  <Select
                    value={currentMaterial.name}
                    onValueChange={(v) => setCurrentMaterial({ ...currentMaterial, name: v })}
                  >
                    <SelectTrigger className="mt-2 border-solar bg-background">
                      <SelectValue placeholder="Select material type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Solar Panel 450W">Solar Panel 450W</SelectItem>
                      <SelectItem value="Solar Panel 550W">Solar Panel 550W</SelectItem>
                      <SelectItem value="Inverter 5kW">Inverter 5kW</SelectItem>
                      <SelectItem value="Inverter 10kW">Inverter 10kW</SelectItem>
                      <SelectItem value="Mounting Structure">Mounting Structure</SelectItem>
                      <SelectItem value="DC Cable">DC Cable</SelectItem>
                      <SelectItem value="AC Cable">AC Cable</SelectItem>
                      <SelectItem value="Junction Box">Junction Box</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="serialNumber" className="text-solar-dark">
                    Serial Number
                  </Label>
                  <Input
                    id="serialNumber"
                    value={currentMaterial.serialNumber}
                    onChange={(e) => setCurrentMaterial({ ...currentMaterial, serialNumber: e.target.value })}
                    className="mt-2 border-solar bg-background"
                    placeholder="Enter or scan serial number"
                  />
                </div>

                <div>
                  <Label htmlFor="barcode" className="text-solar-dark">
                    Barcode
                  </Label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      id="barcode"
                      value={currentMaterial.barcode}
                      onChange={(e) => setCurrentMaterial({ ...currentMaterial, barcode: e.target.value })}
                      className="border-solar bg-background"
                      placeholder="Scan or enter barcode"
                    />
                    <Button
                      type="button"
                      onClick={handleScanBarcode}
                      className="bg-solar-yellow text-solar-dark hover:bg-solar-yellow/90"
                    >
                      <Scan className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleAddMaterial}
                  className="w-full bg-solar-dark text-white hover:bg-solar-dark/90"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Material
                </Button>
              </div>

              {/* Materials List */}
              {materials.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-solar-dark">Added Materials ({materials.length})</h3>
                  {materials.map((material) => (
                    <div
                      key={material.id}
                      className="flex items-center gap-4 rounded-lg border border-solar bg-background p-4"
                    >
                      <div className="rounded-lg bg-solar-yellow p-2">
                        <CheckCircle className="h-5 w-5 text-solar-dark" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-solar-dark">{material.name}</h4>
                        <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                          <span>S/N: {material.serialNumber}</span>
                          {material.barcode && <span>Barcode: {material.barcode}</span>}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMaterial(material.id)}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Installation Photos */}
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-solar-dark">Installation Photos</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Upload photos of installation process and completed work
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleAddPhoto}
                  size="sm"
                  className="bg-solar-yellow text-solar-dark hover:bg-solar-yellow/90"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Photo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {photos.map((photo) => (
                <div key={photo.id} className="space-y-3 rounded-lg border border-solar bg-solar-beige p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-solar-dark">Photo {photo.id}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div>
                    <Label className="text-solar-dark">Category</Label>
                    <Select value={photo.category} onValueChange={(v) => handlePhotoChange(photo.id, "category", v)}>
                      <SelectTrigger className="mt-2 border-solar bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="panel_placement">Panel Placement</SelectItem>
                        <SelectItem value="wiring">Wiring</SelectItem>
                        <SelectItem value="inverter">Inverter Installation</SelectItem>
                        <SelectItem value="meter">Meter Connection</SelectItem>
                        <SelectItem value="overall">Overall View</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-solar-dark">Description</Label>
                    <Input
                      value={photo.description}
                      onChange={(e) => handlePhotoChange(photo.id, "description", e.target.value)}
                      className="mt-2 border-solar bg-background"
                      placeholder="Describe what this photo shows"
                    />
                  </div>

                  <div>
                    <Label className="text-solar-dark">Upload Photo</Label>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files && handlePhotoUpload(photo.id, e.target.files[0])}
                        className="border-solar bg-background"
                      />
                      <Button
                        type="button"
                        size="icon"
                        className="bg-solar-yellow text-solar-dark hover:bg-solar-yellow/90"
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                    </div>
                    {photo.file && <p className="mt-1 text-xs text-green-600">File selected: {photo.file.name}</p>}
                  </div>
                </div>
              ))}

              {photos.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-solar bg-solar-beige p-8 text-center">
                  <Camera className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No photos added yet</p>
                  <Button
                    type="button"
                    onClick={handleAddPhoto}
                    className="mt-4 bg-solar-yellow text-solar-dark hover:bg-solar-yellow/90"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Photo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit at bottom */}
          <div className="rounded-xl border-2 border-green-200 bg-green-50/80 p-5">
            <p className="mb-4 text-sm font-medium text-green-800">Ready? Submit your installation</p>
            <div className="flex flex-wrap gap-4">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => router.push("/installations")}
                className="border-solar text-solar-dark"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="min-w-[220px] bg-green-600 py-6 text-base font-semibold text-white shadow-lg hover:bg-green-700 focus-visible:ring-2 focus-visible:ring-green-500"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Saving..." : "Complete Installation"}
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}
