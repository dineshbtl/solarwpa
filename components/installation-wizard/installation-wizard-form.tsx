"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Camera, CheckCircle2, Loader2, MapPin, Plus, ShieldCheck, Trash2 } from "lucide-react"

import { WizardShell } from "@/components/installation-wizard/wizard-shell"
import { SurveySelect } from "@/components/survey-select"
import { NewConsumerModal } from "@/components/new-consumer-modal"
import { EngineerSelect } from "@/components/engineer-select"
import { InstallationMaterialLinesEditor, type MaterialLine } from "@/components/installation-material-lines-editor"
import { InstallationPhotoLocationFields } from "@/components/installation-photo-location-fields"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { ACTIVE_PROJECT_ID } from "@/lib/data/active-project"
import * as installationsData from "@/lib/data/installations"
import * as surveysData from "@/lib/data/surveys"
import { useInstallation, useInstallations, useProjects, useUsers } from "@/lib/data/hooks"
import { materialAllowsSerialOrBarcode, materialUsesLengthInsteadOfSerial } from "@/lib/installation-material-options"
import {
  createMaterialLineId,
  solarPanelLineHasAllIdentifiers,
  validateMaterialsList,
} from "@/lib/installation-material-validation"
import {
  gpsFieldsForPayload,
  parseStoredGps,
} from "@/lib/installation-photo-gps"
import { getDeviceGpsOnly } from "@/lib/geolocation"
import { preparePhotoWithGpsStamp } from "@/lib/photo-gps-stamp"
import { saveDraft, loadDraft, clearDraft } from "@/lib/store/installation-wizard"
import type {
  CommissioningData,
  CreateInstallationInput,
  FaultReport,
  InstallationChecklist,
  InstallationPhotoMeta,
  Material as StoreMaterial,
  QualityCheck,
} from "@/lib/store/installations"
import type { Survey } from "@/lib/store/surveys"
import { useInstallationPhotoDisplayUrls } from "@/lib/supabase/installation-photo-urls"
import { listEligibleHouseholdSerials, markHouseholdSerialsInstalled } from "@/lib/supabase/warehouse"
import {
  InstallationEditPageSkeleton,
  InstallationNewPageSkeleton,
} from "@/components/installations-loading-skeletons"

const DRAFT_KEY_NEW = "new"
const TOTAL_STEPS = 7

function pad2(n: number) {
  return n.toString().padStart(2, "0")
}

function isoToTimeInput(iso?: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function timeInputToIso(t: string): string | undefined {
  const s = t.trim()
  if (!s) return undefined
  const m = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (!m) return undefined
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)))
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)))
  const d = new Date()
  d.setHours(hh, mm, 0, 0)
  return d.toISOString()
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob | null> {
  if (!dataUrl.startsWith("data:")) return null
  try {
    const res = await fetch(dataUrl)
    return await res.blob()
  } catch {
    return null
  }
}

function formatSurveyValue(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function joinSurveyParts(parts: unknown[]): string | null {
  return formatSurveyValue(parts.map(formatSurveyValue).filter(Boolean).join(", "))
}

const PHOTO_CATEGORIES = [
  "panel_placement",
  "wiring",
  "inverter",
  "meter",
  "overall",
  "earthing",
] as const

type WizardPhoto = {
  id: string
  category: InstallationPhotoMeta["category"]
  description: string
  file: File | null
  existingFile?: { name: string; type: string; size: number }
  existingImageUrl?: string
  latitude?: number
  longitude?: number
  gpsAccuracyMeters?: number
  gpsSource?: InstallationPhotoMeta["gpsSource"]
}

type CreateInstallationInputWithReadiness = CreateInstallationInput & {
  supervisorCivilWorkCompleted?: boolean
  supervisorSiteConditionCompleted?: boolean
}

function normalizePhotoFromInstallation(
  p: InstallationPhotoMeta | Record<string, unknown>,
  index: number
): WizardPhoto {
  const raw = p as Record<string, unknown>
  const id = typeof raw.id === "string" ? raw.id : `PHOTO-${index + 1}`
  const cat = (raw.category as string) ?? "overall"
  const category: WizardPhoto["category"] = PHOTO_CATEGORIES.includes(cat as (typeof PHOTO_CATEGORIES)[number])
    ? (cat as WizardPhoto["category"])
    : "overall"
  const description = typeof raw.description === "string" ? raw.description : ""
  let existingFile: { name: string; type: string; size: number } | undefined
  const fileMeta = raw.file ?? raw.file_meta
  if (fileMeta && typeof fileMeta === "object" && !Array.isArray(fileMeta)) {
    const f = fileMeta as Record<string, unknown>
    existingFile = {
      name: typeof f.name === "string" ? f.name : "photo",
      type: typeof f.type === "string" ? f.type : "image/*",
      size: typeof f.size === "number" ? f.size : 0,
    }
  }
  const existingImageUrl = typeof raw.url === "string" ? raw.url : undefined
  const gps = parseStoredGps(raw)
  return {
    id,
    category,
    description,
    file: null,
    existingFile,
    existingImageUrl,
    ...(gps
      ? {
          latitude: gps.latitude,
          longitude: gps.longitude,
          gpsAccuracyMeters: gps.gpsAccuracyMeters,
          gpsSource: gps.source,
        }
      : {}),
  }
}

function PhotoPreviewCell({
  file,
  existingFile,
  existingImageUrl,
}: {
  file: File | null
  existingFile?: { name: string; type: string; size: number }
  existingImageUrl?: string
}) {
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
      <img src={objectUrl} alt="Preview" className="block h-full w-full object-cover" style={{ minHeight: 140 }} />
    )
  }
  if (existingImageUrl) {
    return (
      <img src={existingImageUrl} alt="Saved" className="block h-full w-full object-cover" style={{ minHeight: 140 }} />
    )
  }
  return (
    <div
      className="flex min-h-[140px] flex-col items-center justify-center gap-2 bg-muted/30 text-center text-sm text-muted-foreground"
      style={{ minHeight: 140 }}
    >
        <Camera className="h-10 w-10 shrink-0 opacity-60" />
      {existingFile?.name ? <span className="font-medium text-foreground">{existingFile.name}</span> : <span>No image</span>}
    </div>
  )
}

export type InstallationWizardFormProps = {
  mode: "new" | "edit"
  installationId?: string | null
}

