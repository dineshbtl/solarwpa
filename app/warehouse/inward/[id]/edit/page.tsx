"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
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
import { getInwardById, listInwards, listMaterialDefinitions, updateInward } from "@/lib/supabase/warehouse"
import type { MaterialDefinition } from "@/lib/supabase/warehouse"
import type { WarehouseItem } from "@/lib/store/warehouse"

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

function createRowId(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function newItemRow(): InwardItemRow {
  const id = createRowId()
  return { id, materialName: "", quantity: "", unit: "Nos", serialNos: [], serialText: "", importInputKey: `${id}-input-0` }
}

function parseSerialText(input: string): string[] {
  return [...new Set(input.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))]
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

/** Radix Select must not use value="" — use a sentinel for "no material chosen yet". */
const MATERIAL_SELECT_NONE = "__material_none__"

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

export default function EditInwardPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [materials, setMaterials] = useState<MaterialDefinition[]>([])

  const [inwardDate, setInwardDate] = useState("")
  const [warehouseId, setWarehouseId] = useState("WH-002")
  const [poNumber, setPoNumber] = useState("")
  const [refNo, setRefNo] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<InwardItemRow[]>([newItemRow()])
  const [existingSerialMap, setExistingSerialMap] = useState<Record<string, Record<string, { inwardId: string; serial: string }>>>({})

  // Local draft keyed per-id so each inward has its own.
  const draftPayload = useMemo(
    () => ({ inwardDate, warehouseId, poNumber, refNo, supplierName, notes, items }),
    [inwardDate, warehouseId, poNumber, refNo, supplierName, notes, items],
  )
  const [draftEnabled, setDraftEnabled] = useState(false)
  const inwardDraft = useFormDraft<typeof draftPayload>(
    id ? `warehouse.inward.edit.${id}` : "warehouse.inward.edit.__unknown__",
    draftPayload,
    { enabled: draftEnabled && !!id },
  )
  const [draftBannerOpen, setDraftBannerOpen] = useState(false)
  const [draftBannerSavedAt, setDraftBannerSavedAt] = useState<string | null>(null)
  const draftCheckedRef = useRef(false)

  const handleRestoreDraft = () => {
    const d = inwardDraft.restore()
    if (d) {
      setInwardDate(d.inwardDate ?? "")
      setWarehouseId(d.warehouseId ?? "WH-002")
      setPoNumber(d.poNumber ?? "")
      setRefNo(d.refNo ?? "")
      setSupplierName(d.supplierName ?? "")
      setNotes(d.notes ?? "")
      if (Array.isArray(d.items) && d.items.length > 0) setItems(d.items)
    }
    setDraftBannerOpen(false)
    setDraftEnabled(true)
    toast({ title: "Draft restored" })
  }

  const handleDiscardDraft = () => {
    inwardDraft.clear()
    setDraftBannerOpen(false)
    setDraftEnabled(true)
  }

  useEffect(() => {
    if (!id) return
    // Hydrate from server exactly once per mount. inwardDraft must not be in deps —
    // it returns a new reference on every debounced write and would re-trigger the load.
    if (draftCheckedRef.current) return
    draftCheckedRef.current = true
    let cancelled = false
    void listMaterialDefinitions()
      .then((defs) => {
        if (!cancelled) setMaterials(defs)
      })
      .catch((err) => {
        if (!cancelled) {
          toast({
            title: "Could not load materials",
            description: err instanceof Error ? err.message : "Material dropdown may be incomplete.",
            variant: "destructive",
          })
        }
      })

    void getInwardById(id)
      .then((entry) => {
        if (cancelled) return
        if (!entry) {
          toast({ title: "Inward not found", variant: "destructive" })
          router.push("/warehouse/inward")
          return
        }
        setInwardDate(entry.inwardDate)
        setWarehouseId(entry.warehouseId ?? "WH-002")
        setPoNumber(entry.poNumber)
        setRefNo(entry.refNo ?? "")
        setSupplierName(entry.supplierName ?? "")
        setNotes(entry.notes ?? "")
        setItems(
          entry.items.length > 0
            ? entry.items.map((item) => ({
                id: createRowId(),
                materialName: item.name,
                quantity: String(item.qty),
                unit: item.unit ?? "Nos",
                serialNos: item.serialNos ?? [],
                serialText: (item.serialNos ?? []).join("\n"),
                importInputKey: `${createRowId()}-input-0`,
              }))
            : [newItemRow()]
        )
        if (inwardDraft.hasDraft()) {
          setDraftBannerSavedAt(inwardDraft.peekSavedAt())
          setDraftBannerOpen(true)
        } else {
          setDraftEnabled(true)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast({
            title: "Could not load inward",
            description: err instanceof Error ? err.message : "Please refresh.",
            variant: "destructive",
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // inwardDraft intentionally omitted — guarded by draftCheckedRef above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router])

  useEffect(() => {
    if (!id) return
    void listInwards()
      .then((inwards) => {
        const nextMap: Record<string, Record<string, { inwardId: string; serial: string }>> = {}
        for (const inward of inwards) {
          if (inward.id === id) continue
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
      .catch((err) =>
        toast({
          title: "Could not validate duplicate serials",
          description: err instanceof Error ? err.message : "Please refresh.",
          variant: "destructive",
        })
      )
  }, [id])

  const addRow = () => setItems((prev) => [...prev, newItemRow()])
  const removeRow = (rowId: string) => {
    setItems((prev) => {
      if (prev.length > 1) return prev.filter((r) => r.id !== rowId)
      return prev.map((r) =>
        r.id === rowId
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
  const updateRow = (rowId: string, patch: Partial<InwardItemRow>) => {
    setItems((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)))
  }

  const handleImportSerials = async (rowId: string, file: File) => {
    try {
      const serials = await parseSerialsFromExcel(file)
      if (serials.length === 0) {
        toast({ title: "No serials found", description: "Excel file appears empty.", variant: "destructive" })
        return
      }
      updateRow(rowId, { serialNos: serials, serialText: serials.join("\n"), quantity: String(serials.length), importFileName: file.name })
      toast({ title: "Serials imported", description: `${serials.length} serial numbers loaded.` })
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Could not parse Excel file.",
        variant: "destructive",
      })
    }
  }

  const materialNamesNotInMaster = useMemo(() => {
    const out = new Set<string>()
    for (const row of items) {
      const n = row.materialName.trim()
      if (!n) continue
      if (!materials.some((m) => m.name === n)) out.add(n)
    }
    return [...out].sort((a, b) => a.localeCompare(b))
  }, [items, materials])

  const clearImportAttachment = (rowId: string) => {
    setItems((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? { ...row, importFileName: undefined, importInputKey: `${row.id}-input-${Date.now()}` }
          : row
      )
    )
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

    const payloadItems: WarehouseItem[] = validRows.map((r) => ({
      name: r.materialName.trim(),
      qty: Number(r.quantity),
      unit: r.unit || "Nos",
      serialNos: r.serialNos.length > 0 ? r.serialNos : undefined,
    }))

    setIsSubmitting(true)
    try {
      await updateInward(id, {
        warehouseId,
        inwardDate,
        poNumber: poNumber.trim(),
        refNo: refNo.trim() || undefined,
        supplierName: supplierName.trim() || undefined,
        items: payloadItems,
        notes: notes.trim() || undefined,
      })
      inwardDraft.clear()
      toast({ title: "Inward updated", description: "Changes have been saved." })
      router.push(`/warehouse/inward/${id}`)
    } catch (err) {
      toast({
        title: "Could not update inward",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="w-full px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-5xl space-y-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full px-3 py-4 pb-28 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <main className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 px-4 py-3">
          <Link href={`/warehouse/inward/${id}`}>
            <Button variant="ghost" className="text-foreground hover:bg-accent">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Details
            </Button>
          </Link>
          <Button type="submit" form="inward-edit-form" disabled={isSubmitting} className="hidden min-w-[170px] bg-green-600 text-white hover:bg-green-700 sm:inline-flex">
            <Loader2 className={`h-4 w-4 animate-spin ${isSubmitting ? "mr-2 inline-flex" : "hidden"}`} />
            <span>{isSubmitting ? "Saving..." : "Save Changes"}</span>
          </Button>
        </div>

        <h1 className="mb-5 text-xl font-bold text-foreground sm:mb-6 sm:text-2xl">Edit Material Inward</h1>

        {draftBannerOpen ? (
          <div className="mb-4">
            <DraftBanner
              savedAt={draftBannerSavedAt}
              onRestore={handleRestoreDraft}
              onDiscard={handleDiscardDraft}
              hint=""
            />
          </div>
        ) : null}

        <form id="inward-edit-form" onSubmit={onSubmit} className="space-y-6">
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
                <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="mt-2" required />
              </div>
              <div>
                <Label>Reference No</Label>
                <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} className="mt-2" />
              </div>
              <div className="md:col-span-2">
                <Label>Supplier Name</Label>
                <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="mt-2" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-lg">Items</CardTitle>
              <Button type="button" variant="outline" onClick={addRow}>
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
                      value={row.materialName.trim() ? row.materialName : MATERIAL_SELECT_NONE}
                      onValueChange={(v) => {
                        const name = v === MATERIAL_SELECT_NONE ? "" : v
                        const selected = materials.find((m) => m.name === name)
                        updateRow(row.id, { materialName: name, unit: selected?.unit || "Nos" })
                      }}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder={materials.length === 0 ? "Loading materials…" : "Select material"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={MATERIAL_SELECT_NONE}>
                          {materials.length === 0 ? "Loading…" : "Select material"}
                        </SelectItem>
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={m.name}>
                            {m.name}
                          </SelectItem>
                        ))}
                        {materialNamesNotInMaster.map((n) => (
                          <SelectItem key={`legacy-${n}`} value={n}>
                            {n} (not in master)
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
                    <Label>Import Serial Numbers</Label>
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
                      className="mt-2 h-24 min-h-0 max-h-24 resize-none overflow-y-auto"
                      placeholder="Paste serials manually (one per line)"
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
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-2" placeholder="Any inward notes..." />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Upload className="h-3.5 w-3.5" />
                You can update serial imports and quantities before saving.
              </div>
            </CardContent>
          </Card>
          <div className="hidden justify-end gap-3 sm:flex">
            <Link href={`/warehouse/inward/${id}`}>
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={isSubmitting} className="min-w-[170px] bg-green-600 text-white hover:bg-green-700">
              <Loader2 className={`h-4 w-4 animate-spin ${isSubmitting ? "mr-2 inline-flex" : "hidden"}`} />
              <span>{isSubmitting ? "Saving..." : "Save Changes"}</span>
            </Button>
          </div>
        </form>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-6xl gap-2">
          <Link href={`/warehouse/inward/${id}`} className="flex-1">
            <Button type="button" variant="outline" className="w-full">Cancel</Button>
          </Link>
          <Button type="submit" form="inward-edit-form" disabled={isSubmitting} className="flex-1 bg-green-600 text-white hover:bg-green-700">
            <Loader2 className={`h-4 w-4 animate-spin ${isSubmitting ? "mr-2 inline-flex" : "hidden"}`} />
            <span>{isSubmitting ? "Saving..." : "Save"}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
