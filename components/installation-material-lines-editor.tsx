"use client"

import { useEffect, useMemo, useState } from "react"
import { Camera, Loader2, Package, Plus, Trash2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  MATERIAL_NAME_OPTIONS,
  BOM_DEFAULT_QUANTITIES,
  materialAllowsSerialOrBarcode,
  materialUsesLengthInsteadOfSerial,
  materialUsesPanelSerialSet,
  materialUsesQuantity,
} from "@/lib/installation-material-options"
import {
  createMaterialLineId,
  isDuplicateBarcodeAnywhere,
  isDuplicateSerial,
} from "@/lib/installation-material-validation"
import { cn } from "@/lib/utils"
import { detectBarcodeFromImageFile } from "@/lib/barcode-from-image"
import { preparePhotoWithGpsStamp } from "@/lib/photo-gps-stamp"
import {
  rewriteStorageUrl,
  useInstallationPhotoDisplayUrls,
  type InstallationPhotoUrlInput,
} from "@/lib/supabase/installation-photo-urls"

export type MaterialLine = {
  id: string
  name: string
  serialNumber: string
  barcode: string
  /** DC/AC cable & earthing wire — length in meters instead of serial */
  lengthMeters?: string
  /** Solar panel set serials (4 mandatory for panel line). */
  panelSerials?: string[]
  /** One optional material photo. */
  photoFile?: File | null
  /** Solar panel images (up to 4). */
  panelPhotoFiles?: (File | null)[]
  /** Solar panel barcodes — optional (one slot per panel when provided). */
  panelBarcodes?: string[]
  /** Saved material photo from backend (edit mode). */
  photo?: {
    name: string
    type: string
    size: number
    url?: string
  }
  /** Saved panel photos from backend (edit mode). */
  panelPhotos?: Array<{
    name: string
    type: string
    size: number
    url?: string
  } | null>
  /** Kit items — quantity count instead of serial. */
  quantity?: number
}

type InstallationMaterialLinesEditorProps = {
  materials: MaterialLine[]
  onChange: (next: MaterialLine[]) => void
  className?: string
  /** When set (edit installation), saved material/panel photo URLs are resolved like the detail page (signed / host rewrite). */
  installationId?: string | null
  /** Site GPS captured in wizard step 1 — used as a fallback so per-photo prep does not block on getCurrentPosition. */
  fallbackGps?: {
    latitude: number
    longitude: number
    gpsAccuracyMeters?: number
  } | null
}

