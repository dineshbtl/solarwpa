"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Plus, Trash2, Upload } from "lucide-react"
import { useFormDraft } from "@/lib/store/use-form-draft"
import { DraftBanner } from "@/components/draft-banner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { createInward, listInwards, listMaterialDefinitions } from "@/lib/supabase/warehouse"
import { definitionsByMaterialKey, validateBarcodeCoverage } from "@/lib/inventory/stock-validation"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { preparePhotoWithGpsStamp } from "@/lib/photo-gps-stamp"
import type { MaterialDefinition } from "@/lib/supabase/warehouse"
import type { WarehouseItem } from "@/lib/store/warehouse"

const today = new Date().toISOString().split("T")[0]
const PHOTO_BUCKET = "solar_bucket"
/** Radix Select must not use value="" — use a sentinel for "no material chosen yet". */
const MATERIAL_SELECT_NONE = "__material_none__"

interface InwardItemRow {
  id: string
  materialName: string
  quantity: string
  unit: string
  serialNos: string[]
  serialText: string
  importFileName?: string
  importInputKey: string
}

function newItemRow(): InwardItemRow {
  const id = crypto.randomUUID()
  return {
    id,
    materialName: "",
    quantity: "",
    unit: "Nos",
    serialNos: [],
    serialText: "",
    importInputKey: `${id}-input-0`,
  }
}

function parseSerialText(input: string): string[] {
  return [...new Set(input.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))]
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120)
}

async function parseSerialsFromExcel(file: File): Promise<string[]> {
  const XLSX = await import("xlsx")
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: "array" })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: false })
  const values = rows
    .flatMap((r) => r)
    .map((v) => (v ?? "").toString().trim())
    .filter(Boolean)
  return [...new Set(values)]
}

