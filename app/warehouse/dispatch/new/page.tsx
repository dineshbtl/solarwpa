"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useFormDraft } from "@/lib/store/use-form-draft"
import { DraftBanner } from "@/components/draft-banner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import {
  createDispatch,
  getWarehouseStockBalances,
  listDispatches,
  listInwards,
  listMaterialDefinitions,
  listReturns,
  listSupplierReturns,
  listWarehouses,
} from "@/lib/supabase/warehouse"
import { buildAvailableSerialsAtWarehouse, normalizeMaterial } from "@/lib/inventory/stock-validation"
import {
  DEFAULT_WAREHOUSE_ID,
  DEFAULT_WAREHOUSES,
  type MaterialDispatch,
  type MaterialInward,
  type MaterialReturn,
  type SupplierMaterialReturn,
  type Warehouse,
  type WarehouseItem,
} from "@/lib/store/warehouse"
import type { MaterialDefinition } from "@/lib/supabase/warehouse"

type StockFlowSnapshot = {
  inwards: MaterialInward[]
  dispatches: MaterialDispatch[]
  returns: MaterialReturn[]
  supplierRmas: SupplierMaterialReturn[]
}

const VEHICLE_TYPES = ["Tempo", "Pickup", "Truck", "Auto"]

const today = new Date().toISOString().split("T")[0]

interface ItemRow {
  id: string
  materialName: string
  quantity: string
  unit: string
  serialNos: string
}

function newItemRow(): ItemRow {
  return { id: crypto.randomUUID(), materialName: "", quantity: "", unit: "Nos", serialNos: "" }
}

function parseSerialInput(input: string): string[] {
  return [...new Set(input.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))]
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeDriverMobileInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10)
}

function getNextDcNumberFromList(dcNumbers: string[]): string {
  let max = 0
  for (const dc of dcNumbers) {
    const m = /^DC-(\d+)$/.exec(dc.trim())
    if (m) max = Math.max(max, Number.parseInt(m[1], 10))
  }
  return `DC-${(max + 1).toString().padStart(3, "0")}`
}