function InlineImagePreview({
  file,
  savedDisplayUrl,
  alt,
  placeholder,
  busy,
}: {
  file?: File | null
  /** Resolved URL for saved server image (signed / rewritten). */
  savedDisplayUrl?: string
  alt: string
  placeholder: string
  busy?: boolean
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setObjectUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const src = objectUrl ?? savedDisplayUrl

  if (!src) {
    return (
      <div className="relative flex h-24 items-center justify-center rounded-md border border-solar bg-muted/30 text-[11px] text-muted-foreground">
        {busy ? (
          <div className="absolute inset-0 z-[1] flex items-center justify-center rounded-md bg-background/70">
            <Loader2 className="h-6 w-6 animate-spin text-foreground" aria-hidden />
          </div>
        ) : null}
        {placeholder}
      </div>
    )
  }

  return (
    <div className="relative h-24 overflow-hidden rounded-md border border-solar bg-white">
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
      {busy ? (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-background/70">
          <Loader2 className="h-6 w-6 animate-spin text-foreground" aria-hidden />
        </div>
      ) : null}
    </div>
  )
}

/**
 * Single list: each row = material type + serial + barcode (all manual entry in one place).
 */
function panelSlotHasSerialOrBarcode(m: MaterialLine, panelIdx: number): boolean {
  return !!(m.panelSerials?.[panelIdx] ?? "").trim() || !!(m.panelBarcodes?.[panelIdx] ?? "").trim()
}

export function InstallationMaterialLinesEditor({
  materials,
  onChange,
  className,
  installationId,
  fallbackGps,
}: InstallationMaterialLinesEditorProps) {
  const [scanningRowIds, setScanningRowIds] = useState<Record<string, boolean>>({})
  const [compressingPhotoKeys, setCompressingPhotoKeys] = useState<Record<string, boolean>>({})

  const materialEvidenceUrlInputs = useMemo((): InstallationPhotoUrlInput[] => {
    const out: InstallationPhotoUrlInput[] = []
    for (const m of materials) {
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
  }, [materials])

  const materialPhotoDisplayUrls = useInstallationPhotoDisplayUrls(
    materialEvidenceUrlInputs,
    installationId ?? null
  )

  const updateRow = (id: string, patch: Partial<MaterialLine>) => {
    onChange(
      materials.map((m) => {
        if (m.id !== id) return m
        const candidate = { ...m, ...patch }
        if (patch.serialNumber !== undefined) {
          if (isDuplicateSerial(candidate.serialNumber, materials, id)) {
            toast({
              title: "Duplicate serial number",
              description: "Another line already uses this serial number.",
              variant: "destructive",
            })
            return m
          }
        }
        if (patch.barcode !== undefined && candidate.barcode.trim()) {
          if (
            isDuplicateBarcodeAnywhere(candidate.barcode, materials, id)
          ) {
            toast({
              title: "Duplicate barcode",
              description: "Another line or panel already uses this barcode.",
              variant: "destructive",
            })
            return m
          }
        }
        return candidate
      })
    )
  }

  const updatePanelSerial = (id: string, panelIndex: number, value: string) => {
    onChange(
      materials.map((m) => {
        if (m.id !== id) return m
        const next = [...(m.panelSerials ?? ["", "", "", ""])]
        next[panelIndex] = value
        return { ...m, panelSerials: next }
      })
    )
  }

  const updatePanelBarcode = (id: string, panelIndex: number, value: string) => {
    if (value.trim()) {
      if (isDuplicateBarcodeAnywhere(value, materials, id, panelIndex)) {
        toast({
          title: "Duplicate barcode",
          description: "Another line or panel already uses this barcode.",
          variant: "destructive",
        })
        return
      }
    }
    onChange(
      materials.map((m) => {
        if (m.id !== id) return m
        const next = [...(m.panelBarcodes ?? ["", "", "", ""])]
        next[panelIndex] = value
        return { ...m, panelBarcodes: next }
      })
    )
  }

  const updatePanelPhoto = (id: string, panelIndex: number, file: File | null) => {
    onChange(
      materials.map((m) => {
        if (m.id !== id) return m
        const next = [...(m.panelPhotoFiles ?? [null, null, null, null])]
        next[panelIndex] = file
        return { ...m, panelPhotoFiles: next }
      })
    )
  }

  const patchCompressingKey = (key: string, value: boolean) => {
    setCompressingPhotoKeys((prev) => {
      if (value) return { ...prev, [key]: true }
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  /** Resize/JPEG material evidence before multipart upload (avoids nginx 413). */
  const setCompressedMaterialPhoto = async (id: string, raw: File | null) => {
    const key = `photo:${id}`
    if (!raw) {
      updateRow(id, { photoFile: null })
      return
    }
    patchCompressingKey(key, true)
    try {
      try {
        const prepared = await preparePhotoWithGpsStamp(raw, { fallbackGps })
        updateRow(id, { photoFile: prepared.file })
      } catch {
        updateRow(id, { photoFile: raw })
      }
    } finally {
      patchCompressingKey(key, false)
    }
  }

  const setCompressedPanelPhoto = async (id: string, panelIndex: number, raw: File | null) => {
    const key = `panel:${id}:${panelIndex}`
    if (!raw) {
      updatePanelPhoto(id, panelIndex, null)
      return
    }
    patchCompressingKey(key, true)
    try {
      try {
        const prepared = await preparePhotoWithGpsStamp(raw, { fallbackGps })
        updatePanelPhoto(id, panelIndex, prepared.file)
      } catch {
        updatePanelPhoto(id, panelIndex, raw)
      }
    } finally {
      patchCompressingKey(key, false)
    }
  }

  const addRow = () => {
    onChange([
      ...materials,
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
  }

  const removeRow = (id: string) => {
    onChange(materials.filter((m) => m.id !== id))
    toast({ title: "Material line removed" })
  }

  const loadAllBomMaterials = () => {
    const bomLines: MaterialLine[] = [
      { id: createMaterialLineId(), name: "Solar PV Module", serialNumber: "", barcode: "", panelSerials: ["", "", "", ""], panelBarcodes: ["", "", "", ""], panelPhotoFiles: [null, null, null, null], photoFile: null },
      { id: createMaterialLineId(), name: "Inverter", serialNumber: "", barcode: "", photoFile: null },
      { id: createMaterialLineId(), name: "Mounting Structure", serialNumber: "", barcode: "", photoFile: null },
      { id: createMaterialLineId(), name: "Bolts Set", serialNumber: "", barcode: "", quantity: 1, photoFile: null },
      { id: createMaterialLineId(), name: "DC Cable 4.0 Sqmm Black", serialNumber: "", barcode: "", lengthMeters: "10" },
      { id: createMaterialLineId(), name: "DC Cable 4.0 Sqmm Red & Black", serialNumber: "", barcode: "", lengthMeters: "10" },
      { id: createMaterialLineId(), name: "Earthing Wire 16 Sqmm Green", serialNumber: "", barcode: "", lengthMeters: "25" },
      { id: createMaterialLineId(), name: "ACDB Box & DCDB Box", serialNumber: "", barcode: "", photoFile: null },
      { id: createMaterialLineId(), name: "MC4 Connectors Pack", serialNumber: "", barcode: "", quantity: 1, photoFile: null },
      { id: createMaterialLineId(), name: "45x45 PVC Channel", serialNumber: "", barcode: "", quantity: 1, photoFile: null },
      { id: createMaterialLineId(), name: "PVC Pipe", serialNumber: "", barcode: "", quantity: 8, photoFile: null },
      { id: createMaterialLineId(), name: "1-inch Flexible Pipe", serialNumber: "", barcode: "", quantity: 1, photoFile: null },
      { id: createMaterialLineId(), name: "AC Cable Red", serialNumber: "", barcode: "", lengthMeters: "3" },
      { id: createMaterialLineId(), name: "AC Cable Red & Black", serialNumber: "", barcode: "", lengthMeters: "3" },
      { id: createMaterialLineId(), name: "Earthing Kit", serialNumber: "", barcode: "", quantity: 1, photoFile: null },
      { id: createMaterialLineId(), name: "Conduit Kit", serialNumber: "", barcode: "", quantity: 1, photoFile: null },
    ]
    onChange(bomLines)
    toast({ title: "BOM loaded", description: "All 16 standard materials pre-filled. Enter serials and scan barcodes." })
  }

  const handleBarcodeImageScan = async (id: string, panelIndex: number | null, file: File | null) => {
    if (!file) return
    const scanKey = `${id}:${panelIndex ?? "single"}`
    setScanningRowIds((prev) => ({ ...prev, [scanKey]: true }))
    try {
      const value = await detectBarcodeFromImageFile(file)
      if (!value) {
        toast({
          title: "Barcode not detected",
          description:
            "Hold the phone flat, tap to focus, use bright light, or type the text printed under the bars (PO labels are often Code 128).",
          variant: "destructive",
        })
        return
      }
      if (panelIndex !== null) {
        updatePanelBarcode(id, panelIndex, value)
      } else {
        updateRow(id, { barcode: value })
      }
      toast({ title: "Barcode scanned", description: value })
    } catch {
      toast({
        title: "Scan failed",
        description:
          "Try again with the barcode straight and in focus, or type the line under the bars from your PO.",
        variant: "destructive",
      })
    } finally {
      setScanningRowIds((prev) => ({ ...prev, [scanKey]: false }))
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Add one row per item. <strong>Solar PV Module</strong>: each of the 4 panels needs a <strong>serial or a barcode</strong> (either is enough), plus 4 photos.{" "}
          <strong>Inverter</strong>: serial <strong>or</strong> barcode (barcode alone is OK). <strong>Cables</strong> use length in meters. Kit items use quantity.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 border-solar text-solar-dark"
          onClick={loadAllBomMaterials}
        >
          <Package className="mr-2 h-4 w-4" />
          Load All Materials
        </Button>
      </div>

      <div className="space-y-3">
        {materials.map((m, index) => (
          <div
            key={m.id}
            className="rounded-lg border border-solar bg-solar-beige/50 p-4 shadow-sm"
          >
            {materialUsesPanelSerialSet(m.name) && (
              <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Panel set mode: for <strong>each of the 4 panels</strong>, enter a <strong>serial or a barcode</strong> (either satisfies that panel). Upload <strong>4 panel photos</strong>.
                <div className="mt-1 font-medium">
                  {`${[0, 1, 2, 3].filter((i) => panelSlotHasSerialOrBarcode(m, i)).length}/4 panels identified · ${(m.panelPhotoFiles ?? []).filter((f) => !!f).length}/4 photos`}
                </div>
              </div>
            )}
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Item {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => removeRow(m.id)}
                aria-label="Remove row"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid items-start gap-4 sm:grid-cols-3">
              <div className="min-w-0 sm:col-span-1">
                <Label className="text-foreground">Material type</Label>
                <Select
                  value={m.name || "__none__"}
                  onValueChange={(v) => {
                    const name = v === "__none__" ? "" : v
                    updateRow(m.id, {
                      name,
                      ...(materialUsesPanelSerialSet(name)
                        ? {
                            serialNumber: "",
                            lengthMeters: "",
                            barcode: "",
                            panelSerials: m.panelSerials ?? ["", "", "", ""],
                            panelPhotoFiles: m.panelPhotoFiles ?? [null, null, null, null],
                            panelBarcodes: m.panelBarcodes ?? ["", "", "", ""],
                          }
                        : materialUsesLengthInsteadOfSerial(name)
                          ? {
                              serialNumber: "",
                              barcode: "",
                              quantity: undefined,
                              panelSerials: ["", "", "", ""],
                              panelPhotoFiles: [null, null, null, null],
                              panelBarcodes: ["", "", "", ""],
                            }
                          : materialUsesQuantity(name)
                            ? {
                                serialNumber: "",
                                barcode: "",
                                lengthMeters: "",
                                quantity: Number(BOM_DEFAULT_QUANTITIES[name] ?? m.quantity ?? 1) || 1,
                                panelSerials: ["", "", "", ""],
                                panelPhotoFiles: [null, null, null, null],
                                panelBarcodes: ["", "", "", ""],
                              }
                          : {
                              lengthMeters: "",
                              quantity: undefined,
                              panelSerials: ["", "", "", ""],
                              panelPhotoFiles: [null, null, null, null],
                              panelBarcodes: ["", "", "", ""],
                            }),
                    })
                  }}
                >
                  <SelectTrigger className="mt-2 border-solar bg-background">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Select —</SelectItem>
                    {MATERIAL_NAME_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                    {m.name && !(MATERIAL_NAME_OPTIONS as readonly string[]).includes(m.name) && (
                      <SelectItem value={m.name}>{m.name}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                {materialUsesPanelSerialSet(m.name) ? (
                  <>
                    <Label className="text-foreground">Panel serials (or use barcodes column)</Label>
                    <div className="mt-2 grid gap-2">
                      {[0, 1, 2, 3].map((panelIdx) => (
                        <div key={`${m.id}-panel-serial-${panelIdx}`} className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Panel {panelIdx + 1} serial</Label>
                          <Input
                            value={m.panelSerials?.[panelIdx] ?? ""}
                            onChange={(e) => updatePanelSerial(m.id, panelIdx, e.target.value)}
                            className={cn(
                              "border-solar bg-background",
                              !panelSlotHasSerialOrBarcode(m, panelIdx) && "border-amber-400 focus-visible:ring-amber-400"
                            )}
                            placeholder={`Serial for panel ${panelIdx + 1} (optional if barcode set)`}
                            autoComplete="off"
                          />
                          {!panelSlotHasSerialOrBarcode(m, panelIdx) ? (
                            <p className="text-[11px] text-amber-700">Enter serial or barcode for this panel</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </>
                ) : materialUsesLengthInsteadOfSerial(m.name) ? (
                  <>
                    <Label className="text-foreground">Length (meters)</Label>
                    <Input
                      value={m.lengthMeters ?? ""}
                      onChange={(e) => updateRow(m.id, { lengthMeters: e.target.value })}
                      className="mt-2 border-solar bg-background"
                      placeholder="e.g. 15.5"
                      inputMode="decimal"
                      autoComplete="off"
                    />
                  </>
                ) : materialUsesQuantity(m.name) ? (
                  <div>
                    <Label className="text-foreground">Quantity</Label>
                    <Input
                      className="mt-2 border-solar"
                      type="number"
                      min={1}
                      value={m.quantity ?? 1}
                      onChange={(e) => updateRow(m.id, { quantity: parseInt(e.target.value) || 1 })}
                      placeholder="Enter quantity"
                    />
                  </div>
                ) : (
                  <>
                    <Label className="text-foreground">
                      {materialAllowsSerialOrBarcode(m.name) ? "Serial number (or barcode only →)" : "Serial number"}
                    </Label>
                    <Input
                      value={m.serialNumber}
                      onChange={(e) => updateRow(m.id, { serialNumber: e.target.value })}
                      className={cn(
                        "mt-2 border-solar bg-background",
                        materialAllowsSerialOrBarcode(m.name) &&
                          !m.serialNumber.trim() &&
                          !m.barcode.trim() &&
                          "border-amber-400 focus-visible:ring-amber-400"
                      )}
                      placeholder={
                        materialAllowsSerialOrBarcode(m.name)
                          ? "Serial (optional if barcode filled)"
                          : "Enter serial number"
                      }
                      autoComplete="off"
                    />
                    {materialAllowsSerialOrBarcode(m.name) && !m.serialNumber.trim() && !m.barcode.trim() ? (
                      <p className="mt-1 text-[11px] text-amber-700">Enter serial or barcode (one required)</p>
                    ) : null}
                  </>
                )}
              </div>
              <div>
                {materialUsesPanelSerialSet(m.name) ? (
                  <>
                    <Label className="text-foreground">Panel barcodes (optional if serial set)</Label>
                    <div className="mt-2 grid gap-2">
                      {[0, 1, 2, 3].map((panelIdx) => {
                        const scanKey = `${m.id}:${panelIdx}`
                        const scanning = !!scanningRowIds[scanKey]
                        return (
                          <div key={`${m.id}-panel-bc-${panelIdx}`} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Panel {panelIdx + 1} barcode</Label>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <Input
                                value={m.panelBarcodes?.[panelIdx] ?? ""}
                                onChange={(e) => updatePanelBarcode(m.id, panelIdx, e.target.value)}
                                className="border-solar bg-background sm:flex-1"
                                placeholder={`Enter or scan barcode for Panel ${panelIdx + 1}`}
                                autoComplete="off"
                              />
                              <input
                                id={`barcode-scan-camera-${m.id}-${panelIdx}`}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  void handleBarcodeImageScan(m.id, panelIdx, e.target.files?.[0] ?? null)
                                  e.target.value = ""
                                }}
                              />
                              <Button
                                type="button"
                                className="shrink-0 bg-solar-yellow text-foreground hover:bg-solar-yellow/90 sm:w-auto"
                                onClick={() => document.getElementById(`barcode-scan-camera-${m.id}-${panelIdx}`)?.click()}
                                disabled={scanning}
                              >
                                {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                                Scan camera
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Use when you do not have the serial, or to double-scan. Each panel still needs serial <strong>or</strong> barcode.
                    </p>
                  </>
                ) : (
                  <>
                    <Label className="text-foreground">
                      {materialAllowsSerialOrBarcode(m.name) ? "Barcode (or serial only ←)" : "Barcode"}
                    </Label>
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={m.barcode}
                        onChange={(e) => updateRow(m.id, { barcode: e.target.value })}
                        className={cn(
                          "border-solar bg-background",
                          materialAllowsSerialOrBarcode(m.name) &&
                            !m.serialNumber.trim() &&
                            !m.barcode.trim() &&
                            "border-amber-400 focus-visible:ring-amber-400"
                        )}
                        placeholder="Enter or scan barcode"
                        autoComplete="off"
                      />
                    </div>
                    <input
                      id={`barcode-scan-camera-${m.id}-single`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        void handleBarcodeImageScan(m.id, null, e.target.files?.[0] ?? null)
                        e.target.value = ""
                      }}
                    />
                    <div className="mt-2">
                      <Button
                        type="button"
                        className="bg-solar-yellow text-foreground hover:bg-solar-yellow/90"
                        onClick={() => document.getElementById(`barcode-scan-camera-${m.id}-single`)?.click()}
                        disabled={!!scanningRowIds[`${m.id}:single`]}
                      >
                        {scanningRowIds[`${m.id}:single`] ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="mr-2 h-4 w-4" />
                        )}
                        Scan camera
                      </Button>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {materialAllowsSerialOrBarcode(m.name)
                        ? "For inverter: barcode alone counts — no serial needed."
                        : "Optional — use camera to scan barcode."}
                    </p>
                  </>
                )}
              </div>
            </div>
            {!materialUsesPanelSerialSet(m.name) && (
              <div className="mt-4 max-w-xl">
                <Label className="text-foreground">Material photo (optional)</Label>
                <div className="mt-2">
                  <InlineImagePreview
                    file={m.photoFile ?? null}
                    savedDisplayUrl={
                      materialPhotoDisplayUrls[`mat-${m.id}-evidence`] ??
                      (typeof m.photo?.url === "string" && m.photo.url.trim()
                        ? rewriteStorageUrl(m.photo.url.trim())
                        : undefined)
                    }
                    alt={`${m.name || "Material"} photo`}
                    placeholder="No material photo"
                    busy={!!compressingPhotoKeys[`photo:${m.id}`]}
                  />
                </div>
                <input
                  id={`material-photo-camera-${m.id}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const raw = e.target.files?.[0] ?? null
                    e.target.value = ""
                    void setCompressedMaterialPhoto(m.id, raw)
                  }}
                />
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    type="button"
                    className="bg-solar-yellow text-foreground hover:bg-solar-yellow/90"
                    onClick={() => document.getElementById(`material-photo-camera-${m.id}`)?.click()}
                    disabled={!!compressingPhotoKeys[`photo:${m.id}`]}
                  >
                    {compressingPhotoKeys[`photo:${m.id}`] ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="mr-2 h-4 w-4" />
                    )}
                    Camera
                  </Button>
                </div>
                {m.photoFile ? (
                  <p className="mt-1 text-xs text-green-700">{m.photoFile.name}</p>
                ) : null}
              </div>
            )}
            {materialUsesPanelSerialSet(m.name) ? (
              <div className="mt-4">
                <Label className="text-foreground">Panel photos (4)</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((panelIdx) => {
                    const panelUrlStr = m.panelPhotos?.[panelIdx]?.url
                    const panelTrimmed = typeof panelUrlStr === "string" ? panelUrlStr.trim() : ""
                    const panelSavedDisplay =
                      materialPhotoDisplayUrls[`mat-${m.id}-panel-${panelIdx}`] ??
                      (panelTrimmed ? rewriteStorageUrl(panelTrimmed) : undefined)
                    return (
                    <div
                      key={`${m.id}-panel-photo-${panelIdx}`}
                      className={cn(
                        "rounded-md border border-solar p-2",
                        !m.panelPhotoFiles?.[panelIdx] && "border-amber-400 bg-amber-50/40"
                      )}
                    >
                      <p className="mb-1 text-xs text-muted-foreground">Panel {panelIdx + 1} photo</p>
                      <InlineImagePreview
                        file={m.panelPhotoFiles?.[panelIdx] ?? null}
                        savedDisplayUrl={panelSavedDisplay}
                        alt={`${m.name || "Panel"} ${panelIdx + 1}`}
                        placeholder={`Panel ${panelIdx + 1} photo`}
                        busy={!!compressingPhotoKeys[`panel:${m.id}:${panelIdx}`]}
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        ID:{" "}
                        {(m.panelSerials?.[panelIdx] ?? "").trim() ||
                          (m.panelBarcodes?.[panelIdx] ?? "").trim() ||
                          "Add serial or barcode above"}
                      </p>
                      <input
                        id={`panel-photo-camera-${m.id}-${panelIdx}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const raw = e.target.files?.[0] ?? null
                          e.target.value = ""
                          void setCompressedPanelPhoto(m.id, panelIdx, raw)
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          className="bg-solar-yellow text-foreground hover:bg-solar-yellow/90"
                          onClick={() => document.getElementById(`panel-photo-camera-${m.id}-${panelIdx}`)?.click()}
                          disabled={!!compressingPhotoKeys[`panel:${m.id}:${panelIdx}`]}
                        >
                          {compressingPhotoKeys[`panel:${m.id}:${panelIdx}`] ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Camera className="mr-2 h-4 w-4" />
                          )}
                          Camera
                        </Button>
                      </div>
                      {m.panelPhotoFiles?.[panelIdx] ? (
                        <p className="mt-1 text-xs text-green-700">{m.panelPhotoFiles[panelIdx]?.name}</p>
                      ) : (
                        <p className="mt-1 text-[11px] text-amber-700">Required</p>
                      )}
                    </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full border-solar border-dashed"
        onClick={addRow}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add material line
      </Button>
    </div>
  )
}
