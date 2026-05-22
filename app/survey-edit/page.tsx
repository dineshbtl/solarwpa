"use client"

import type React from "react"

import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Camera, MapPin, Save, FileImage, Loader2 } from "lucide-react"
import { useFormDraft } from "@/lib/store/use-form-draft"
import { DraftBanner } from "@/components/draft-banner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "@/hooks/use-toast"
import { CreateSurveySchema, type CreateSurveyInput, type FileMeta, type Survey, type SurveyUploadKeys } from "@/lib/store/surveys"
import * as surveysData from "@/lib/data/surveys"
import { useSurvey, useProjects, useUsers } from "@/lib/data/hooks"
import { useRole } from "@/contexts/role-context"
import { Skeleton } from "@/components/ui/skeleton"
import { siteLocationOptions } from "@/lib/data/site-location-options"
import { LocationAutocomplete } from "@/components/location-autocomplete"
import { getCurrentLocation as getGeoLocation } from "@/lib/geolocation"
import { preparePhotoWithGpsStamp } from "@/lib/photo-gps-stamp"
import { stampOptionsFromSurveySiteDetails } from "@/lib/survey-photo-stamp"

type UploadState = Partial<Record<SurveyUploadKeys, File>>

function toMeta(file: File): FileMeta {
  return { name: file.name, type: file.type, size: file.size }
}

function getSubmitErrorMessage(e: unknown): string {
  const msg = typeof e === "object" && e !== null && "message" in e && typeof (e as { message: unknown }).message === "string"
    ? (e as { message: string }).message
    : e instanceof Error
      ? e.message
      : ""
  if (msg && /body exceeded.*limit/i.test(msg))
    return "Upload is too large. Try reducing image sizes or uploading fewer files at once."
  if (msg && /fetch failed|Failed to fetch|timeout|ConnectTimeout|ECONNREFUSED|network|UND_ERR_CONNECT|Load failed/i.test(msg))
    return "Could not reach the server. Check your connection and try again."
  return msg || "Please try again."
}

function ImagePreview({ file, className }: { file: File; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const fileKey = file ? `${file.name}-${file.size}-${file.lastModified}` : ""
  useEffect(() => {
    if (!file?.type.startsWith("image/")) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(file)
    setUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return u
    })
    return () => URL.revokeObjectURL(u)
  }, [fileKey])
  if (!url) return null
  return <img src={url} alt="Preview" className={className} />
}

function EditSurveyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams?.get("id") ?? null

  const { data: survey, loading, error, refetch } = useSurvey(id)

  const [uploads, setUploads] = useState<UploadState>({})
  const [existingUploads, setExistingUploads] = useState<Partial<Record<SurveyUploadKeys, FileMeta>>>({})
  const [siteDetails, setSiteDetails] = useState<{
    gpsLat?: string
    gpsLng?: string
    accuracyMeters?: number
    capturedAt?: string
    meterAcCableMeters?: number
    meterDcCableMeters?: number
    slabThicknessInches?: number
    roofOwnership?: "Self" | "Joint" | "Rented"
    ownerConsentAvailable?: "Yes" | "No"
    availableRoofAreaSqm?: number
    shadowFreeAreaAvailable?: "Yes" | "No"
    roofOrientation?: "South" | "East-West" | "Other"
    roofCondition?: "Good" | "Average" | "Poor"
    shadingObjects?: string
    shadingDuration?: "Nil" | "<1 hr" | "1–2 hrs" | ">2 hrs"
    distanceRoofToMeterM?: number
    inverterSpaceAvailable?: "Yes" | "No"
    existingEarthing?: "Yes" | "No"
    earthPitsFeasibility?: "Yes" | "No"
    cableRoutingFeasible?: "Yes" | "No"
    uscNo?: string
    dtrCapacity?: string | number
    ageOfBuildingYears?: number
    documentsCollected?: { electricityBill?: boolean; aadhaar?: boolean; bankDetails?: boolean; rooftopPhotos?: boolean; meterPhoto?: boolean }
    recommendedSystemSizeKw?: number | string
    overallFeasibility?: "Feasible" | "Not Feasible"
    notFeasibleReason?: "Insufficient Space" | "Shading" | "Structural Issue" | "Consumer Not Willing"
  }>({})
  const [isCapturingLocation, setIsCapturingLocation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { currentUser } = useRole()
  const { data: projects = [], loading: projectsLoading, error: projectsError } = useProjects()
  const { data: users = [] } = useUsers()
  const getUserById = useCallback(
    (uid: string | undefined) => (uid ? users.find((u) => u.id === uid) : undefined),
    [users]
  )

  const locationCaptured = Boolean(siteDetails.gpsLat && siteDetails.gpsLng)

  const form = useForm<CreateSurveyInput>({
    resolver: zodResolver(CreateSurveySchema),
    defaultValues: {
      beneficiaryName: "",
      serviceNo: "",
      aadharNo: "",
      mobile: "",
      panNo: "",
      contractedLoad: undefined,
      discomName: "APSPDCL",
      plantType: "On Grid",
      buildingHeight: undefined,
      totalRoofs: "G",
      roofType: "RCC",
      siteLocation: {
        section: "",
        subDivision: "",
        division: "",
        circle: "",
        address: "",
        mandal: "",
        village: "",
        district: "",
        pinCode: "",
        state: "",
        city: "",
        latitude: "",
        longitude: "",
        electricityConsumerNo: "",
        connectionType: undefined,
        phase: undefined,
        sanctionedLoadKw: undefined,
        avgMonthlyBillRupees: undefined,
      },
      bankDetails: {
        bankName: "",
        accountNo: "",
        ifsc: "",
        branch: "",
      },
    },
    mode: "onTouched",
  })

  // Draft persistence — keyed per-survey-id so each row has its own pending changes.
  // Writes stay disabled until after the server data has hydrated AND the user has either
  // restored the existing draft or discarded it; otherwise the pristine server values would
  // immediately overwrite a useful draft on mount.
  const watchedValues = form.watch()
  const draftPayload = useMemo(
    () => ({ values: watchedValues, siteDetails }),
    [watchedValues, siteDetails],
  )
  const [draftEnabled, setDraftEnabled] = useState(false)
  const surveyDraft = useFormDraft<{ values: CreateSurveyInput; siteDetails: typeof siteDetails }>(
    id ? `surveys.edit.${id}` : "surveys.edit.__unknown__",
    draftPayload,
    { enabled: draftEnabled && !!id },
  )
  const [draftBannerOpen, setDraftBannerOpen] = useState(false)
  const [draftBannerSavedAt, setDraftBannerSavedAt] = useState<string | null>(null)
  // Tracks the survey id we have already hydrated the form from. Without this guard the
  // hydration effect re-fires on every render (because the draft hook returns a new object
  // reference whenever its internal savedAt state updates), which would call form.reset() in
  // a loop and crash the page with "Maximum update depth exceeded".
  const hydratedForIdRef = useRef<string | null>(null)

  const handleRestoreDraft = () => {
    const d = surveyDraft.restore()
    if (d?.values) form.reset(d.values)
    if (d?.siteDetails) setSiteDetails(d.siteDetails)
    setDraftBannerOpen(false)
    setDraftEnabled(true)
    toast({ title: "Draft restored", description: "Re-attach any photos before saving." })
  }

  const handleDiscardDraft = () => {
    surveyDraft.clear()
    setDraftBannerOpen(false)
    setDraftEnabled(true)
  }

  useEffect(() => {
    if (!survey) return
    if (hydratedForIdRef.current === survey.id) return
    hydratedForIdRef.current = survey.id
    setSiteDetails({ ...(survey.siteDetails ?? {}) })
    setExistingUploads(survey.uploads ?? {})
    const sl = survey.siteLocation
    form.reset({
      beneficiaryName: survey.beneficiaryName ?? "",
      serviceNo: survey.serviceNo ?? "",
      aadharNo: survey.aadharNo ?? "",
      mobile: survey.mobile ?? "",
      panNo: survey.panNo ?? "",
      contractedLoad: survey.contractedLoad ?? undefined,
      discomName: survey.discomName ?? "APSPDCL",
      plantType: survey.plantType ?? "On Grid",
      buildingHeight: survey.buildingHeight ?? undefined,
      totalRoofs: survey.totalRoofs ?? "G",
      roofType: survey.roofType ?? "RCC",
      siteLocation: {
        section: sl?.section ?? "",
        subDivision: sl?.subDivision ?? "",
        division: sl?.division ?? "",
        circle: sl?.circle ?? "",
        address: sl?.address ?? "",
        mandal: sl?.mandal ?? "",
        village: sl?.village ?? "",
        district: sl?.district ?? "",
        pinCode: sl?.pinCode ?? "",
        state: sl?.state ?? "",
        city: sl?.city ?? "",
        latitude: sl?.latitude ?? "",
        longitude: sl?.longitude ?? "",
        electricityConsumerNo: sl?.electricityConsumerNo ?? "",
        connectionType: sl?.connectionType ?? undefined,
        phase: sl?.phase ?? undefined,
        sanctionedLoadKw: sl?.sanctionedLoadKw ?? undefined,
        avgMonthlyBillRupees: sl?.avgMonthlyBillRupees ?? undefined,
      },
      bankDetails: {
        bankName: survey.bankDetails?.bankName ?? "",
        accountNo: survey.bankDetails?.accountNo ?? "",
        ifsc: survey.bankDetails?.ifsc ?? "",
        branch: survey.bankDetails?.branch ?? "",
      },
    })
    if (surveyDraft.hasDraft()) {
      setDraftBannerSavedAt(surveyDraft.peekSavedAt())
      setDraftBannerOpen(true)
    } else {
      setDraftEnabled(true)
    }
    // surveyDraft is intentionally omitted — its identity changes on every debounced write
    // and we only want to hydrate once per survey id (guarded above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey, form])

  const uploadLabels: Record<SurveyUploadKeys, string> = useMemo(
    () => ({
      aadhaarCard: "Aadhar Card Upload",
      panCard: "PAN Upload",
      bankProof: "Cancelled Cheque / Pass Book Photo",
      eBill: "E-Bill Photo",
      beneficiaryPhoto: "Beneficiary Photo with Site Location (GPRS Cam)",
      siteLayout: "Site Layout (Draw and Upload)",
      roofTerraceNorth: "Rooftop terrace (from north location)",
      roofTerraceSouth: "Rooftop terrace (from south location)",
      earthingAreaPic: "Earthing Area pic",
      inverterAreaPic: "Inverter area (pic upload)",
    }),
    [],
  )

  const setUpload = (key: SurveyUploadKeys, file?: File) => {
    setUploads((prev) => {
      const next = { ...prev }
      if (!file) {
        delete next[key]
      } else {
        next[key] = file
      }
      return next
    })
  }

  const removeExistingUpload = (key: SurveyUploadKeys) => {
    setExistingUploads((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setUpload(key, undefined)
  }

  const handleProjectSelectForLocation = (projectId: string) => {
    if (!projectId || projectId === "__none__") return
    const project = projects.find((p) => p.id === projectId)
    if (!project) return
    form.setValue("siteLocation.district", project.district ?? "")
    form.setValue("siteLocation.pinCode", project.pincode ?? "")
    form.setValue("siteLocation.state", project.state ?? "")
    form.setValue("siteLocation.city", project.city ?? "")
    form.setValue("siteLocation.address", project.address ?? "")
    toast({ title: "Site location filled", description: `From project: ${project.projectName}` })
  }

  const handleCaptureLocation = async () => {
    setIsCapturingLocation(true)
    try {
      const result = await getGeoLocation()
      setSiteDetails((prev) => ({
        ...prev,
        gpsLat: result.lat,
        gpsLng: result.lng,
        accuracyMeters: result.accuracyMeters,
        capturedAt: new Date().toISOString(),
      }))
      toast({
        title: "Location captured",
        description: result.source === "gps" ? "GPS coordinates were filled in successfully." : "Approximate location from IP (use HTTPS for precise GPS).",
      })
    } catch {
      toast({
        title: "Unable to get location",
        description: "Please enter GPS coordinates manually.",
        variant: "destructive",
      })
    } finally {
      setIsCapturingLocation(false)
    }
  }

  const handleFileSelect = async (k: SurveyUploadKeys, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f && !f.type.startsWith("image/")) {
      toast({
        title: "Please select an image",
        description: "Only image files (e.g. JPEG, PNG) are allowed.",
        variant: "destructive",
      })
      e.target.value = ""
      return
    }
    if (f) {
      try {
        const prepared = await preparePhotoWithGpsStamp(f, stampOptionsFromSurveySiteDetails(siteDetails))
        setUpload(k, prepared.file)
      } catch {
        toast({
          title: "Could not process image",
          description: "Try another photo or a smaller file. If this keeps happening, capture site location first.",
          variant: "destructive",
        })
      }
    } else {
      setUpload(k, undefined)
    }
    e.target.value = ""
  }

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const UploadRow = ({
    k,
    disabled,
    helper,
  }: {
    k: SurveyUploadKeys
    disabled?: boolean
    helper?: string
  }) => {
    const file = uploads[k]
    const stored = existingUploads[k]
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between rounded-lg border border-solar bg-background p-4">
        <div className="min-w-0 flex-1">
          {file && file.type.startsWith("image/") && (
            <ImagePreview file={file} className="mb-3 h-24 max-w-[200px] rounded-lg border border-solar object-cover" />
          )}
          <p className="text-sm font-medium text-foreground">{uploadLabels[k]}</p>
          {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
          {file ? (
            <p className="mt-2 text-xs text-green-700">
              Selected: <span className="font-medium">{file.name}</span>
            </p>
          ) : stored ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Saved: <span className="font-medium">{stored.name}</span> ({Math.round(stored.size / 1024)} KB)
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No file selected</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Camera/Gallery: allows both camera capture and selecting existing images */}
          <label
            htmlFor={disabled ? undefined : `edit_camera_${k}`}
            className={`inline-flex items-center justify-center gap-2 rounded-md border border-solar bg-background px-4 py-2 text-sm font-medium cursor-pointer hover:bg-accent hover:text-accent-foreground ${disabled ? "opacity-50 pointer-events-none" : ""}`}
          >
            <Camera className="h-4 w-4" />
            Camera / Gallery
            <input
              id={`edit_camera_${k}`}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={disabled}
              onChange={(e) => handleFileSelect(k, e)}
            />
          </label>
          {(file || stored) && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => removeExistingUpload(k)}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
    )
  }

  const onSubmit = async (values: CreateSurveyInput) => {
    if (!id) return
    setIsSubmitting(true)
    try {
      const mergedMeta: Partial<Record<SurveyUploadKeys, FileMeta>> = { ...(existingUploads ?? {}) }
      ;(Object.keys(uploads) as SurveyUploadKeys[]).forEach((k) => {
        const f = uploads[k]
        if (f) mergedMeta[k] = toMeta(f)
      })

      // Enforce GPRS Cam flow for a newly selected beneficiary photo only (not legacy rows in mergedMeta).
      if (uploads.beneficiaryPhoto && !locationCaptured) {
        toast({
          title: "Capture location first",
          description: "Please capture site location before uploading beneficiary photo.",
          variant: "destructive",
        })
        return
      }

      await surveysData.updateSurvey(id, values, mergedMeta, siteDetails, currentUser?.id ?? undefined, uploads)
      surveyDraft.clear()
      toast({ title: "Survey updated" })
      router.push(`/survey-details?id=${id}`)
    } catch (e) {
      toast({
        title: "Could not update survey",
        description: getSubmitErrorMessage(e),
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (error || !survey) {
    return (
      <div className="min-h-screen p-6 sm:p-8">
        <p className="text-sm text-muted-foreground">Survey not found.</p>
        <div className="mt-4">
          <Link href="/surveys">
            <Button variant="outline">Back</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href={`/surveys/${id}`}>
          <Button variant="outline" className="mb-6 border-gray-300 bg-white text-muted-foreground800 hover:bg-muted hover:border-gray-400">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Survey
          </Button>
        </Link>

        {draftBannerOpen ? (
          <div className="mb-4">
            <DraftBanner
              savedAt={draftBannerSavedAt}
              onRestore={handleRestoreDraft}
              onDiscard={handleDiscardDraft}
            />
          </div>
        ) : null}

        <div className="rounded-2xl bg-white shadow-xl border border-border p-4 sm:p-6">
        {/* Header — same as detail page */}
        <Card className="mb-6 border-solar bg-solar-card shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl text-foreground">{survey.beneficiaryName}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Survey ID: {survey.id}</p>
              </div>
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
            </div>
          </CardHeader>
        </Card>

        <Form {...form}>
          <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(onSubmit)(); }} className="space-y-6">
            {/* 1. Beneficiary Details — same section as detail page */}
            <Card className="border-solar bg-solar-card shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">Beneficiary Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <p className="text-sm font-medium text-foreground">Surveyor (submitted by)</p>
                    <p className="text-sm text-foreground">{currentUser?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">The logged-in user is recorded as the submitter when you save.</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <FormField
                      control={form.control}
                      name="beneficiaryName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name of the Beneficiary</FormLabel>
                          <FormControl>
                            <Input className="border-solar" placeholder="Full name" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="serviceNo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service No</FormLabel>
                          <FormControl>
                            <Input
                              className="border-solar"
                              placeholder="Service number"
                              {...field}
                              value={field.value ?? ""}
                              onBlur={async () => {
                                field.onBlur()
                                const v = form.getValues("serviceNo")?.trim()
                                if (!v) return
                                const duplicate = await surveysData.isSurveyServiceNoTaken(v, id)
                                if (duplicate) {
                                  form.setError("serviceNo", {
                                    message: "Service number is already used by another survey.",
                                  })
                                  form.setFocus("aadharNo")
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <FormField
                      control={form.control}
                      name="aadharNo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Aadhar No</FormLabel>
                          <FormControl>
                            <Input className="border-solar" inputMode="numeric" placeholder="12-digit Aadhar" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="panNo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PAN No (Optional)</FormLabel>
                          <FormControl>
                            <Input className="border-solar" placeholder="ABCDE1234F" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <FormField
                      control={form.control}
                      name="mobile"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mobile</FormLabel>
                          <FormControl>
                            <Input className="border-solar" inputMode="numeric" placeholder="10-digit mobile" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contractedLoad"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contracted Load</FormLabel>
                          <FormControl>
                            <Input className="border-solar" type="number" inputMode="decimal" placeholder="e.g. 3" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Site location fields */}
              <Card className="border-solar bg-solar-card shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">Site Location</CardTitle>
                  <p className="text-sm text-muted-foreground">Optional: select a project to fill district, pin code, state, city and address.</p>
                  {projectsLoading ? <p className="text-xs text-muted-foreground">Loading project options...</p> : null}
                  {projectsError ? <p className="text-xs text-destructive">Project options failed to load.</p> : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-foreground">Fill from project (optional)</label>
                    <Select value="__none__" onValueChange={handleProjectSelectForLocation}>
                      <SelectTrigger className="border-solar bg-background max-w-sm">
                        <SelectValue placeholder="Select project to fill site location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— None —</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.projectName} {p.district ? `(${p.district})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <FormField
                      control={form.control}
                      name="siteLocation.section"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Section</FormLabel>
                          <FormControl>
                            <LocationAutocomplete
                              options={siteLocationOptions.sections}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              placeholder="Search section..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="siteLocation.subDivision"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sub Division</FormLabel>
                          <FormControl>
                            <LocationAutocomplete
                              options={siteLocationOptions.subDivisions}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              placeholder="Search sub division..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <FormField
                      control={form.control}
                      name="siteLocation.division"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Division</FormLabel>
                          <FormControl>
                            <LocationAutocomplete
                              options={siteLocationOptions.divisions}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              placeholder="Search division..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="siteLocation.circle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Circle</FormLabel>
                          <FormControl>
                            <LocationAutocomplete
                              options={siteLocationOptions.circles}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              placeholder="Search circle..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <FormField
                      control={form.control}
                      name="siteLocation.mandal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mandal</FormLabel>
                          <FormControl>
                            <LocationAutocomplete
                              options={siteLocationOptions.mandals}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              placeholder="Search mandal..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="siteLocation.district"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>District</FormLabel>
                          <FormControl>
                            <LocationAutocomplete
                              options={siteLocationOptions.districts}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              placeholder="Search district..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <FormField
                      control={form.control}
                      name="siteLocation.pinCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pin Code</FormLabel>
                          <FormControl>
                            <Input
                              className="border-solar"
                              placeholder="Enter pin code"
                              inputMode="numeric"
                              autoComplete="off"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="siteLocation.city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <LocationAutocomplete
                              options={siteLocationOptions.cities}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              placeholder="Search city..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="siteLocation.state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <LocationAutocomplete
                            options={siteLocationOptions.states}
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            placeholder="Search state..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="siteLocation.address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address of the Location</FormLabel>
                        <FormControl>
                          <Textarea className="border-solar" rows={3} {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <FormField
                      control={form.control}
                      name="siteLocation.village"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Village</FormLabel>
                          <FormControl>
                            <Input className="border-solar" placeholder="Village" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="siteLocation.electricityConsumerNo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Electricity Consumer No.</FormLabel>
                          <FormControl>
                            <Input className="border-solar" placeholder="Consumer number" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end">
                    <FormField
                      control={form.control}
                      name="siteLocation.connectionType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Connection Type</FormLabel>
                          <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v === "" ? undefined : v)}>
                            <FormControl>
                              <SelectTrigger className="border-solar bg-background">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Domestic">Domestic</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="siteLocation.phase"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phase</FormLabel>
                          <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v === "" ? undefined : v)}>
                            <FormControl>
                              <SelectTrigger className="border-solar bg-background">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="3">3</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="siteLocation.sanctionedLoadKw"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sanctioned Load (kW)</FormLabel>
                          <FormControl>
                            <Input className="border-solar" type="number" inputMode="decimal" placeholder="e.g. 3" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="siteLocation.avgMonthlyBillRupees"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Avg. Monthly Bill (₹)</FormLabel>
                          <FormControl>
                            <Input className="border-solar" type="number" inputMode="decimal" placeholder="e.g. 500" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Rooftop Ownership & Consent */}
              <Card className="border-solar bg-solar-card shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">Rooftop Ownership &amp; Consent</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Roof Ownership</label>
                      <Select value={siteDetails.roofOwnership ?? ""} onValueChange={(v) => setSiteDetails((p) => ({ ...p, roofOwnership: v === "" ? undefined : (v as "Self" | "Joint" | "Rented") }))}>
                        <SelectTrigger className="border-solar bg-background">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Self">Self</SelectItem>
                          <SelectItem value="Joint">Joint</SelectItem>
                          <SelectItem value="Rented">Rented</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Owner Consent Available (if applicable)</label>
                      <Select value={siteDetails.ownerConsentAvailable ?? ""} onValueChange={(v) => setSiteDetails((p) => ({ ...p, ownerConsentAvailable: v === "" ? undefined : (v as "Yes" | "No") }))}>
                        <SelectTrigger className="border-solar bg-background">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Plant & roof details */}
              <Card className="border-solar bg-solar-card shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">Plant & Roof Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <FormField
                      control={form.control}
                      name="plantType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type of Solar Power Plant</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="border-solar bg-background">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="On Grid">On Grid</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="buildingHeight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Building Height</FormLabel>
                          <FormControl>
                            <Input className="border-solar" type="number" inputMode="decimal" placeholder="e.g. 10" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <FormField
                      control={form.control}
                      name="totalRoofs"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total No of Roofs</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="border-solar bg-background">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="G">G</SelectItem>
                              <SelectItem value="G+1">G+1</SelectItem>
                              <SelectItem value="G+2">G+2</SelectItem>
                              <SelectItem value="G+3">G+3</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="roofType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type of Roof</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="border-solar bg-background">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="RCC">RCC</SelectItem>
                              <SelectItem value="Metal Shed">Metal Shed</SelectItem>
                              <SelectItem value="Cement Shed">Cement Shed</SelectItem>
                              <SelectItem value="Ground Mount">Ground Mount</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="discomName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DISCOM Name</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="border-solar bg-background">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="APSPDCL">APSPDCL</SelectItem>
                            <SelectItem value="APCPDCL">APCPDCL</SelectItem>
                            <SelectItem value="APEPDCL">APEPDCL</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Meter AC Cable (m)</label>
                      <Input
                        className="border-solar bg-background"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.1}
                        placeholder="e.g. 10"
                        value={siteDetails.meterAcCableMeters ?? ""}
                        onChange={(e) => {
                          const v = e.target.value
                          setSiteDetails((prev) => ({ ...prev, meterAcCableMeters: v === "" ? undefined : Number(v) }))
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Meter DC Cable (m)</label>
                      <Input
                        className="border-solar bg-background"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.1}
                        placeholder="e.g. 15"
                        value={siteDetails.meterDcCableMeters ?? ""}
                        onChange={(e) => {
                          const v = e.target.value
                          setSiteDetails((prev) => ({ ...prev, meterDcCableMeters: v === "" ? undefined : Number(v) }))
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Slab thickness (inches)</label>
                    <Input
                      className="border-solar bg-background max-w-xs"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.1}
                      placeholder="e.g. 4"
                      value={siteDetails.slabThicknessInches ?? ""}
                      onChange={(e) => {
                        const v = e.target.value
                        setSiteDetails((prev) => ({ ...prev, slabThicknessInches: v === "" ? undefined : Number(v) }))
                      }}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Available Roof Area (approx.) sq.m</label>
                      <Input
                        className="border-solar bg-background"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        placeholder="e.g. 50"
                        value={siteDetails.availableRoofAreaSqm ?? ""}
                        onChange={(e) => setSiteDetails((p) => ({ ...p, availableRoofAreaSqm: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Shadow-free area available</label>
                      <Select value={siteDetails.shadowFreeAreaAvailable ?? ""} onValueChange={(v) => setSiteDetails((p) => ({ ...p, shadowFreeAreaAvailable: v === "" ? undefined : (v as "Yes" | "No") }))}>
                        <SelectTrigger className="border-solar bg-background">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Roof Orientation</label>
                      <Select value={siteDetails.roofOrientation ?? ""} onValueChange={(v) => setSiteDetails((p) => ({ ...p, roofOrientation: v === "" ? undefined : (v as "South" | "East-West" | "Other") }))}>
                        <SelectTrigger className="border-solar bg-background">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="South">South</SelectItem>
                          <SelectItem value="East-West">East-West</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Roof Condition</label>
                      <Select value={siteDetails.roofCondition ?? ""} onValueChange={(v) => setSiteDetails((p) => ({ ...p, roofCondition: v === "" ? undefined : (v as "Good" | "Average" | "Poor") }))}>
                        <SelectTrigger className="border-solar bg-background">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Good">Good</SelectItem>
                          <SelectItem value="Average">Average</SelectItem>
                          <SelectItem value="Poor">Poor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Shading & Obstructions */}
              <Card className="border-solar bg-solar-card shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">Shading &amp; Obstructions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Nearby shading objects</label>
                      <Input
                        className="border-solar bg-background"
                        placeholder="e.g. Trees, Water Tank, None"
                        value={siteDetails.shadingObjects ?? ""}
                        onChange={(e) => setSiteDetails((p) => ({ ...p, shadingObjects: e.target.value || undefined }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Shading Duration</label>
                      <Select value={siteDetails.shadingDuration ?? ""} onValueChange={(v) => setSiteDetails((p) => ({ ...p, shadingDuration: v === "" ? undefined : (v as "Nil" | "<1 hr" | "1–2 hrs" | ">2 hrs") }))}>
                        <SelectTrigger className="border-solar bg-background">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Nil">Nil</SelectItem>
                          <SelectItem value="<1 hr">&lt;1 hr</SelectItem>
                          <SelectItem value="1–2 hrs">1–2 hrs</SelectItem>
                          <SelectItem value=">2 hrs">&gt;2 hrs</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Electrical Feasibility */}
              <Card className="border-solar bg-solar-card shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">Electrical Feasibility</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Distance Roof to Meter (m)</label>
                      <Input
                        className="border-solar bg-background"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        placeholder="e.g. 10"
                        value={siteDetails.distanceRoofToMeterM ?? ""}
                        onChange={(e) => setSiteDetails((p) => ({ ...p, distanceRoofToMeterM: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Inverter installation space available</label>
                      <Select value={siteDetails.inverterSpaceAvailable ?? ""} onValueChange={(v) => setSiteDetails((p) => ({ ...p, inverterSpaceAvailable: v === "" ? undefined : (v as "Yes" | "No") }))}>
                        <SelectTrigger className="border-solar bg-background">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Existing Earthing</label>
                      <Select value={siteDetails.existingEarthing ?? ""} onValueChange={(v) => setSiteDetails((p) => ({ ...p, existingEarthing: v === "" ? undefined : (v as "Yes" | "No") }))}>
                        <SelectTrigger className="border-solar bg-background">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Earth Pits Feasibility</label>
                      <Select value={siteDetails.earthPitsFeasibility ?? ""} onValueChange={(v) => setSiteDetails((p) => ({ ...p, earthPitsFeasibility: v === "" ? undefined : (v as "Yes" | "No") }))}>
                        <SelectTrigger className="border-solar bg-background">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Cable routing feasible</label>
                      <Select value={siteDetails.cableRoutingFeasible ?? ""} onValueChange={(v) => setSiteDetails((p) => ({ ...p, cableRoutingFeasible: v === "" ? undefined : (v as "Yes" | "No") }))}>
                        <SelectTrigger className="border-solar bg-background">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">USC No</label>
                      <Input className="border-solar bg-background" placeholder="USC number" value={siteDetails.uscNo ?? ""} onChange={(e) => setSiteDetails((p) => ({ ...p, uscNo: e.target.value || undefined }))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">DTR Capacity</label>
                      <Input className="border-solar bg-background" placeholder="e.g. 100" value={siteDetails.dtrCapacity ?? ""} onChange={(e) => setSiteDetails((p) => ({ ...p, dtrCapacity: e.target.value || undefined }))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Age of the Building</label>
                      <Input
                        className="border-solar bg-background"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="years"
                        value={siteDetails.ageOfBuildingYears ?? ""}
                        onChange={(e) => setSiteDetails((p) => ({ ...p, ageOfBuildingYears: e.target.value === "" ? undefined : Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Feasibility Result (Surveyor Assessment) */}
              <Card className="border-solar bg-solar-card shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">Feasibility Result (Surveyor Assessment)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Recommended System Size (kW)</label>
                      <Input
                        className="border-solar bg-background"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        placeholder="e.g. 3"
                        value={siteDetails.recommendedSystemSizeKw ?? ""}
                        onChange={(e) => setSiteDetails((p) => ({ ...p, recommendedSystemSizeKw: e.target.value === "" ? undefined : e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Overall Feasibility</label>
                      <Select value={siteDetails.overallFeasibility ?? ""} onValueChange={(v) => setSiteDetails((p) => ({ ...p, overallFeasibility: v === "" ? undefined : (v as "Feasible" | "Not Feasible") }))}>
                        <SelectTrigger className="border-solar bg-background">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Feasible">Feasible</SelectItem>
                          <SelectItem value="Not Feasible">Not Feasible</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">If Not Feasible, Reason</label>
                      <Select value={siteDetails.notFeasibleReason ?? ""} onValueChange={(v) => setSiteDetails((p) => ({ ...p, notFeasibleReason: v === "" ? undefined : (v as "Insufficient Space" | "Shading" | "Structural Issue" | "Consumer Not Willing") }))}>
                        <SelectTrigger className="border-solar bg-background">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Insufficient Space">Insufficient Space</SelectItem>
                          <SelectItem value="Shading">Shading</SelectItem>
                          <SelectItem value="Structural Issue">Structural Issue</SelectItem>
                          <SelectItem value="Consumer Not Willing">Consumer Not Willing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bank details */}
              <Card className="border-solar bg-solar-card shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">Bank Details (Optional)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <FormField
                      control={form.control}
                      name="bankDetails.bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Name</FormLabel>
                          <FormControl>
                            <Input className="border-solar" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bankDetails.branch"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch</FormLabel>
                          <FormControl>
                            <Input className="border-solar" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <FormField
                      control={form.control}
                      name="bankDetails.accountNo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account No (optional)</FormLabel>
                          <FormControl>
                            <Input className="border-solar" inputMode="numeric" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bankDetails.ifsc"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IFSC (optional)</FormLabel>
                          <FormControl>
                            <Input className="border-solar" placeholder="e.g. SBIN0001234" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Site details (auto from GPRS Cam) */}
              <Card className="border-solar bg-solar-card shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">Site Details (GPRS Cam)</CardTitle>
                  <p className="text-sm text-muted-foreground">Capture location to auto-fill site details</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {locationCaptured ? (
                        <span className="text-green-700">Location captured</span>
                      ) : (
                        <span className="text-muted-foreground">Location not captured</span>
                      )}
                      {siteDetails.accuracyMeters != null && siteDetails.accuracyMeters < 5000 ? (
                        <span className="text-xs text-muted-foreground">({siteDetails.accuracyMeters}m accuracy)</span>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      onClick={handleCaptureLocation}
                      disabled={isCapturingLocation}
                      className="bg-solar-yellow text-foreground hover:bg-solar-yellow/90"
                    >
                      <MapPin className="mr-2 h-4 w-4" />
                      {isCapturingLocation ? "Capturing..." : "Capture Location"}
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 items-end">
                    <Input className="border-solar bg-background" value={siteDetails.gpsLat ?? ""} placeholder="Latitude (auto)" onChange={(e) => setSiteDetails((prev) => ({ ...prev, gpsLat: e.target.value }))} />
                    <Input className="border-solar bg-background" value={siteDetails.gpsLng ?? ""} placeholder="Longitude (auto)" onChange={(e) => setSiteDetails((prev) => ({ ...prev, gpsLng: e.target.value }))} />
                  </div>
                  <Input
                    className="border-solar bg-background"
                    value={siteDetails.capturedAt ? new Date(siteDetails.capturedAt).toLocaleString() : ""}
                    placeholder="Captured at (auto)"
                    disabled
                  />
                </CardContent>
              </Card>

              {/* Uploads (optional for now) */}
              <Card className="border-solar bg-solar-card shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">Uploads (Optional)</CardTitle>
                  <p className="text-sm text-muted-foreground">Aadhar, PAN, Bank Proof, E-Bill, Beneficiary Photo, Site Layout, Site Photos</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <UploadRow k="aadhaarCard" />
                  <UploadRow k="panCard" />
                  <UploadRow k="bankProof" />
                  <UploadRow k="eBill" />
                  <UploadRow
                    k="beneficiaryPhoto"
                    disabled={!locationCaptured}
                    helper={!locationCaptured ? "Capture location first to enable this upload (GPRS Cam required)." : undefined}
                  />
                  <UploadRow k="siteLayout" />
                  <UploadRow k="roofTerraceNorth" />
                  <UploadRow k="roofTerraceSouth" />
                  <UploadRow k="earthingAreaPic" />
                  <UploadRow k="inverterAreaPic" />
                </CardContent>
              </Card>

              {/* Submit — same style as installation form */}
              <div className="rounded-xl border-2 border-green-200 bg-muted/50/80 p-5">
                <p className="mb-4 text-sm font-medium text-green-800">Ready? Save your changes</p>
                <div className="flex flex-wrap gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => router.push(`/survey-details?id=${id}`)}
                    className="border-solar text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="min-w-[220px] bg-green-600 py-6 text-base font-semibold text-white shadow-lg hover:bg-green-700 focus-visible:ring-2 focus-visible:ring-green-500"
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </main>
    </div>
  )
}

export default function EditSurveyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    }>
      <EditSurveyContent />
    </Suspense>
  )
}