export function InstallationWizardForm({ mode, installationId: routeInstallationId }: InstallationWizardFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id: string | null = mode === "edit" ? (routeInstallationId ?? null) : null

  const { data: installation, loading: installationLoading, error: installationError } = useInstallation(id)
  const { data: installations = [] } = useInstallations()
  const { data: projects = [], loading: projectsLoading, error: projectsError } = useProjects()
  const { data: users = [] } = useUsers()

  const [step, setStep] = useState(1)
  const [jobInfo, setJobInfo] = useState<{
    projectId: string
    surveyId: string
    customerName: string
    address: string
    engineerName: string
    engineerId: string
  }>({
    projectId: ACTIVE_PROJECT_ID,
    surveyId: "",
    customerName: "",
    address: "",
    engineerName: "",
    engineerId: "",
  })
  const [visitType, setVisitType] = useState<"installation" | "commissioning">("installation")
  const [arrivalTime, setArrivalTime] = useState("")
  const [departureTime, setDepartureTime] = useState("")
  const [siteAccessible, setSiteAccessible] = useState(true)
  const [inaccessibleNote, setInaccessibleNote] = useState("")
  const [siteGps, setSiteGps] = useState<{ lat?: number; lng?: number; accuracy?: number; source?: string }>({})
  const [checklist, setChecklist] = useState<InstallationChecklist>({})
  const [commissioning, setCommissioning] = useState<CommissioningData>({})
  const [quality, setQuality] = useState<QualityCheck>({})
  const [fault, setFault] = useState<FaultReport>({ faultDetected: false })
  const [declarationConfirmed, setDeclarationConfirmed] = useState(false)
  const [signatureDataUrl, setSignatureDataUrl] = useState("")
  const [signatureTouched, setSignatureTouched] = useState(false)
  const [gpsConfirmed, setGpsConfirmed] = useState(false)
  const [supervisorCivilWorkCompleted, setSupervisorCivilWorkCompleted] = useState(false)
  const [supervisorSiteConditionCompleted, setSupervisorSiteConditionCompleted] = useState(false)
  const [selectedSurveyDetail, setSelectedSurveyDetail] = useState<Survey | null>(null)
  const [showNewConsumerModal, setShowNewConsumerModal] = useState(false)
  const [materials, setMaterials] = useState<MaterialLine[]>(() => [
    {
      id: createMaterialLineId(),
      name: "",
      serialNumber: "",
      barcode: "",
      lengthMeters: "",
      panelSerials: ["", "", "", ""],
      panelPhotoFiles: [null, null, null, null],
      panelBarcodes: ["", "", "", ""],
      photoFile: null,
    },
  ])
  const [photos, setPhotos] = useState<WizardPhoto[]>([])
  const [compressingPhotoIds, setCompressingPhotoIds] = useState<Record<string, true>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSlowHint, setSubmitSlowHint] = useState(false)
  const [draftBanner, setDraftBanner] = useState(false)
  const [eligiblePanelSerials, setEligiblePanelSerials] = useState<string[]>([])

  const visibleProjects = useMemo(() => projects.filter((p) => p.id === ACTIVE_PROJECT_ID), [projects])
  const selectedProject = useMemo(
    () => visibleProjects.find((p) => p.id === jobInfo.projectId),
    [visibleProjects, jobInfo.projectId]
  )
  const existingInstallationForSelectedSurvey = useMemo(() => {
    if (!jobInfo.surveyId.trim()) return null
    return installations.find((ins) => ins.surveyId === jobInfo.surveyId.trim() && (mode === "new" || ins.id !== id)) ?? null
  }, [installations, jobInfo.surveyId, mode, id])
  const selectedSurveyFacts = useMemo(() => {
    if (!selectedSurveyDetail) return []
    const loc = selectedSurveyDetail.siteLocation ?? {}
    const site = selectedSurveyDetail.siteDetails
    const fullAddress = joinSurveyParts([
      loc.address,
      loc.village,
      loc.mandal,
      loc.district,
      loc.pinCode,
      loc.city,
      loc.state,
    ])

    return [
      { label: "Beneficiary", value: selectedSurveyDetail.beneficiaryName },
      { label: "Service no.", value: selectedSurveyDetail.serviceNo },
      { label: "Mobile", value: selectedSurveyDetail.mobile },
      { label: "Consumer no.", value: loc.electricityConsumerNo },
      { label: "DISCOM", value: selectedSurveyDetail.discomName },
      { label: "Connection", value: joinSurveyParts([loc.connectionType, loc.phase ? `${loc.phase} phase` : null]) },
      { label: "Sanctioned load", value: loc.sanctionedLoadKw != null ? `${loc.sanctionedLoadKw} kW` : null },
      { label: "Contracted load", value: selectedSurveyDetail.contractedLoad != null ? `${selectedSurveyDetail.contractedLoad} kW` : null },
      { label: "Roof", value: joinSurveyParts([selectedSurveyDetail.roofType, selectedSurveyDetail.totalRoofs]) },
      { label: "Building height", value: selectedSurveyDetail.buildingHeight != null ? `${selectedSurveyDetail.buildingHeight} ft` : null },
      { label: "Recommended size", value: site?.recommendedSystemSizeKw != null ? `${site.recommendedSystemSizeKw} kW` : null },
      { label: "Feasibility", value: site?.overallFeasibility },
      { label: "Civil work", value: site?.supervisorCivilWorkStatus },
      { label: "Site condition", value: site?.supervisorSiteConditionStatus },
      { label: "Location", value: fullAddress },
      { label: "GPS", value: joinSurveyParts([loc.latitude, loc.longitude]) },
    ].flatMap((item) => {
      const value = formatSurveyValue(item.value)
      return value ? [{ ...item, value }] : []
    })
  }, [selectedSurveyDetail])

  const photosForSignedUrls = useMemo(
    () =>
      (mode !== "edit" || !id ? [] : photos).map((p) => ({
        id: p.id,
        url: p.file ? undefined : p.existingImageUrl,
        category: p.category,
        file: p.file ? { name: p.file.name } : p.existingFile ? { name: p.existingFile.name } : undefined,
      })),
    [mode, id, photos]
  )
  const signedPhotoUrls = useInstallationPhotoDisplayUrls(photosForSignedUrls, id)

  const photoCategories = useMemo(
    () =>
      [
        { value: "panel_placement", label: "Panel Placement" },
        { value: "wiring", label: "Wiring" },
        { value: "inverter", label: "Inverter" },
        { value: "meter", label: "Meter" },
        { value: "overall", label: "Overall" },
        { value: "earthing", label: "Earthing" },
      ] as const,
    []
  )

  const compactSteps = !siteAccessible

  const persistDraft = useCallback(() => {
    const key = mode === "edit" && id ? id : DRAFT_KEY_NEW
    saveDraft(key, {
      step,
      visitType,
      arrivalTime,
      departureTime,
      siteAccessible,
      siteLat: siteGps.lat,
      siteLng: siteGps.lng,
      surveyId: jobInfo.surveyId,
      customerName: jobInfo.customerName,
      address: jobInfo.address,
      engineerId: jobInfo.engineerId,
      engineerName: jobInfo.engineerName,
      installationChecklist: checklist as Record<string, boolean>,
      commissioningData: commissioning as Record<string, unknown>,
      qualityCheck: quality as Record<string, unknown>,
      faultReport: fault as Record<string, unknown>,
      declarationConfirmed,
      inaccessibleNote,
    })
  }, [
    mode,
    id,
    step,
    visitType,
    arrivalTime,
    departureTime,
    siteAccessible,
    siteGps.lat,
    siteGps.lng,
    jobInfo,
    checklist,
    commissioning,
    quality,
    fault,
    declarationConfirmed,
    inaccessibleNote,
  ])

  useEffect(() => {
    const site = selectedSurveyDetail?.siteDetails
    setSupervisorCivilWorkCompleted(site?.supervisorCivilWorkStatus === "completed" || site?.supervisorReadyForEngineer === true)
    setSupervisorSiteConditionCompleted(site?.supervisorSiteConditionStatus === "completed" || site?.supervisorReadyForEngineer === true)
  }, [selectedSurveyDetail?.id, selectedSurveyDetail?.siteDetails])

  useEffect(() => {
    if (mode !== "new") return
    const d = loadDraft(DRAFT_KEY_NEW)
    if (d && d.step >= 1) setDraftBanner(true)
  }, [mode])

  useEffect(() => {
    if (mode !== "new") return
    const fromQuery = searchParams.get("surveyId")?.trim() ?? ""
    if (!fromQuery) return
    let cancelled = false
    void surveysData.getSurveyById(fromQuery).then((survey) => {
      if (cancelled || !survey) return
      setJobInfo((prev) => {
        if (prev.surveyId.trim()) return prev
        const loc = survey.siteLocation ?? {}
        const addr =
          loc.address ||
          [loc.district, loc.pinCode, loc.city, loc.state].filter(Boolean).join(", ")
        return {
          ...prev,
          surveyId: survey.id,
          customerName: survey.beneficiaryName,
          address: addr || prev.address,
        }
      })
      setSelectedSurveyDetail((current) => (current?.id === survey.id ? current : survey))
    })
    return () => {
      cancelled = true
    }
  }, [mode, searchParams])

  useEffect(() => {
    if (!installation || mode !== "edit") return
    setJobInfo({
      projectId: installation.projectId ?? ACTIVE_PROJECT_ID,
      surveyId: installation.surveyId ?? "",
      customerName: installation.customerName ?? "",
      address: installation.address ?? "",
      engineerName: installation.engineerName ?? "",
      engineerId: installation.engineerId ?? "",
    })
    setVisitType(installation.visitType ?? "installation")
    setArrivalTime(isoToTimeInput(installation.arrivalTime))
    setDepartureTime(isoToTimeInput(installation.departureTime))
    setSiteAccessible(installation.siteAccessible !== false)
    setSiteGps({
      lat: installation.siteGps?.lat,
      lng: installation.siteGps?.lng,
      accuracy: installation.siteGps?.accuracy,
      source: installation.siteGps?.source,
    })
    setChecklist(installation.installationChecklist ?? {})
    setCommissioning(installation.commissioningData ?? {})
    setQuality(installation.qualityCheck ?? {})
    setFault(installation.faultReport ?? { faultDetected: false })
    if (installation.siteAccessible === false) {
      setInaccessibleNote(installation.commissioningData?.notes ?? "")
    } else {
      setInaccessibleNote("")
    }
    setDeclarationConfirmed(installation.declarationConfirmed === true)
    setSignatureDataUrl("")
    setSignatureTouched(false)
    setGpsConfirmed(!!installation.submittedAt)
    setMaterials(
      (installation.materials ?? []).map((m) => ({
        ...m,
        panelSerials: m.panelSerials ?? ["", "", "", ""],
        panelBarcodes: m.panelBarcodes ?? ["", "", "", ""],
        panelPhotoFiles: [null, null, null, null],
        photoFile: null,
      }))
    )
    const rawPhotos = Array.isArray(installation.photos) ? installation.photos : []
    setPhotos(rawPhotos.map((p, i) => normalizePhotoFromInstallation(p as InstallationPhotoMeta, i)))
    if (installation.surveyId) {
      void surveysData.getSurveyById(installation.surveyId).then((s) => setSelectedSurveyDetail(s ?? null))
    } else {
      setSelectedSurveyDetail(null)
    }
  }, [installation, mode])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [step])

  useEffect(() => {
    if (!siteAccessible && step >= 2 && step <= 6) setStep(7)
  }, [siteAccessible, step])

  useEffect(() => {
    const householdId = (selectedSurveyDetail?.id ?? jobInfo.surveyId).trim()
    if (!householdId || !siteAccessible) {
      setEligiblePanelSerials([])
      return
    }
    void listEligibleHouseholdSerials({ householdId, materialName: "Solar PV Module" })
      .then((serials) => setEligiblePanelSerials(serials))
      .catch(() => setEligiblePanelSerials([]))
  }, [selectedSurveyDetail?.id, jobInfo.surveyId, siteAccessible])

  const applyEligibleSerialsToSolarPanels = useCallback(() => {
    if (eligiblePanelSerials.length === 0) return
    const panelSerials = eligiblePanelSerials.slice(0, 4)
    setMaterials((prev) => {
      const idx = prev.findIndex((m) => m.name === "Solar PV Module")
      if (idx === -1) return prev
      const row = prev[idx]
      const next = [...prev]
      next[idx] = { ...row, panelSerials, serialNumber: panelSerials.join(", ") }
      return next
    })
  }, [eligiblePanelSerials])

  const handleProjectChange = (value: string) => {
    const projectId = value || ACTIVE_PROJECT_ID
    const project = visibleProjects.find((p) => p.id === projectId) ?? null
    setJobInfo((prev) => {
      const next = { ...prev, projectId }
      if (project) {
        next.address =
          (project.address ??
            [project.district, project.city, project.state, project.pincode].filter(Boolean).join(", ")) || prev.address
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
        const loc = survey.siteLocation ?? {}
        const addr =
          loc.address ||
          [loc.district, loc.pinCode, loc.city, loc.state]
            .filter(Boolean)
            .join(", ")
        next.address = addr || prev.address
      }
      return next
    })
    if (survey?.id) {
      void surveysData
        .getSurveyById(survey.id)
        .then((fullSurvey) => {
          if (!fullSurvey) return
          setSelectedSurveyDetail((current) => (current?.id === survey.id ? fullSurvey : current))
          setJobInfo((prev) => {
            if (prev.surveyId !== survey.id) return prev
            const loc = fullSurvey.siteLocation ?? {}
            const addr =
              loc.address ||
              [loc.district, loc.pinCode, loc.city, loc.state]
                .filter(Boolean)
                .join(", ")
            return {
              ...prev,
              customerName: fullSurvey.beneficiaryName || prev.customerName,
              address: addr || prev.address,
            }
          })
        })
        .catch(() => {
          toast({
            title: "Survey details",
            description: "Selected survey, but full details could not be loaded.",
            variant: "destructive",
          })
        })
    }
  }

  const captureSiteGps = async () => {
    const pos = await getDeviceGpsOnly()
    if (!pos) {
      toast({ title: "GPS unavailable", description: "Allow location or try again outdoors.", variant: "destructive" })
      return
    }
    setSiteGps({
      lat: pos.lat,
      lng: pos.lng,
      accuracy: pos.accuracyMeters,
      source: "device",
    })
    toast({ title: "Site location captured" })
  }

  const validateStep = (s: number): boolean => {
    if (s === 1) {
      if (!jobInfo.customerName.trim() || !jobInfo.address.trim()) {
        toast({ title: "Missing details", description: "Customer name and address are required.", variant: "destructive" })
        return false
      }
      if (existingInstallationForSelectedSurvey) {
        toast({
          title: "Survey already assigned",
          description: `Linked to ${existingInstallationForSelectedSurvey.id}.`,
          variant: "destructive",
        })
        return false
      }
      if (!siteAccessible && !inaccessibleNote.trim()) {
        toast({
          title: "Note required",
          description: "Explain why the site was not accessible.",
          variant: "destructive",
        })
        return false
      }
      return true
    }
    if (s === 2 && siteAccessible) {
      const err = validateMaterialsList(materials)
      if (err) {
        toast({ title: "Materials step — fix before continuing", description: err, variant: "destructive" })
        return false
      }
      return true
    }
    if (s === 6 && siteAccessible) {
      if (photos.length === 0) {
        toast({ title: "Add photos", description: "At least one installation photo is required.", variant: "destructive" })
        return false
      }
      const panelLineIndex = materials.findIndex(
        (m) =>
          m.name === "Solar PV Module" &&
          (m.panelPhotoFiles ?? []).filter((f) => !!f).length +
            (m.panelPhotos ?? []).filter((p) => !!p?.url).length <
            4
      )
      if (panelLineIndex !== -1) {
        toast({
          title: "Solar panel photos",
          description: "Upload all 4 panel photos on the Materials step before submitting.",
          variant: "destructive",
        })
        return false
      }
      return true
    }
    return true
  }

  const goNext = () => {
    if (!validateStep(step)) return
    persistDraft()
    if (step === 1 && !siteAccessible) {
      setStep(7)
      return
    }
    if (step < TOTAL_STEPS) setStep((s) => s + 1)
  }

  const goBack = () => {
    if (step === 7 && !siteAccessible) {
      setStep(1)
      return
    }
    if (step > 1) setStep((s) => s - 1)
  }

  const buildCreateInput = (): CreateInstallationInputWithReadiness => {
    const engineerRaw = jobInfo.engineerId.trim()
    const engineerIdFinal = engineerRaw.length >= 2 ? engineerRaw : undefined
    const input: CreateInstallationInputWithReadiness = {
      projectId: ACTIVE_PROJECT_ID,
      surveyId: jobInfo.surveyId.trim() || undefined,
      customerName: jobInfo.customerName.trim(),
      address: jobInfo.address.trim(),
      engineerName: jobInfo.engineerName.trim() || undefined,
      engineerId: engineerIdFinal,
      visitType,
      arrivalTime: timeInputToIso(arrivalTime),
      departureTime: timeInputToIso(departureTime),
      siteAccessible,
      siteGps:
        siteGps.lat != null && siteGps.lng != null
          ? { lat: siteGps.lat, lng: siteGps.lng, accuracy: siteGps.accuracy, source: siteGps.source }
          : undefined,
      installationChecklist: siteAccessible ? checklist : undefined,
      commissioningData: {
        ...commissioning,
        notes: !siteAccessible ? inaccessibleNote.trim() : commissioning.notes,
      },
      qualityCheck: siteAccessible ? quality : undefined,
      faultReport: siteAccessible ? fault : undefined,
      declarationConfirmed,
      submittedAt: new Date().toISOString(),
      supervisorCivilWorkCompleted,
      supervisorSiteConditionCompleted,
    }
    if (mode === "edit" && installation?.signatureUrl && !signatureTouched) {
      input.signatureUrl = installation.signatureUrl
    }
    return input
  }

  const handleFinalSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!validateStep(1)) return
    if (siteAccessible) {
      const err = validateMaterialsList(materials)
      if (err) {
        toast({ title: "Materials step — fix before saving", description: err, variant: "destructive" })
        setStep(2)
        return
      }
      if (photos.length === 0) {
        toast({ title: "Missing photos", description: "Add at least one photo.", variant: "destructive" })
        setStep(6)
        return
      }
      const panelLineIndex = materials.findIndex(
        (m) =>
          m.name === "Solar PV Module" &&
          (m.panelPhotoFiles ?? []).filter((f) => !!f).length +
            (m.panelPhotos ?? []).filter((p) => !!p?.url).length <
            4
      )
      if (panelLineIndex !== -1) {
        toast({ title: "Panel photos", description: "All 4 panel photos are required.", variant: "destructive" })
        setStep(2)
        return
      }
    }
    if (!declarationConfirmed) {
      toast({ title: "Declaration", description: "Confirm the declaration to submit.", variant: "destructive" })
      setStep(7)
      return
    }
    if (siteAccessible) {
      if (!gpsConfirmed) {
        toast({ title: "Confirm GPS", description: 'Tap "Confirm location" after GPS is shown.', variant: "destructive" })
        return
      }
    }

    const engineerId = jobInfo.engineerId.trim()
    if (engineerId && engineerId.length >= 2 && !users.some((u) => u.id === engineerId)) {
      toast({ title: "Invalid engineer", description: "Pick an engineer from the list.", variant: "destructive" })
      return
    }

    const input = buildCreateInput()
    const payloadMaterialsRaw = materials.filter((m) => {
      if (!m.name.trim()) return false
      if (m.name === "Solar PV Module") {
        return solarPanelLineHasAllIdentifiers(m)
      }
      if (materialUsesLengthInsteadOfSerial(m.name)) {
        return String(m.lengthMeters ?? "").trim().length > 0
      }
      if (materialAllowsSerialOrBarcode(m.name)) {
        return m.serialNumber.trim().length > 0 || m.barcode.trim().length > 0
      }
      return m.serialNumber.trim().length > 0
    })
    const payloadMaterials: StoreMaterial[] = payloadMaterialsRaw.map((m) => ({
      id: m.id,
      name: m.name,
      serialNumber: m.serialNumber ?? "",
      barcode: m.barcode || "",
      ...(String(m.lengthMeters ?? "").trim() ? { lengthMeters: String(m.lengthMeters).trim() } : {}),
      ...(m.quantity != null ? { quantity: m.quantity } : {}),
      ...(m.name === "Solar PV Module"
        ? {
            panelSerials: (m.panelSerials ?? []).map((s) => s.trim()),
            panelBarcodes: (m.panelBarcodes ?? []).map((b) => b.trim()),
            panelPhotos: [0, 1, 2, 3].map((idx) => {
              const f = m.panelPhotoFiles?.[idx]
              if (f) return { name: f.name, type: f.type, size: f.size }
              const existing = (m.panelPhotos ?? [])[idx]
              if (existing?.name) {
                return {
                  name: existing.name,
                  type: existing.type,
                  size: existing.size,
                  ...(existing.url ? { url: existing.url } : {}),
                }
              }
              return null
            }) as unknown as StoreMaterial["panelPhotos"],
          }
        : {}),
      ...(m.photoFile
        ? { photo: { name: m.photoFile.name, type: m.photoFile.type, size: m.photoFile.size } }
        : m.photo?.name
          ? {
              photo: {
                name: m.photo.name,
                type: m.photo.type,
                size: m.photo.size,
                ...(m.photo.url ? { url: m.photo.url } : {}),
              },
            }
        : {}),
    }))
    const materialPhotoFiles: Record<string, File> = {}
    for (const m of payloadMaterialsRaw) {
      if (m.photoFile) materialPhotoFiles[`file_mat_${m.id}_photo`] = m.photoFile
      if (m.name === "Solar PV Module") {
        for (let i = 0; i < 4; i++) {
          const f = m.panelPhotoFiles?.[i]
          if (f) materialPhotoFiles[`file_mat_${m.id}_panel_${i}`] = f
        }
      }
    }
    const payloadPhotos: InstallationPhotoMeta[] = photos.map((p) => ({
      id: p.id,
      category: p.category,
      description: p.description,
      file: p.file ? { name: p.file.name, type: p.file.type, size: p.file.size } : p.existingFile,
      ...(!p.file && p.existingImageUrl ? { url: p.existingImageUrl } : {}),
      ...gpsFieldsForPayload(p),
    }))
    const photoFiles = photos.reduce<Record<string, File>>((acc, p) => {
      if (p.file) acc[p.id] = p.file
      return acc
    }, {})

    // Pre-flight payload check: if compression silently failed (e.g. old
    // Android WebView) the user can be uploading 30+ MB of full-resolution
    // shots, which will trip Nginx and eat a 90 s timeout before they see
    // the actual size problem. Catch it here while photos are still on-screen.
    const totalPhotoBytes =
      Object.values(photoFiles).reduce((s, f) => s + (f?.size ?? 0), 0) +
      Object.values(materialPhotoFiles).reduce((s, f) => s + (f?.size ?? 0), 0)
    const PAYLOAD_LIMIT_BYTES = 20 * 1024 * 1024
    if (totalPhotoBytes > PAYLOAD_LIMIT_BYTES) {
      const sizeMb = Math.round((totalPhotoBytes / (1024 * 1024)) * 10) / 10
      toast({
        title: "Photos are too large",
        description: `Total upload is ~${sizeMb} MB. Remove a few photos and re-tap each one to recompress, then try again.`,
        variant: "destructive",
      })
      setStep(siteAccessible ? 6 : 7)
      return
    }

    let signatureBlob: Blob | null = null
    if (siteAccessible && signatureDataUrl.startsWith("data:")) {
      signatureBlob = await dataUrlToBlob(signatureDataUrl)
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSlowHint(false)
    const slowHintTimer = window.setTimeout(() => setSubmitSlowHint(true), 20_000)
    try {
      if (mode === "new") {
        const saved = await installationsData.createInstallation(
          input,
          { materials: payloadMaterials, photos: payloadPhotos },
          Object.keys(photoFiles).length > 0 ? photoFiles : undefined,
          Object.keys(materialPhotoFiles).length > 0 ? materialPhotoFiles : undefined,
          signatureBlob && signatureBlob.size > 0 ? signatureBlob : undefined
        )
        clearDraft(DRAFT_KEY_NEW)
        const usedPanelSerials = payloadMaterials
          .filter((m) => m.name === "Solar PV Module")
          .flatMap((m) => m.panelSerials ?? [])
          .map((s) => s.trim())
          .filter(Boolean)
        if (saved.surveyId && usedPanelSerials.length > 0) {
          // Do not block navigation/save success on secondary serial-status sync.
          void markHouseholdSerialsInstalled({
            householdId: saved.surveyId,
            materialName: "Solar PV Module",
            serialNos: usedPanelSerials,
            installationId: saved.id,
          }).catch(() => {
            toast({ title: "Saved, but serial state not synced", description: "Please retry from allocation view.", variant: "destructive" })
          })
        }
        toast({ title: "Installation recorded", description: `Saved as ${saved.id}.` })
        router.push("/installations")
      } else if (id) {
        await installationsData.updateInstallation(
          id,
          input,
          { materials: payloadMaterials, photos: payloadPhotos },
          Object.keys(photoFiles).length > 0 ? photoFiles : undefined,
          Object.keys(materialPhotoFiles).length > 0 ? materialPhotoFiles : undefined,
          signatureBlob && signatureBlob.size > 0 ? signatureBlob : undefined
        )
        clearDraft(id)
        const usedPanelSerials = payloadMaterials
          .filter((m) => m.name === "Solar PV Module")
          .flatMap((m) => m.panelSerials ?? [])
          .map((s) => s.trim())
          .filter(Boolean)
        if (jobInfo.surveyId && usedPanelSerials.length > 0) {
          // Keep update UX snappy on slow mobile links; sync can complete in background.
          void markHouseholdSerialsInstalled({
            householdId: jobInfo.surveyId,
            materialName: "Solar PV Module",
            serialNos: usedPanelSerials,
            installationId: id,
          }).catch(() => {
            toast({ title: "Updated, but serial state not synced", description: "Please retry from allocation view.", variant: "destructive" })
          })
        }
        toast({ title: "Installation updated" })
        router.push(`/installations/${id}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again."
      setSubmitError(message)
      toast({
        title: mode === "new" ? "Could not save installation" : "Could not update installation",
        description: message,
        variant: "destructive",
      })
      // eslint-disable-next-line no-console
      console.error("[installation-wizard] submit failed", err)
    } finally {
      window.clearTimeout(slowHintTimer)
      setSubmitSlowHint(false)
      setIsSubmitting(false)
    }
  }

  const resumeDraft = () => {
    const d = loadDraft(DRAFT_KEY_NEW)
    if (!d) return
    setStep(Math.min(TOTAL_STEPS, Math.max(1, d.step)))
    if (d.visitType === "installation" || d.visitType === "commissioning") setVisitType(d.visitType)
    if (d.arrivalTime) setArrivalTime(d.arrivalTime)
    if (d.departureTime) setDepartureTime(d.departureTime)
    if (typeof d.siteAccessible === "boolean") setSiteAccessible(d.siteAccessible)
    if (d.siteLat != null && d.siteLng != null) setSiteGps({ lat: d.siteLat, lng: d.siteLng, source: "device" })
    if (d.customerName) setJobInfo((p) => ({ ...p, customerName: d.customerName! }))
    if (d.address) setJobInfo((p) => ({ ...p, address: d.address! }))
    if (d.surveyId) setJobInfo((p) => ({ ...p, surveyId: d.surveyId! }))
    if (d.engineerId != null) setJobInfo((p) => ({ ...p, engineerId: d.engineerId!, engineerName: d.engineerName ?? "" }))
    if (d.installationChecklist) setChecklist(d.installationChecklist as InstallationChecklist)
    if (d.commissioningData) setCommissioning(d.commissioningData as CommissioningData)
    if (d.qualityCheck) setQuality(d.qualityCheck as QualityCheck)
    if (d.faultReport) setFault(d.faultReport as FaultReport)
    if (d.inaccessibleNote != null) setInaccessibleNote(d.inaccessibleNote)
    if (typeof d.declarationConfirmed === "boolean") setDeclarationConfirmed(d.declarationConfirmed)
    setDraftBanner(false)
    toast({ title: "Draft restored", description: "Photos and uploads were not restored." })
  }

  const addPhoto = () => {
    setPhotos((prev) => [
      ...prev,
      { id: `PHOTO-${prev.length + 1}`, category: "panel_placement", description: "", file: null },
    ])
    toast({ title: "Photo slot added" })
  }

  if (mode === "edit") {
    if (!id) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <p className="text-muted-foreground">Invalid installation.</p>
        </div>
      )
    }
    if (installationLoading) return <InstallationEditPageSkeleton />
    if (installationError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6">
          <p className="text-destructive">Failed to load installation</p>
          <Link href="/installations" className="text-sm text-solar hover:underline">
            Back
          </Link>
        </div>
      )
    }
    if (!installation) {
      return (
        <div className="p-6">
          <p className="text-muted-foreground">Not found.</p>
          <Link href="/installations">
            <Button variant="outline" className="mt-4">
              Back
            </Button>
          </Link>
        </div>
      )
    }
  } else if (projectsLoading && projects.length === 0 && !projectsError) {
    return <InstallationNewPageSkeleton />
  }

  const footer = (
    <div className="flex w-full flex-col gap-2">
      {submitError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="font-medium">{mode === "new" ? "Could not save installation" : "Could not update installation"}</p>
          <p className="mt-0.5 break-words">{submitError}</p>
          <p className="mt-1 text-[11px] text-red-700">
            Photos and entered data are still here — fix the issue above, then tap{" "}
            <strong>{mode === "new" ? "Complete installation" : "Save changes"}</strong> again. If this keeps happening on mobile data, switch to Wi‑Fi and retry.
          </p>
        </div>
      )}
      {isSubmitting && submitSlowHint && !submitError && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Still uploading photos — slow mobile networks can take 30–90 seconds. Keep this screen open and do not press back.
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={goBack} disabled={step <= 1 || isSubmitting}>
          Back
        </Button>
        {step < TOTAL_STEPS ? (
          <Button type="button" className="bg-green-600 text-white hover:bg-green-700" onClick={goNext} disabled={isSubmitting}>
            Next
          </Button>
        ) : (
          <Button
            type="button"
            className="bg-green-600 text-white hover:bg-green-700"
            onClick={() => void handleFinalSubmit()}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting
              ? mode === "new"
                ? "Saving installation…"
                : "Saving changes…"
              : mode === "new"
                ? "Complete installation"
                : "Save changes"}
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <>
      <WizardShell
        mode={mode}
        installationLabel={mode === "edit" && id ? id : undefined}
        currentStep={step}
        totalSteps={TOTAL_STEPS}
        backHref={mode === "edit" && id ? `/installations/${id}` : "/installations"}
        backLabel={mode === "edit" ? "Back to installation" : "Back to list"}
        compactSteps={compactSteps}
        footer={footer}
      >
        {draftBanner && mode === "new" && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
            <span className="text-amber-950">Resume your saved draft?</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setDraftBanner(false)}>
                Dismiss
              </Button>
              <Button size="sm" className="bg-amber-600 text-white hover:bg-amber-700" onClick={resumeDraft}>
                Resume draft
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Step 1 — Visit details</CardTitle>
              <p className="text-sm text-muted-foreground">Site visit information and consumer linkage.</p>
              {projectsError ? <p className="text-xs text-destructive">Projects failed to load.</p> : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Project</Label>
                  <Select value={jobInfo.projectId || ACTIVE_PROJECT_ID} onValueChange={handleProjectChange}>
                    <SelectTrigger className="mt-2 border-solar">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.projectName} ({p.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProject && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedProject.projectName}
                      {selectedProject.district && ` · ${selectedProject.district}`}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Survey (optional)</Label>
                  <div className="mt-2 flex items-end gap-2">
                    <div className="flex-1">
                      <SurveySelect
                        value={jobInfo.surveyId}
                        onSelect={handleSurveySelect}
                        selectedSurvey={selectedSurveyDetail}
                        placeholder="Select survey"
                      />
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowNewConsumerModal(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              {selectedSurveyDetail && (
                <div className="rounded-lg border border-solar bg-muted/40 p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">Survey {selectedSurveyDetail.id}</p>
                      <p className="text-muted-foreground">{selectedSurveyDetail.beneficiaryName}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-muted-foreground">
                      {selectedSurveyDetail.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {selectedSurveyFacts.map((item) => (
                      <div key={item.label} className="rounded-md bg-white/70 px-3 py-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                        <p className="mt-0.5 break-words text-sm text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {existingInstallationForSelectedSurvey ? (
                    <p className="mt-2 text-amber-800">
                      Already linked to {existingInstallationForSelectedSurvey.id}.
                    </p>
                  ) : null}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="cust">Customer name *</Label>
                  <Input
                    id="cust"
                    className="mt-2 border-solar"
                    value={jobInfo.customerName}
                    onChange={(e) => setJobInfo({ ...jobInfo, customerName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="addr">Address *</Label>
                  <Input
                    id="addr"
                    className="mt-2 border-solar"
                    value={jobInfo.address}
                    onChange={(e) => setJobInfo({ ...jobInfo, address: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label>Engineer</Label>
                <div className="mt-2">
                  <EngineerSelect
                    value={jobInfo.engineerId}
                    onValueChange={(eid, name) => setJobInfo((p) => ({ ...p, engineerId: eid, engineerName: name }))}
                  />
                </div>
              </div>
              {jobInfo.surveyId && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <div className="mb-3">
                    <p className="text-sm font-medium text-amber-950">Pre-installation readiness</p>
                    <p className="text-xs text-amber-900">
                      Optional — update if civil work / site condition is now complete.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">Civil work completed</p>
                        <p className="text-xs text-muted-foreground">Optional. Toggle when civil work is done.</p>
                      </div>
                      <Switch
                        checked={supervisorCivilWorkCompleted}
                        onCheckedChange={setSupervisorCivilWorkCompleted}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">Site condition completed</p>
                        <p className="text-xs text-muted-foreground">Optional. Toggle when the site is ready.</p>
                      </div>
                      <Switch
                        checked={supervisorSiteConditionCompleted}
                        onCheckedChange={setSupervisorSiteConditionCompleted}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Visit type</Label>
                  <Select
                    value={visitType}
                    onValueChange={(v) => setVisitType(v as "installation" | "commissioning")}
                  >
                    <SelectTrigger className="mt-2 border-solar">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="installation">Installation</SelectItem>
                      <SelectItem value="commissioning">Commissioning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-solar px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Site accessible</p>
                    <p className="text-xs text-muted-foreground">If no, you can jump to sign-off with a note.</p>
                  </div>
                  <Switch checked={siteAccessible} onCheckedChange={setSiteAccessible} />
                </div>
              </div>
              {!siteAccessible && (
                <div>
                  <Label>Inaccessible — note *</Label>
                  <Textarea
                    className="mt-2 border-solar"
                    value={inaccessibleNote}
                    onChange={(e) => setInaccessibleNote(e.target.value)}
                    placeholder="Why could the team not access the site?"
                    rows={3}
                  />
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="arr">Arrival time</Label>
                  <Input
                    id="arr"
                    type="time"
                    className="mt-2 border-solar"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="dep">Departure time</Label>
                  <Input
                    id="dep"
                    type="time"
                    className="mt-2 border-solar"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" className="border-solar" onClick={() => void captureSiteGps()}>
                  <MapPin className="mr-2 h-4 w-4" />
                  Capture site GPS
                </Button>
                {siteGps.lat != null && siteGps.lng != null && (
                  <span className="text-xs text-muted-foreground">
                    {siteGps.lat.toFixed(5)}, {siteGps.lng.toFixed(5)}
                    {siteGps.accuracy != null ? ` · ±${siteGps.accuracy}m` : ""}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && siteAccessible && (
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Step 2 — Materials & checklist</CardTitle>
              <p className="text-sm text-muted-foreground">BOM lines and installation progress checklist.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border border-solar/60 bg-muted/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Household eligible panel serials</p>
                    <p className="text-xs text-muted-foreground">
                      {eligiblePanelSerials.length > 0
                        ? `${eligiblePanelSerials.length} serial(s) available for this household`
                        : "No eligible serials found for selected household yet."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-solar"
                    onClick={applyEligibleSerialsToSolarPanels}
                    disabled={eligiblePanelSerials.length === 0}
                  >
                    Auto-load panel serials
                  </Button>
                </div>
              </div>
              <InstallationMaterialLinesEditor
                materials={materials}
                onChange={setMaterials}
                installationId={id}
                fallbackGps={
                  siteGps.lat != null && siteGps.lng != null
                    ? {
                        latitude: siteGps.lat,
                        longitude: siteGps.lng,
                        gpsAccuracyMeters: siteGps.accuracy,
                      }
                    : null
                }
              />
              <div className="space-y-2 rounded-lg border border-solar/60 p-4">
                <p className="text-sm font-medium">Installation checklist</p>
                {(
                  [
                    ["panelsInstalled", "Solar panels installed"],
                    ["structureFixed", "Mounting structure fixed"],
                    ["inverterInstalled", "Inverter installed"],
                    ["dcCabling", "DC cabling completed"],
                    ["acCabling", "AC cabling completed"],
                    ["earthing", "Earthing completed"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={!!checklist[key]}
                      onCheckedChange={(c) => setChecklist((prev) => ({ ...prev, [key]: c === true }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && siteAccessible && (
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Step 3 — Commissioning</CardTitle>
              <p className="text-sm text-muted-foreground">Optional now if visit is installation-only.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {(
                [
                  ["powerOn", "System power ON"],
                  ["inverterStartup", "Inverter start-up successful"],
                  ["powerGenerated", "Initial generation observed"],
                  ["safetyChecks", "Safety checks completed"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-sm">{label}</span>
                  <Switch
                    checked={!!commissioning[key]}
                    onCheckedChange={(c) => setCommissioning((p) => ({ ...p, [key]: c }))}
                  />
                </div>
              ))}
              <div>
                <Label>Commissioning status</Label>
                <Select
                  value={commissioning.status ?? "pending"}
                  onValueChange={(v) => setCommissioning((p) => ({ ...p, status: v as "approved" | "pending" }))}
                >
                  <SelectTrigger className="mt-2 border-solar">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  className="mt-2 border-solar"
                  value={commissioning.notes ?? ""}
                  onChange={(e) => setCommissioning((p) => ({ ...p, notes: e.target.value }))}
                  rows={3}
                />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => toast({ title: "Skipped for now" })}>
                Skip for now
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 4 && siteAccessible && (
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Step 4 — Quality</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>System performance</Label>
                <RadioGroup
                  value={quality.systemPerformance ?? ""}
                  onValueChange={(v) =>
                    setQuality((p) => ({ ...p, systemPerformance: v as QualityCheck["systemPerformance"] }))
                  }
                  className="mt-2 flex gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="normal" /> Normal
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="not_normal" /> Not normal
                  </label>
                </RadioGroup>
              </div>
              <div>
                <Label>Physical inspection</Label>
                <RadioGroup
                  value={quality.physicalInspection ?? ""}
                  onValueChange={(v) =>
                    setQuality((p) => ({ ...p, physicalInspection: v as QualityCheck["physicalInspection"] }))
                  }
                  className="mt-2 flex gap-4"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="ok" /> OK
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="needs_attention" /> Needs attention
                  </label>
                </RadioGroup>
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="text-sm">Monitoring available</span>
                <Switch
                  checked={!!quality.monitoringAvailable}
                  onCheckedChange={(c) => setQuality((p) => ({ ...p, monitoringAvailable: c }))}
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  className="mt-2 border-solar"
                  value={quality.notes ?? ""}
                  onChange={(e) => setQuality((p) => ({ ...p, notes: e.target.value }))}
                  rows={3}
                />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => toast({ title: "Skipped for now" })}>
                Skip for now
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 5 && siteAccessible && (
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Step 5 — Fault reporting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="text-sm font-medium">Fault detected</span>
                <Switch
                  checked={!!fault.faultDetected}
                  onCheckedChange={(c) => setFault((p) => ({ ...p, faultDetected: c }))}
                />
              </div>
              {fault.faultDetected ? (
                <>
                  <div>
                    <Label>Fault type</Label>
                    <Select
                      value={fault.faultType ?? "other"}
                      onValueChange={(v) =>
                        setFault((p) => ({ ...p, faultType: v as NonNullable<FaultReport["faultType"]> }))
                      }
                    >
                      <SelectTrigger className="mt-2 border-solar">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inverter">Inverter</SelectItem>
                        <SelectItem value="panel">Panel</SelectItem>
                        <SelectItem value="wiring">Wiring</SelectItem>
                        <SelectItem value="monitoring">Monitoring</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      className="mt-2 border-solar"
                      value={fault.description ?? ""}
                      onChange={(e) => setFault((p) => ({ ...p, description: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>Action taken</Label>
                    <Textarea
                      className="mt-2 border-solar"
                      value={fault.actionTaken ?? ""}
                      onChange={(e) => setFault((p) => ({ ...p, actionTaken: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>Fault status</Label>
                    <Select
                      value={fault.status ?? "pending"}
                      onValueChange={(v) => setFault((p) => ({ ...p, status: v as "resolved" | "pending" }))}
                    >
                      <SelectTrigger className="mt-2 border-solar">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={() => toast({ title: "Skipped for now" })}>
                Skip for now
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 6 && siteAccessible && (
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Step 6 — Site photos</CardTitle>
                  <p className="text-sm text-muted-foreground">Evidence with GPS per photo.</p>
                </div>
                <Button type="button" size="sm" className="bg-solar-yellow text-foreground" onClick={addPhoto}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add photo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {photos.map((p) => (
                <div key={p.id} className="space-y-3 rounded-lg border border-solar bg-solar-beige p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{p.id}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setPhotos((prev) => prev.filter((x) => x.id !== p.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="h-36 overflow-hidden rounded-lg border border-solar">
                    <PhotoPreviewCell
                      file={p.file}
                      existingFile={p.existingFile}
                      existingImageUrl={signedPhotoUrls[p.id] || p.existingImageUrl}
                    />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select
                      value={p.category}
                      onValueChange={(v) =>
                        setPhotos((prev) =>
                          prev.map((x) => (x.id === p.id ? { ...x, category: v as WizardPhoto["category"] } : x))
                        )
                      }
                    >
                      <SelectTrigger className="mt-2 border-solar">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {photoCategories.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input
                      className="mt-2 border-solar"
                      value={p.description}
                      onChange={(e) =>
                        setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, description: e.target.value } : x)))
                      }
                    />
                  </div>
                  <div>
                    <Label>Upload</Label>
                    <input
                      id={`cam-${p.id}`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const raw = e.target.files?.[0]
                        e.target.value = ""
                        if (!raw) return
                        setCompressingPhotoIds((prev) => ({ ...prev, [p.id]: true }))
                        try {
                          const prepared = await preparePhotoWithGpsStamp(raw, {
                            fallbackGps:
                              siteGps.lat != null && siteGps.lng != null
                                ? {
                                    latitude: siteGps.lat,
                                    longitude: siteGps.lng,
                                    gpsAccuracyMeters: siteGps.accuracy,
                                  }
                                : null,
                          })
                          setPhotos((prev) =>
                            prev.map((x) =>
                              x.id === p.id
                                ? {
                                    ...x,
                                    file: prepared.file,
                                    ...(prepared.gps
                                      ? {
                                          latitude: prepared.gps.latitude,
                                          longitude: prepared.gps.longitude,
                                          gpsSource: prepared.gps.source,
                                        }
                                      : {}),
                                  }
                                : x
                            )
                          )
                        } catch {
                          setPhotos((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, file: raw } : x))
                          )
                        } finally {
                          setCompressingPhotoIds((prev) => {
                            const next = { ...prev }
                            delete next[p.id]
                            return next
                          })
                        }
                      }}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        type="button"
                        className="flex-1 bg-solar-yellow text-foreground"
                        onClick={() => document.getElementById(`cam-${p.id}`)?.click()}
                        disabled={!!compressingPhotoIds[p.id]}
                      >
                        {compressingPhotoIds[p.id] ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Compressing…
                          </>
                        ) : (
                          <>
                            <Camera className="mr-2 h-4 w-4" />
                            Camera / Gallery
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <InstallationPhotoLocationFields
                    value={{
                      latitude: p.latitude,
                      longitude: p.longitude,
                      gpsAccuracyMeters: p.gpsAccuracyMeters,
                      gpsSource: p.gpsSource,
                    }}
                    onChange={(next) => setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...next } : x)))}
                  />
                </div>
              ))}
              {photos.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-solar p-8 text-center">
                  <Camera className="mx-auto h-10 w-10 opacity-50" />
                  <Button type="button" className="mt-4 bg-solar-yellow text-foreground" onClick={addPhoto}>
                    Add first photo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 7 && (
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Step 7 — Declaration & completion</CardTitle>
              {!siteAccessible && <p className="text-sm text-amber-800">Site was not accessible — submit with declaration only.</p>}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-solar/60 bg-muted/30 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-green-700" />
                  Final review before submit
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-green-700" />
                    <span>Verify customer, material, and photo details are correct.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-green-700" />
                    <span>Confirm declaration and location, then submit.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-green-700" />
                    <span>
                      Click <span className="font-medium text-foreground">{mode === "new" ? "Complete installation" : "Save changes"}</span> to finish.
                    </span>
                  </div>
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <Checkbox checked={declarationConfirmed} onCheckedChange={(c) => setDeclarationConfirmed(c === true)} className="mt-1" />
                <span>I confirm that the information provided is correct and complete.</span>
              </label>
              {siteAccessible && (
                <>
                  <div className="rounded-lg border border-solar p-3">
                    <p className="text-sm font-medium">GPS confirmation</p>
                    <p className="text-xs text-muted-foreground">
                      {siteGps.lat != null && siteGps.lng != null
                        ? `${siteGps.lat.toFixed(5)}, ${siteGps.lng.toFixed(5)}`
                        : "Capture site GPS on step 1 if missing."}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => {
                        setGpsConfirmed(true)
                        toast({ title: "Location confirmed" })
                      }}
                    >
                      Confirm location
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </WizardShell>

      <NewConsumerModal
        open={showNewConsumerModal}
        onClose={() => setShowNewConsumerModal(false)}
        onCreated={(surveyId, beneficiaryName) => {
          setJobInfo((prev) => ({ ...prev, surveyId, customerName: beneficiaryName }))
        }}
        projectId={jobInfo.projectId}
      />
    </>
  )
}