export default function NewDispatchPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Section 1 — DC Details
  const [dcNumber, setDcNumber] = useState("")
  const [dispatchDate, setDispatchDate] = useState(today)

  // Section 2 — Vehicle Details
  const [vehicleNo, setVehicleNo] = useState("")
  const [driverName, setDriverName] = useState("")
  const [driverMobile, setDriverMobile] = useState("")
  const [vehicleType, setVehicleType] = useState("Tempo")
  const [fromLocation, setFromLocation] = useState("Kurnool Central Warehouse")
  const [toLocation, setToLocation] = useState("")

  // Section 3 — Items
  const [items, setItems] = useState<ItemRow[]>([newItemRow()])
  const [materialOptions, setMaterialOptions] = useState<MaterialDefinition[]>([])
  const [availableSerialsByMaterial, setAvailableSerialsByMaterial] = useState<Record<string, string[]>>({})
  const [availableQtyByMaterial, setAvailableQtyByMaterial] = useState<Record<string, number>>({})
  const [serialSearchByRow, setSerialSearchByRow] = useState<Record<string, string>>({})
  const [stockFlow, setStockFlow] = useState<StockFlowSnapshot | null>(null)

  // Section 4 — Notes
  const [notes, setNotes] = useState("")
  // Render the dropdown immediately with seeded options; we refresh from DB in the background.
  const [warehouseOptions, setWarehouseOptions] = useState<Warehouse[]>(DEFAULT_WAREHOUSES)
  /** Dispatch source warehouse — serial validation uses this location (default: Kurnool). */
  const [warehouseId, setWarehouseId] = useState<string>(DEFAULT_WAREHOUSE_ID)

  // Persist text fields so a hung save / refresh doesn't drop a long DC entry.
  const draftPayload = useMemo(
    () => ({
      dcNumber,
      dispatchDate,
      vehicleNo,
      driverName,
      driverMobile,
      vehicleType,
      fromLocation,
      toLocation,
      items,
      notes,
      warehouseId,
    }),
    [
      dcNumber,
      dispatchDate,
      vehicleNo,
      driverName,
      driverMobile,
      vehicleType,
      fromLocation,
      toLocation,
      items,
      notes,
      warehouseId,
    ],
  )
  const dispatchDraft = useFormDraft<typeof draftPayload>("warehouse.dispatch.new", draftPayload)
  const [draftBannerOpen, setDraftBannerOpen] = useState(false)
  const [draftBannerSavedAt, setDraftBannerSavedAt] = useState<string | null>(null)
  const draftCheckedRef = useRef(false)

  useEffect(() => {
    if (draftCheckedRef.current) return
    draftCheckedRef.current = true
    if (dispatchDraft.hasDraft()) {
      setDraftBannerSavedAt(dispatchDraft.peekSavedAt())
      setDraftBannerOpen(true)
    }
  }, [dispatchDraft])

  const handleRestoreDraft = () => {
    const d = dispatchDraft.restore()
    if (d) {
      setDcNumber(d.dcNumber ?? "")
      setDispatchDate(d.dispatchDate ?? today)
      setVehicleNo(d.vehicleNo ?? "")
      setDriverName(d.driverName ?? "")
      setDriverMobile(d.driverMobile ?? "")
      setVehicleType(d.vehicleType ?? "Tempo")
      setFromLocation(d.fromLocation ?? "Kurnool Central Warehouse")
      setToLocation(d.toLocation ?? "")
      if (Array.isArray(d.items) && d.items.length > 0) setItems(d.items)
      setNotes(d.notes ?? "")
      setWarehouseId(d.warehouseId ?? DEFAULT_WAREHOUSE_ID)
    }
    setDraftBannerOpen(false)
    toast({ title: "Draft restored" })
  }

  const handleDiscardDraft = () => {
    dispatchDraft.clear()
    setDraftBannerOpen(false)
  }

  useEffect(() => {
    let cancelled = false
    void listWarehouses()
      .then((rows) => {
        if (cancelled || !rows?.length) return
        setWarehouseOptions(rows)
      })
      .catch(() => {
        /* keep seeded fallback list */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (warehouseOptions.length === 0) return
    setWarehouseId((current) =>
      warehouseOptions.some((w) => w.id === current)
        ? current
        : warehouseOptions.find((w) => w.id === DEFAULT_WAREHOUSE_ID)?.id ?? warehouseOptions[0].id
    )
  }, [warehouseOptions])

  useEffect(() => {
    void Promise.all([
      listMaterialDefinitions(),
      listInwards(),
      listDispatches(),
      listReturns(),
      listSupplierReturns(),
    ])
      .then(([materials, inwards, dispatches, returnsData, supplierRmas]) => {
        setMaterialOptions(materials)
        setDcNumber(getNextDcNumberFromList(dispatches.map((d) => d.dcNumber)))
        setStockFlow({ inwards, dispatches, returns: returnsData, supplierRmas })
      })
      .catch(() => {
        toast({
          title: "Material master unavailable",
          description: "Could not load material/serial availability. Please try again.",
          variant: "destructive",
        })
      })
  }, [])

  useEffect(() => {
    if (!stockFlow) return
    const { inwards, dispatches, returns, supplierRmas } = stockFlow
    const avail = buildAvailableSerialsAtWarehouse(
      warehouseId,
      inwards,
      dispatches,
      returns,
      supplierRmas.map((r) => ({ fromWarehouseId: r.fromWarehouseId, items: r.items }))
    )
    const availableMap: Record<string, string[]> = {}
    for (const m of materialOptions) {
      const k = normalizeKey(m.name)
      const set = avail.get(normalizeMaterial(m.name))
      availableMap[k] = set ? [...set].sort((a, b) => a.localeCompare(b)) : []
    }
    for (const [matNorm, set] of avail.entries()) {
      if (availableMap[matNorm] === undefined) {
        availableMap[matNorm] = [...set].sort((a, b) => a.localeCompare(b))
      }
    }
    setAvailableSerialsByMaterial(availableMap)

    void getWarehouseStockBalances(warehouseId)
      .then((rows) => {
        const qtyMap: Record<string, number> = {}
        for (const row of rows) {
          qtyMap[normalizeKey(row.material)] = row.qty
        }
        setAvailableQtyByMaterial(qtyMap)
      })
      .catch(() => {
        setAvailableQtyByMaterial({})
      })
  }, [stockFlow, warehouseId, materialOptions])

  const addItem = () => setItems((prev) => [...prev, newItemRow()])

  const updateItem = (id: string, field: keyof ItemRow, value: string) => {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const removeItem = (id: string) => {
    setSerialSearchByRow((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setItems((prev) => {
      if (prev.length > 1) return prev.filter((r) => r.id !== id)
      return prev.map((r) =>
        r.id === id ? { id: r.id, materialName: "", quantity: "", unit: "Nos", serialNos: "" } : r
      )
    })
  }

  const setRowSerials = (rowId: string, serials: string[]) => {
    const uniqueSerials = [...new Set(serials.map((s) => s.trim()).filter(Boolean))]
    setItems((prev) => prev.map((r) => (r.id === rowId ? { ...r, serialNos: uniqueSerials.join("\n"), quantity: uniqueSerials.length > 0 ? String(uniqueSerials.length) : r.quantity } : r)))
  }

  const toggleRowSerial = (rowId: string, serial: string) => {
    const row = items.find((x) => x.id === rowId)
    if (!row) return
    const current = parseSerialInput(row.serialNos)
    const hasSerial = current.some((s) => normalizeKey(s) === normalizeKey(serial))
    const next = hasSerial ? current.filter((s) => normalizeKey(s) !== normalizeKey(serial)) : [...current, serial]
    setRowSerials(rowId, next)
    setSerialSearchByRow((prev) => ({ ...prev, [rowId]: "" }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!dispatchDate) {
      toast({ title: "Dispatch date is required", variant: "destructive" })
      return
    }
    if (driverMobile && !/^\d{10}$/.test(driverMobile)) {
      toast({
        title: "Invalid driver mobile number",
        description: "Enter exactly 10 digits.",
        variant: "destructive",
      })
      return
    }

    const validItems = items.filter(
      (r) => r.materialName.trim() && Number(r.quantity) > 0
    )
    if (validItems.length === 0) {
      toast({
        title: "At least one item required",
        description: "Add a material with name and quantity > 0.",
        variant: "destructive",
      })
      return
    }

    const payload: WarehouseItem[] = validItems.map((r) => {
      const serials = parseSerialInput(r.serialNos)
      const qty = serials.length > 0 ? Math.max(Number(r.quantity), serials.length) : Number(r.quantity)
      return {
        name: r.materialName.trim(),
        qty,
        unit: r.unit || "Nos",
        serialNos: serials.length > 0 ? serials : undefined,
      }
    })

    setIsSubmitting(true)
    try {
      await createDispatch({
        dcNumber: dcNumber.trim(),
        dispatchDate,
        vehicleNo: vehicleNo.trim(),
        driverName: driverName.trim(),
        driverMobile: driverMobile.trim(),
        vehicleType,
        fromLocation: fromLocation.trim(),
        toLocation: toLocation.trim(),
        fromWarehouseId: warehouseId.trim() || undefined,
        toWarehouseId: undefined,
        notes: notes.trim() || undefined,
        status: "dispatched",
        items: payload,
      })
      dispatchDraft.clear()
      toast({ title: "Dispatch created", description: `DC ${dcNumber.trim()} saved successfully.` })
      router.push("/warehouse/dispatch")
    } catch (err) {
      toast({
        title: "Could not create dispatch",
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
        {/* Top nav bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 px-4 py-3">
          <Link href="/warehouse/dispatch">
            <Button variant="ghost" className="text-foreground hover:bg-accent">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dispatch
            </Button>
          </Link>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/warehouse/dispatch")}
              className="border-border text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="dispatch-new-form"
              disabled={isSubmitting}
              className="hidden min-w-[160px] bg-green-600 text-white hover:bg-green-700 sm:inline-flex"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Saving..." : "Create Dispatch"}
            </Button>
          </div>
        </div>

        <h1 className="mb-5 text-xl font-bold text-foreground sm:mb-6 sm:text-2xl">New Material Dispatch</h1>

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

        <form id="dispatch-new-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1 — DC Details */}
          <Card className="border-border bg-card shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg">DC Details</CardTitle>
              <p className="text-sm text-muted-foreground">Delivery challan number and date</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="dcNumber" className="text-foreground">DC Number (Auto)</Label>
                  <Input
                    id="dcNumber"
                    value={dcNumber}
                    readOnly
                    className="mt-2 border-border bg-muted text-muted-foreground"
                  />
                </div>
                <div>
                  <Label htmlFor="dispatchDate" className="text-foreground">Dispatch Date *</Label>
                  <Input
                    id="dispatchDate"
                    type="date"
                    value={dispatchDate}
                    onChange={(e) => setDispatchDate(e.target.value)}
                    className="mt-2 border-border bg-background"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="dispatchWarehouse">Warehouse</Label>
                  <Select value={warehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger id="dispatchWarehouse" className="mt-2">
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouseOptions.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name} ({w.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Stock and serial checks use this warehouse as the dispatch source.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2 — Vehicle Details */}
          <Card className="border-border bg-card shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg">Vehicle Details</CardTitle>
              <p className="text-sm text-muted-foreground">Transport and route information</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="vehicleNo" className="text-foreground">Vehicle No</Label>
                  <Input
                    id="vehicleNo"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                    placeholder="e.g. AP28AB1234"
                    className="mt-2 border-border bg-background"
                  />
                </div>
                <div>
                  <Label htmlFor="driverName" className="text-foreground">Driver Name</Label>
                  <Input
                    id="driverName"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="e.g. Ravi Kumar"
                    className="mt-2 border-border bg-background"
                  />
                </div>
                <div>
                  <Label htmlFor="driverMobile" className="text-foreground">Driver Mobile</Label>
                  <Input
                    id="driverMobile"
                    value={driverMobile}
                    onChange={(e) => setDriverMobile(normalizeDriverMobileInput(e.target.value))}
                    placeholder="e.g. 9876543210"
                    className="mt-2 border-border bg-background"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label className="text-foreground">Vehicle Type</Label>
                  <Select value={vehicleType} onValueChange={setVehicleType}>
                    <SelectTrigger className="mt-2 border-border bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="fromLocation" className="text-foreground">From Location</Label>
                  <Input
                    id="fromLocation"
                    value={fromLocation}
                    onChange={(e) => setFromLocation(e.target.value)}
                    className="mt-2 border-border bg-background"
                  />
                </div>
                <div>
                  <Label htmlFor="toLocation" className="text-foreground">To Location</Label>
                  <Input
                    id="toLocation"
                    value={toLocation}
                    onChange={(e) => setToLocation(e.target.value)}
                    placeholder="e.g. village name"
                    className="mt-2 border-border bg-background"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3 — Items */}
          <Card className="border-border bg-card shadow-sm rounded-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Items</CardTitle>
                  <p className="text-sm text-muted-foreground">Materials being dispatched</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={addItem}
                  className="bg-green-600 text-white hover:bg-green-700"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 pr-3 text-left font-medium text-muted-foreground w-[34%]">Material Name</th>
                      <th className="py-2 pr-3 text-left font-medium text-muted-foreground w-[12%]">Qty</th>
                      <th className="py-2 pr-3 text-left font-medium text-muted-foreground w-[10%]">Unit</th>
                      <th className="py-2 pr-3 text-left font-medium text-muted-foreground">Serial Nos</th>
                      <th className="py-2 text-left font-medium text-muted-foreground w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((row) => (
                      <tr key={row.id}>
                        <td className="align-top py-2 pr-3">
                          <Select
                            value={row.materialName}
                            onValueChange={(v) => {
                              updateItem(row.id, "materialName", v)
                              const selected = materialOptions.find((m) => m.name === v)
                              if (selected?.unit) updateItem(row.id, "unit", selected.unit)
                              setSerialSearchByRow((prev) => ({ ...prev, [row.id]: "" }))
                            }}
                          >
                            <SelectTrigger className="h-10 border-border bg-background text-sm">
                              <SelectValue placeholder="Select material" />
                            </SelectTrigger>
                            <SelectContent>
                              {materialOptions.map((m) => (
                                <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="align-top py-2 pr-3">
                          <Input
                            type="number"
                            min="0"
                            value={row.quantity}
                            onChange={(e) => updateItem(row.id, "quantity", e.target.value)}
                            className="h-10 border-border bg-background"
                            placeholder="0"
                          />
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {row.materialName
                              ? `${availableQtyByMaterial[normalizeKey(row.materialName)] ?? 0} Qty available`
                              : "Select material to see available qty"}
                          </p>
                        </td>
                        <td className="align-top py-2 pr-3">
                          <Input
                            value={row.unit}
                            onChange={(e) => updateItem(row.id, "unit", e.target.value)}
                            className="h-10 border-border bg-background"
                          />
                        </td>
                        <td className="align-top py-2 pr-3">
                          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-2.5">
                            <p className="text-[11px] font-medium text-muted-foreground">Serial Nos (one per line)</p>
                            <Textarea
                              value={row.serialNos}
                              onChange={(e) => {
                                const value = e.target.value
                                const serials = parseSerialInput(value)
                                updateItem(row.id, "serialNos", value)
                                if (serials.length > 0) updateItem(row.id, "quantity", String(serials.length))
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.stopPropagation()
                              }}
                              placeholder="Enter serial nos here (one per line)"
                              className="h-28 min-h-0 max-h-28 resize-none overflow-y-auto border-border bg-background text-xs"
                            />
                            {row.materialName ? (
                              <div className="space-y-2">
                                <Input
                                  value={serialSearchByRow[row.id] ?? ""}
                                  onChange={(e) => setSerialSearchByRow((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                  placeholder="Search serial no..."
                                  className="h-8 border-border bg-background text-xs"
                                />
                                <div className="h-44 min-h-0 space-y-1 overflow-y-auto rounded border border-border bg-background p-2">
                                  {(availableSerialsByMaterial[normalizeKey(row.materialName)] ?? [])
                                    .filter((serial) => {
                                      const q = (serialSearchByRow[row.id] ?? "").trim().toLowerCase()
                                      return q.length === 0 ? true : serial.toLowerCase().includes(q)
                                    })
                                    .slice(0, 300)
                                    .map((serial) => {
                                      const selected = parseSerialInput(row.serialNos).some((s) => normalizeKey(s) === normalizeKey(serial))
                                      return (
                                        <label key={serial} className="flex cursor-pointer items-center gap-2 text-xs">
                                          <input
                                            type="checkbox"
                                            checked={selected}
                                            onChange={() => toggleRowSerial(row.id, serial)}
                                          />
                                          <span>{serial}</span>
                                        </label>
                                      )
                                    })}
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">Select material to load available serials and search.</p>
                            )}
                          </div>
                        </td>
                        <td className="align-top py-2 pl-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(row.id)}
                            className="h-9 w-9 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Section 4 — Notes */}
          <Card className="border-border bg-card shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
              <p className="text-sm text-muted-foreground">Optional remarks for this dispatch</p>
            </CardHeader>
            <CardContent>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes or instructions…"
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </CardContent>
          </Card>

          <div className="hidden justify-end gap-3 sm:flex">
            <Button type="button" variant="outline" onClick={() => router.push("/warehouse/dispatch")} className="border-border text-foreground">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[200px] bg-green-600 text-white hover:bg-green-700">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Saving..." : "Create Dispatch"}
            </Button>
          </div>
        </form>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-6xl gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/warehouse/dispatch")} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" form="dispatch-new-form" disabled={isSubmitting} className="flex-1 bg-green-600 text-white hover:bg-green-700">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Saving..." : "Create"}
          </Button>
        </div>
      </div>
    </div>
  )
}