export default function NewInwardPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [materials, setMaterials] = useState<MaterialDefinition[]>([])
  const [materialsLoading, setMaterialsLoading] = useState(true)

  const [inwardDate, setInwardDate] = useState(today)
  const [warehouseId, setWarehouseId] = useState("WH-002")
  const [poNumber, setPoNumber] = useState("")
  const [refNo, setRefNo] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<InwardItemRow[]>([newItemRow()])
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [existingSerialMap, setExistingSerialMap] = useState<Record<string, Record<string, { inwardId: string; serial: string }>>>({})

  // Persist text fields only (photoFile is intentionally excluded — File objects can't be serialised
  // and re-attach is cheap).
  const draftPayload = useMemo(
    () => ({ inwardDate, warehouseId, poNumber, refNo, supplierName, notes, items }),
    [inwardDate, warehouseId, poNumber, refNo, supplierName, notes, items],
  )
  const inwardDraft = useFormDraft<typeof draftPayload>("warehouse.inward.new", draftPayload)
  const [draftBannerOpen, setDraftBannerOpen] = useState(false)
  const [draftBannerSavedAt, setDraftBannerSavedAt] = useState<string | null>(null)
  const draftCheckedRef = useRef(false)

  useEffect(() => {
    if (draftCheckedRef.current) return
    draftCheckedRef.current = true
    if (inwardDraft.hasDraft()) {
      setDraftBannerSavedAt(inwardDraft.peekSavedAt())
      setDraftBannerOpen(true)
    }
  }, [inwardDraft])

  const handleRestoreDraft = () => {
    const d = inwardDraft.restore()
    if (d) {
      setInwardDate(d.inwardDate ?? today)
      setWarehouseId(d.warehouseId ?? "WH-002")
      setPoNumber(d.poNumber ?? "")
      setRefNo(d.refNo ?? "")
      setSupplierName(d.supplierName ?? "")
      setNotes(d.notes ?? "")
      if (Array.isArray(d.items) && d.items.length > 0) setItems(d.items)
    }
    setDraftBannerOpen(false)
    toast({ title: "Draft restored", description: "Re-attach the photo before saving if needed." })
  }

  const handleDiscardDraft = () => {
    inwardDraft.clear()
    setDraftBannerOpen(false)
  }

  useEffect(() => {
    let cancelled = false
    setMaterialsLoading(true)
    void listMaterialDefinitions()
      .then((defs) => {
        if (!cancelled) setMaterials(defs)
      })
      .catch((err) => {
        if (!cancelled) {
          toast({
            title: "Could not load materials",
            description: err instanceof Error ? err.message : "Please refresh the page.",
            variant: "destructive",
          })
        }
      })
      .finally(() => {
        if (!cancelled) setMaterialsLoading(false)
      })

    void listInwards()
      .then((inwards) => {
        if (cancelled) return
        const nextMap: Record<string, Record<string, { inwardId: string; serial: string }>> = {}
        for (const inward of inwards) {
          for (const item of inward.items ?? []) {
            const materialKey = normalizeKey(item.name ?? "")
            if (!materialKey) continue
            if (!nextMap[materialKey]) nextMap[materialKey] = {}
            for (const serial of item.serialNos ?? []) {
              const serialKey = normalizeKey(serial)
              if (!serialKey) continue
              if (!nextMap[materialKey][serialKey]) {
                nextMap[materialKey][serialKey] = { inwardId: inward.id, serial: serial.trim() }
              }
            }
          }
        }
        setExistingSerialMap(nextMap)
      })
      .catch((err) => {
        toast({
          title: "Could not load existing serial numbers",
          description: err instanceof Error ? err.message : "Duplicate-serial hints may be incomplete until you refresh.",
          variant: "destructive",
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const addRow = () => setItems((prev) => [...prev, newItemRow()])
  const removeRow = (id: string) => {
    setItems((prev) => {
      if (prev.length > 1) return prev.filter((r) => r.id !== id)
      return prev.map((r) =>
        r.id === id
          ? {
              id: r.id,
              materialName: "",
              quantity: "",
              unit: "Nos",
              serialNos: [],
              serialText: "",
              importFileName: undefined,
              importInputKey: `${r.id}-input-${Date.now()}`,
            }
          : r
      )
    })
  }

  const updateRow = (id: string, patch: Partial<InwardItemRow>) => {
    setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const handleImportSerials = async (id: string, file: File) => {
    try {
      const serials = await parseSerialsFromExcel(file)
      if (serials.length === 0) {
        toast({ title: "No serials found", description: "Excel file appears empty.", variant: "destructive" })
        return
      }
      updateRow(id, { serialNos: serials, serialText: serials.join("\n"), quantity: String(serials.length), importFileName: file.name })
      toast({ title: "Serials imported", description: `${serials.length} serial numbers loaded.` })
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Could not parse Excel file.",
        variant: "destructive",
      })
    }
  }

  const clearImportAttachment = (id: string) => {
    setItems((prev) =>
      prev.map((row) =>
        row.id === id
          ? { ...row, importFileName: undefined, importInputKey: `${row.id}-input-${Date.now()}` }
          : row
      )
    )
  }

  const uploadPhotoIfAny = async (): Promise<{ photoUrl?: string; photoGps?: { latitude: number; longitude: number; source?: "exif" } }> => {
    if (!photoFile) return {}
    const sb = getSupabaseBrowserClient()
    const prepared = await preparePhotoWithGpsStamp(photoFile, { exifGpsOnly: true })
    const fileToUpload = prepared.file
    const key = `warehouse-inward/${Date.now()}_${sanitizeFileName(photoFile.name)}`
    const contentType = fileToUpload.type && fileToUpload.type.startsWith("image/") ? fileToUpload.type : "image/jpeg"
    const { error } = await sb.storage.from(PHOTO_BUCKET).upload(key, fileToUpload, {
      cacheControl: "3600",
      upsert: true,
      contentType,
    })
    if (error) throw new Error(`Photo upload failed: ${error.message}`)
    const { data } = sb.storage.from(PHOTO_BUCKET).getPublicUrl(key)
    return {
      photoUrl: data.publicUrl,
      photoGps: prepared.gps
        ? {
            latitude: prepared.gps.latitude,
            longitude: prepared.gps.longitude,
            source: prepared.gps.source === "exif" ? "exif" : undefined,
          }
        : undefined,
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!poNumber.trim()) {
      toast({ title: "PO number is required", variant: "destructive" })
      return
    }

    const validRows = items.filter((r) => r.materialName.trim() && Number(r.quantity) > 0)
    const duplicateSerialCount = validRows.reduce((count, row) => {
      const materialKey = normalizeKey(row.materialName)
      const serialLookup = existingSerialMap[materialKey] ?? {}
      return count + row.serialNos.filter((s) => !!serialLookup[normalizeKey(s)]).length
    }, 0)
    if (duplicateSerialCount > 0) {
      toast({
        title: "Duplicate serial numbers found",
        description: "Remove duplicate serials highlighted in red before saving.",
        variant: "destructive",
      })
      return
    }

    if (validRows.length === 0) {
      toast({ title: "Add at least one valid item", variant: "destructive" })
      return
    }

    const payloadItems: WarehouseItem[] = validRows.map((r) => {
      const serials = r.serialNos
      const item: WarehouseItem = {
        name: r.materialName.trim(),
        qty: Number(r.quantity),
        unit: r.unit || "Nos",
        serialNos: serials.length > 0 ? serials : undefined,
      }
      return item
    })

    try {
      validateBarcodeCoverage(payloadItems, definitionsByMaterialKey(materials))
    } catch (err) {
      toast({
        title: "Barcode validation",
        description: err instanceof Error ? err.message : "Fix barcode lines and retry.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const media = await uploadPhotoIfAny()
      await createInward({
        warehouseId,
        inwardDate,
        poNumber: poNumber.trim(),
        refNo: refNo.trim() || undefined,
        supplierName: supplierName.trim() || undefined,
        items: payloadItems,
        notes: notes.trim() || undefined,
        photoUrl: media.photoUrl,
        photoGps: media.photoGps,
      })
      inwardDraft.clear()
      toast({ title: "Inward created", description: "Stock received entry saved." })
      router.push("/warehouse/inward")
    } catch (err) {
      toast({
        title: "Could not create inward",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full px-3 py-4 pb-28 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <main className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-3 sm:px-4">
          <Link href="/warehouse/inward">
            <Button variant="ghost" className="text-foreground hover:bg-accent">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Inward
            </Button>
          </Link>
          <Button type="submit" form="inward-form" disabled={isSubmitting} className="hidden min-w-[170px] bg-green-600 text-white hover:bg-green-700 sm:inline-flex">
            <Loader2 className={`h-4 w-4 animate-spin ${isSubmitting ? "mr-2 inline-flex" : "hidden"}`} />
            <span>{isSubmitting ? "Saving..." : "Save Inward"}</span>
          </Button>
        </div>

        <h1 className="mb-5 text-xl font-bold text-foreground sm:mb-6 sm:text-2xl">New Material Inward</h1>

        {draftBannerOpen ? (
          <div className="mb-4">
            <DraftBanner
              savedAt={draftBannerSavedAt}
              onRestore={handleRestoreDraft}
              onDiscard={handleDiscardDraft}
              hint="Re-attach the photo after restoring if you had one selected."
            />
          </div>
        ) : null}

        <form id="inward-form" onSubmit={onSubmit} className="space-y-6">
          <Card className="border-border bg-card shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg">Inward Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Inward Date *</Label>
                <Input type="date" value={inwardDate} onChange={(e) => setInwardDate(e.target.value)} className="mt-2" required />
              </div>
              <div>
                <Label>Warehouse</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WH-001">Hyderabad Central Store</SelectItem>
                    <SelectItem value="WH-002">Kurnool Central Warehouse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>PO Number *</Label>
                <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="e.g. PO-2026-032" className="mt-2" required />
              </div>
              <div>
                <Label>Reference No</Label>
                <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="Supplier challan / GRN ref" className="mt-2" />
              </div>
              <div className="md:col-span-2">
                <Label>Supplier Name</Label>
                <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Supplier name (optional)" className="mt-2" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-lg">Items</CardTitle>
              <Button type="button" variant="outline" onClick={addRow} className="shrink-0">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((row) => (
                (() => {
                  const serialLookup = existingSerialMap[normalizeKey(row.materialName)] ?? {}
                  const duplicateSerials = row.serialNos
                    .map((serial) => ({ serial, match: serialLookup[normalizeKey(serial)] }))
                    .filter((x) => !!x.match) as Array<{ serial: string; match: { inwardId: string; serial: string } }>
                  return (
                <div key={row.id} className="grid gap-3 rounded-lg border border-border p-3 sm:p-4 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <Label>Material</Label>
                    <Select
                      disabled={materialsLoading}
                      value={row.materialName.trim() ? row.materialName : MATERIAL_SELECT_NONE}
                      onValueChange={(v) => {
                        const name = v === MATERIAL_SELECT_NONE ? "" : v
                        const selected = materials.find((m) => m.name === name)
                        updateRow(row.id, { materialName: name, unit: selected?.unit || "Nos" })
                      }}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder={materialsLoading ? "Loading materials…" : "Select material"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={MATERIAL_SELECT_NONE}>
                          {materialsLoading ? "Loading…" : "Select material"}
                        </SelectItem>
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={m.name}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Qty</Label>
                    <Input type="number" min="0" value={row.quantity} onChange={(e) => updateRow(row.id, { quantity: e.target.value })} className="mt-2" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Unit</Label>
                    <Input value={row.unit} onChange={(e) => updateRow(row.id, { unit: e.target.value })} className="mt-2" />
                  </div>
                  <div className="md:col-span-3">
                    <Label>Serial numbers</Label>
                    <Input
                      key={row.importInputKey}
                      className="mt-2"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void handleImportSerials(row.id, file)
                      }}
                    />
                    {row.importFileName && (
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-muted-foreground">{row.importFileName}</span>
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-red-600" onClick={() => clearImportAttachment(row.id)}>
                          Remove file
                        </Button>
                      </div>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.serialNos.length > 0 ? `${row.serialNos.length} serials imported` : "Excel/CSV: one serial per cell or row"}
                    </p>
                    <Textarea
                      className="mt-2 min-h-[100px] max-h-40 resize-y overflow-y-auto font-mono text-sm"
                      placeholder="Serial numbers — one per line (paste, import, or wedge scanner). Barcodes optional; use this same box if you scan labels."
                      value={row.serialText}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.stopPropagation()
                      }}
                      onChange={(e) => {
                        const nextText = e.target.value
                        const serials = parseSerialText(nextText)
                        updateRow(row.id, { serialText: nextText, serialNos: serials, quantity: serials.length > 0 ? String(serials.length) : row.quantity })
                      }}
                    />
                    {duplicateSerials.length > 0 && (
                      <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        <p className="font-medium">Serial already exists for this material:</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          {duplicateSerials.map(({ serial, match }) => (
                            <Link key={`${row.id}-${serial}`} href={`/warehouse/inward/${match.inwardId}`} className="underline underline-offset-2">
                              {serial} ({match.inwardId})
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-1 flex items-end justify-end md:justify-start">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(row.id)} className="text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                  )
                })()
              ))}
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg">Photo (optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Upload photo (optional)</Label>
                <Input
                  id="inward-photo-input"
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => document.getElementById("inward-photo-input")?.click()}>
                    Camera / Gallery
                  </Button>
                </div>
                {photoFile && (
                  <div className="mt-2 flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs">
                    <span className="truncate">{photoFile.name}</span>
                    <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => setPhotoFile(null)}>
                      Remove
                    </Button>
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional: not required to save. GPS is taken from the photo file (EXIF) when present; we do not wait on
                  device location so saving stays fast.
                </p>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-2" placeholder="Any inward notes..." />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Upload className="h-3.5 w-3.5" />
                Serial-based items and quantity-based kit items can be entered together.
              </div>
            </CardContent>
          </Card>

          <div className="hidden justify-end gap-3 sm:flex">
            <Link href="/warehouse/inward">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={isSubmitting} className="min-w-[170px] bg-green-600 text-white hover:bg-green-700">
              <Loader2 className={`h-4 w-4 animate-spin ${isSubmitting ? "mr-2 inline-flex" : "hidden"}`} />
              <span>{isSubmitting ? "Saving..." : "Save Inward"}</span>
            </Button>
          </div>
        </form>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-6xl gap-2">
          <Link href="/warehouse/inward" className="flex-1">
            <Button type="button" variant="outline" className="w-full">Cancel</Button>
          </Link>
          <Button type="submit" form="inward-form" disabled={isSubmitting} className="flex-1 bg-green-600 text-white hover:bg-green-700">
            <Loader2 className={`h-4 w-4 animate-spin ${isSubmitting ? "mr-2 inline-flex" : "hidden"}`} />
            <span>{isSubmitting ? "Saving..." : "Save"}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
