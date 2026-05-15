"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react"
import { useFormDraft } from "@/lib/store/use-form-draft"
import { DraftBanner } from "@/components/draft-banner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { getDispatchById, listDispatches, listInwards, listMaterialDefinitions, listReturns, updateDispatch } from "@/lib/supabase/warehouse"
import type { MaterialDefinition } from "@/lib/supabase/warehouse"
import type { WarehouseItem } from "@/lib/store/warehouse"

const VEHICLE_TYPES = ["Tempo", "Pickup", "Truck", "Auto"]

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

export default function EditDispatchPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [materialOptions, setMaterialOptions] = useState<MaterialDefinition[]>([])
  const [availableSerialsByMaterial, setAvailableSerialsByMaterial] = useState<Record<string, string[]>>({})
  const [availableQtyByMaterial, setAvailableQtyByMaterial] = useState<Record<string, number>>({})
  const [serialSearchByRow, setSerialSearchByRow] = useState<Record<string, string>>({})

  const [dcNumber, setDcNumber] = useState("")
  const [dispatchDate, setDispatchDate] = useState("")
  const [vehicleNo, setVehicleNo] = useState("")
  const [driverName, setDriverName] = useState("")
  const [driverMobile, setDriverMobile] = useState("")
  const [vehicleType, setVehicleType] = useState("Tempo")
  const [fromLocation, setFromLocation] = useState("")
  const [toLocation, setToLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<ItemRow[]>([newItemRow()])

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
      notes,
      items,
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
      notes,
      items,
    ],
  )
  const [draftEnabled, setDraftEnabled] = useState(false)
  const dispatchDraft = useFormDraft<typeof draftPayload>(
    id ? `warehouse.dispatch.edit.${id}` : "warehouse.dispatch.edit.__unknown__",
    draftPayload,
    { enabled: draftEnabled && !!id },
  )
  const [draftBannerOpen, setDraftBannerOpen] = useState(false)
  const [draftBannerSavedAt, setDraftBannerSavedAt] = useState<string | null>(null)
  const draftCheckedRef = useRef(false)

  const handleRestoreDraft = () => {
    const d = dispatchDraft.restore()
    if (d) {
      setDcNumber(d.dcNumber ?? "")
      setDispatchDate(d.dispatchDate ?? "")
      setVehicleNo(d.vehicleNo ?? "")
      setDriverName(d.driverName ?? "")
      setDriverMobile(d.driverMobile ?? "")
      setVehicleType(d.vehicleType ?? "Tempo")
      setFromLocation(d.fromLocation ?? "")
      setToLocation(d.toLocation ?? "")
      setNotes(d.notes ?? "")
      if (Array.isArray(d.items) && d.items.length > 0) setItems(d.items)
    }
    setDraftBannerOpen(false)
    setDraftEnabled(true)
    toast({ title: "Draft restored" })
  }

  const handleDiscardDraft = () => {
    dispatchDraft.clear()
    setDraftBannerOpen(false)
    setDraftEnabled(true)
  }

  useEffect(() => {
    if (!id) return
    // Hydrate from server exactly once per mount. dispatchDraft must not be in deps —
    // it returns a new reference on every debounced write and would re-trigger the load.
    if (draftCheckedRef.current) return
    draftCheckedRef.current = true
    Promise.all([getDispatchById(id), listMaterialDefinitions()])
      .then(([dispatch, materials]) => {
        if (!dispatch) {
          toast({ title: "Dispatch not found", variant: "destructive" })
          router.push("/warehouse/dispatch")
          return
        }
        setMaterialOptions(materials)
        setDcNumber(dispatch.dcNumber)
        setDispatchDate(dispatch.dispatchDate)
        setVehicleNo(dispatch.vehicleNo ?? "")
        setDriverName(dispatch.driverName ?? "")
        setDriverMobile(dispatch.driverMobile ?? "")
        setVehicleType(dispatch.vehicleType || "Tempo")
        setFromLocation(dispatch.fromLocation ?? "")
        setToLocation(dispatch.toLocation ?? "")
        setNotes(dispatch.notes ?? "")
        setItems(
          dispatch.items.length > 0
            ? dispatch.items.map((item) => ({
                id: crypto.randomUUID(),
                materialName: item.name,
                quantity: String(item.qty),
                unit: item.unit ?? "Nos",
                serialNos: (item.serialNos ?? []).join("\n"),
              }))
            : [newItemRow()]
        )
        if (dispatchDraft.hasDraft()) {
          setDraftBannerSavedAt(dispatchDraft.peekSavedAt())
          setDraftBannerOpen(true)
        } else {
          setDraftEnabled(true)
        }
      })
      .catch((err) =>
        toast({
          title: "Could not load dispatch",
          description: err instanceof Error ? err.message : "Please refresh.",
          variant: "destructive",
        })
      )
      .finally(() => setLoading(false))
    // dispatchDraft intentionally omitted — guarded by draftCheckedRef above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router])

  useEffect(() => {
    if (!id) return
    void Promise.all([listMaterialDefinitions(), listInwards(), listDispatches(), listReturns()])
      .then(([materials, inwards, dispatches, returnsData]) => {
        const inwardByMaterial = new Map<string, Map<string, string>>()
        const dispatchedByMaterial = new Map<string, Set<string>>()
        const returnedByMaterial = new Map<string, Set<string>>()
        const inwardQtyByMaterial = new Map<string, number>()
        const dispatchedQtyByMaterial = new Map<string, number>()
        const returnedQtyByMaterial = new Map<string, number>()

        for (const inward of inwards) {
          for (const item of inward.items) {
            const materialKey = normalizeKey(item.name)
            inwardQtyByMaterial.set(materialKey, (inwardQtyByMaterial.get(materialKey) ?? 0) + (item.qty ?? 0))
            const serialMap = inwardByMaterial.get(materialKey) ?? new Map<string, string>()
            for (const serial of item.serialNos ?? []) {
              const key = normalizeKey(serial)
              if (!key) continue
              if (!serialMap.has(key)) serialMap.set(key, serial.trim())
            }
            inwardByMaterial.set(materialKey, serialMap)
          }
        }

        for (const dispatch of dispatches.filter((d) => d.id !== id)) {
          for (const item of dispatch.items) {
            const materialKey = normalizeKey(item.name)
            dispatchedQtyByMaterial.set(materialKey, (dispatchedQtyByMaterial.get(materialKey) ?? 0) + (item.qty ?? 0))
            const serialSet = dispatchedByMaterial.get(materialKey) ?? new Set<string>()
            for (const serial of item.serialNos ?? []) {
              const key = normalizeKey(serial)
              if (key) serialSet.add(key)
            }
            dispatchedByMaterial.set(materialKey, serialSet)
          }
        }

        for (const ret of returnsData) {
          for (const item of ret.items) {
            const materialKey = normalizeKey(item.name)
            returnedQtyByMaterial.set(materialKey, (returnedQtyByMaterial.get(materialKey) ?? 0) + (item.qty ?? 0))
            const serialSet = returnedByMaterial.get(materialKey) ?? new Set<string>()
            for (const serial of item.serialNos ?? []) {
              const key = normalizeKey(serial)
              if (key) serialSet.add(key)
            }
            returnedByMaterial.set(materialKey, serialSet)
          }
        }

        const availableMap: Record<string, string[]> = {}
        const qtyMap: Record<string, number> = {}
        for (const [materialKey, inwardSerialMap] of inwardByMaterial.entries()) {
          const dispatchedSet = dispatchedByMaterial.get(materialKey) ?? new Set<string>()
          const returnedSet = returnedByMaterial.get(materialKey) ?? new Set<string>()
          const available: string[] = []
          for (const [serialKey, displaySerial] of inwardSerialMap.entries()) {
            const isOutwardAndNotReturned = dispatchedSet.has(serialKey) && !returnedSet.has(serialKey)
            if (!isOutwardAndNotReturned) available.push(displaySerial)
          }
          availableMap[materialKey] = available.sort((a, b) => a.localeCompare(b))
          qtyMap[materialKey] =
            (inwardQtyByMaterial.get(materialKey) ?? 0) -
            (dispatchedQtyByMaterial.get(materialKey) ?? 0) +
            (returnedQtyByMaterial.get(materialKey) ?? 0)
        }
        for (const material of materials) {
          const materialKey = normalizeKey(material.name)
          if (qtyMap[materialKey] === undefined) {
            qtyMap[materialKey] =
              (inwardQtyByMaterial.get(materialKey) ?? 0) -
              (dispatchedQtyByMaterial.get(materialKey) ?? 0) +
              (returnedQtyByMaterial.get(materialKey) ?? 0)
          }
        }
        setAvailableSerialsByMaterial(availableMap)
        setAvailableQtyByMaterial(qtyMap)
      })
      .catch(() => {
        toast({
          title: "Could not load serial availability",
          description: "Please refresh and try again.",
          variant: "destructive",
        })
      })
  }, [id])

  const addItem = () => setItems((prev) => [...prev, newItemRow()])
  const removeItem = (rowId: string) => {
    setSerialSearchByRow((prev) => {
      const next = { ...prev }
      delete next[rowId]
      return next
    })
    setItems((prev) => {
      if (prev.length > 1) return prev.filter((r) => r.id !== rowId)
      return prev.map((r) =>
        r.id === rowId ? { id: r.id, materialName: "", quantity: "", unit: "Nos", serialNos: "" } : r
      )
    })
  }
  const updateItem = (rowId: string, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)))
  }
  const setRowSerials = (rowId: string, serials: string[]) => {
    const uniqueSerials = [...new Set(serials.map((s) => s.trim()).filter(Boolean))]
    setItems((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? { ...r, serialNos: uniqueSerials.join("\n"), quantity: uniqueSerials.length > 0 ? String(uniqueSerials.length) : r.quantity }
          : r
      )
    )
  }
  const toggleRowSerial = (rowId: string, serial: string) => {
    const row = items.find((x) => x.id === rowId)
    if (!row) return
    const current = parseSerialInput(row.serialNos)
    const exists = current.some((s) => normalizeKey(s) === normalizeKey(serial))
    const next = exists ? current.filter((s) => normalizeKey(s) !== normalizeKey(serial)) : [...current, serial]
    setRowSerials(rowId, next)
    setSerialSearchByRow((prev) => ({ ...prev, [rowId]: "" }))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dcNumber.trim()) {
      toast({ title: "DC number is required", variant: "destructive" })
      return
    }
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
    const validItems = items.filter((r) => r.materialName.trim() && Number(r.quantity) > 0)
    if (validItems.length === 0) {
      toast({ title: "Add at least one valid item", variant: "destructive" })
      return
    }

    const payloadItems: WarehouseItem[] = validItems.map((row) => {
      const serials = parseSerialInput(row.serialNos)
      return {
        name: row.materialName.trim(),
        qty: Number(row.quantity),
        unit: row.unit || "Nos",
        serialNos: serials.length > 0 ? serials : undefined,
      }
    })

    setIsSubmitting(true)
    try {
      await updateDispatch(id, {
        dcNumber: dcNumber.trim(),
        dispatchDate,
        vehicleNo: vehicleNo.trim() || undefined,
        driverName: driverName.trim() || undefined,
        driverMobile: driverMobile.trim() || undefined,
        vehicleType,
        fromLocation: fromLocation.trim() || undefined,
        toLocation: toLocation.trim() || undefined,
        notes: notes.trim() || undefined,
        status: "dispatched",
        items: payloadItems,
      })
      dispatchDraft.clear()
      toast({ title: "Dispatch updated", description: "Delivery challan changes saved." })
      router.push(`/warehouse/dispatch/${id}`)
    } catch (err) {
      toast({
        title: "Could not update dispatch",
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
          <Link href={`/warehouse/dispatch/${id}`}>
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dispatch
            </Button>
          </Link>
          <Button type="submit" form="dispatch-edit-form" disabled={isSubmitting} className="hidden min-w-[170px] bg-green-600 text-white hover:bg-green-700 sm:inline-flex">
            <Loader2 className={`h-4 w-4 animate-spin ${isSubmitting ? "mr-2 inline-flex" : "hidden"}`} />
            <span>{isSubmitting ? "Saving..." : "Save Changes"}</span>
          </Button>
        </div>

        <h1 className="mb-5 text-xl font-bold text-foreground sm:mb-6 sm:text-2xl">Edit Delivery Challan</h1>
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
        <form id="dispatch-edit-form" onSubmit={onSubmit} className="space-y-6">
          <Card className="border-border bg-card shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg">Delivery Challan Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>DC Number *</Label>
                <Input value={dcNumber} onChange={(e) => setDcNumber(e.target.value)} className="mt-2" required />
              </div>
              <div>
                <Label>Dispatch Date *</Label>
                <Input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} className="mt-2" required />
              </div>
              <div>
                <Label>Vehicle No</Label>
                <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label>Driver Name</Label>
                <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} className="mt-2" />
              </div>
              <div>
                <Label>Driver Mobile</Label>
                <Input
                  value={driverMobile}
                  onChange={(e) => setDriverMobile(normalizeDriverMobileInput(e.target.value))}
                  className="mt-2"
                  placeholder="e.g. 9876543210"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                />
              </div>
              <div>
                <Label>Vehicle Type</Label>
                <Select value={vehicleType} onValueChange={setVehicleType}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>From Location</Label>
                <Input value={fromLocation} onChange={(e) => setFromLocation(e.target.value)} className="mt-2" />
              </div>
              <div className="md:col-span-2">
                <Label>To Location</Label>
                <Input value={toLocation} onChange={(e) => setToLocation(e.target.value)} className="mt-2" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-lg">Items</CardTitle>
              <Button type="button" variant="outline" onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((row) => (
                <div key={row.id} className="grid gap-3 rounded-lg border border-border p-3 sm:p-4 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <Label>Material</Label>
                    <Select
                      value={row.materialName}
                      onValueChange={(v) => {
                        const selected = materialOptions.find((m) => m.name === v)
                        updateItem(row.id, { materialName: v, unit: selected?.unit || "Nos" })
                        setSerialSearchByRow((prev) => ({ ...prev, [row.id]: "" }))
                      }}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select material" />
                      </SelectTrigger>
                      <SelectContent>
                        {materialOptions.map((m) => (
                          <SelectItem key={m.id} value={m.name}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Qty</Label>
                    <Input type="number" min="0" value={row.quantity} onChange={(e) => updateItem(row.id, { quantity: e.target.value })} className="mt-2" />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {row.materialName
                        ? `${availableQtyByMaterial[normalizeKey(row.materialName)] ?? 0} Qty available`
                        : "Select material to see available qty"}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Unit</Label>
                    <Input value={row.unit} onChange={(e) => updateItem(row.id, { unit: e.target.value })} className="mt-2" />
                  </div>
                  <div className="md:col-span-3">
                    <Label>Serial Numbers</Label>
                    <div className="mt-2 space-y-2 rounded-md border border-border bg-muted/30 p-2.5">
                      <p className="text-[11px] font-medium text-muted-foreground">Serial Nos (one per line)</p>
                      <Textarea
                        className="h-28 min-h-0 max-h-28 resize-none overflow-y-auto border-border bg-background text-xs"
                        value={row.serialNos}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.stopPropagation()
                        }}
                        onChange={(e) => {
                          const serials = parseSerialInput(e.target.value)
                          updateItem(row.id, {
                            serialNos: e.target.value,
                            quantity: serials.length > 0 ? String(serials.length) : row.quantity,
                          })
                        }}
                        placeholder="Enter serial nos here (one per line)"
                      />
                      {row.materialName ? (
                        <>
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
                                    <input type="checkbox" checked={selected} onChange={() => toggleRowSerial(row.id, serial)} />
                                    <span>{serial}</span>
                                  </label>
                                )
                              })}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Select material to load available serials.</p>
                      )}
                    </div>
                  </div>
                  <div className="md:col-span-1 flex items-end justify-end md:justify-start">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(row.id)} className="text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-2" placeholder="Any additional notes..." />
            </CardContent>
          </Card>
          <div className="hidden justify-end gap-3 sm:flex">
            <Link href={`/warehouse/dispatch/${id}`}>
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
          <Link href={`/warehouse/dispatch/${id}`} className="flex-1">
            <Button type="button" variant="outline" className="w-full">Cancel</Button>
          </Link>
          <Button type="submit" form="dispatch-edit-form" disabled={isSubmitting} className="flex-1 bg-green-600 text-white hover:bg-green-700">
            <Loader2 className={`h-4 w-4 animate-spin ${isSubmitting ? "mr-2 inline-flex" : "hidden"}`} />
            <span>{isSubmitting ? "Saving..." : "Save"}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
