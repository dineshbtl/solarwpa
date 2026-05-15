"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Repeat2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import {
  approveHouseAllocationRequest,
  approveHouseReassignRequest,
  createHouseDeliveryAllocation,
  listDispatches,
  listHouseDeliveries,
  listHouseMovementEvents,
  listMaterialDefinitions,
  reassignHouseMaterial,
  requestHouseAllocationApproval,
  requestHouseReassignApproval,
  returnHouseMaterial,
  type MaterialDefinition,
} from "@/lib/supabase/warehouse"
import type { HouseMaterialDelivery, HouseMaterialMovementEvent, MaterialDispatch } from "@/lib/store/warehouse"
import { useRole } from "@/contexts/role-context"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { preparePhotoWithGpsStamp } from "@/lib/photo-gps-stamp"
import { SurveySelect } from "@/components/survey-select"
import type { Survey } from "@/lib/store/surveys"
import { WarehouseModuleHeader } from "@/components/warehouse/warehouse-module-header"

const PROOF_BUCKET = "solar_bucket"

function parseSerialText(input: string): string[] {
  return [...new Set(input.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))]
}

interface AllocationRow {
  id: string
  materialName: string
  qty: string
  unit: string
  serialsText: string
}

function newAllocationRow(): AllocationRow {
  return { id: crypto.randomUUID(), materialName: "", qty: "", unit: "Nos", serialsText: "" }
}

function ReallocationPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { role, currentUser } = useRole()
  const canApprove = new Set(["admin", "manager", "district_store_incharge", "state_store_officer"]).has(role)
  const tab = searchParams.get("tab")
  const activeTab = tab === "reassign" || tab === "ledger" || tab === "allocate" ? tab : "allocate"

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [materials, setMaterials] = useState<MaterialDefinition[]>([])
  const [dispatches, setDispatches] = useState<MaterialDispatch[]>([])
  const [deliveries, setDeliveries] = useState<HouseMaterialDelivery[]>([])
  const [events, setEvents] = useState<HouseMaterialMovementEvent[]>([])

  const [allocSurvey, setAllocSurvey] = useState<Survey | null>(null)
  const [targetSurvey, setTargetSurvey] = useState<Survey | null>(null)
  const [selectedDispatchId, setSelectedDispatchId] = useState("none")
  const [allocRows, setAllocRows] = useState<AllocationRow[]>([newAllocationRow()])
  const [allocSerialSearchByRow, setAllocSerialSearchByRow] = useState<Record<string, string>>({})
  const [allocNotes, setAllocNotes] = useState("")
  const [allocProofFile, setAllocProofFile] = useState<File | null>(null)
  const [openDcDialog, setOpenDcDialog] = useState(false)

  const [sourceDeliveryId, setSourceDeliveryId] = useState("")
  const [reassignSerialsText, setReassignSerialsText] = useState("")
  const [reassignNotes, setReassignNotes] = useState("")
  const [reassignProofFile, setReassignProofFile] = useState<File | null>(null)

  const activeDeliveries = useMemo(
    () => deliveries.filter((d) => d.status === "allocated" || d.status === "delivered" || d.status === "reassigned"),
    [deliveries]
  )
  const pendingRequests = useMemo(
    () => events.filter((e) => (e.eventType === "reassign_request" || e.eventType === "allocate_request") && e.approvalStatus === "pending"),
    [events]
  )
  const allocatedSerialsByMaterial = useMemo(() => {
    const out: Record<string, Set<string>> = {}
    for (const d of deliveries) {
      if (d.status === "returned") continue
      const key = d.materialName.trim().toLowerCase()
      if (!out[key]) out[key] = new Set<string>()
      for (const s of d.serialNos ?? []) out[key].add(s.trim().toLowerCase())
    }
    return out
  }, [deliveries])

  const uploadProof = async (file: File | null): Promise<{ url?: string; gps?: { latitude: number; longitude: number; source?: "exif" } }> => {
    if (!file) return {}
    const sb = getSupabaseBrowserClient()
    const prepared = await preparePhotoWithGpsStamp(file)
    const compressed = prepared.file
    const key = `reallocation-proof/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    const contentType = compressed.type && compressed.type.startsWith("image/") ? compressed.type : "image/jpeg"
    const { error } = await sb.storage.from(PROOF_BUCKET).upload(key, compressed, {
      cacheControl: "3600",
      upsert: true,
      contentType,
    })
    if (error) throw new Error(`Proof upload failed: ${error.message}`)
    const { data } = sb.storage.from(PROOF_BUCKET).getPublicUrl(key)
    return {
      url: data.publicUrl,
      gps: prepared.gps
        ? {
            latitude: prepared.gps.latitude,
            longitude: prepared.gps.longitude,
            source: prepared.gps.source === "exif" ? "exif" : undefined,
          }
        : undefined,
    }
  }

  const loadAll = () => {
    setLoading(true)
    Promise.allSettled([listMaterialDefinitions(), listDispatches(), listHouseDeliveries(), listHouseMovementEvents()])
      .then((res) => {
        const [materialsRes, dispatchesRes, deliveriesRes, eventsRes] = res
        if (materialsRes.status === "fulfilled") setMaterials(materialsRes.value)
        else setMaterials([])
        if (dispatchesRes.status === "fulfilled") setDispatches(dispatchesRes.value)
        else setDispatches([])
        if (deliveriesRes.status === "fulfilled") setDeliveries(deliveriesRes.value)
        else setDeliveries([])
        if (eventsRes.status === "fulfilled") setEvents(eventsRes.value)
        else setEvents([])

        const failed = res
          .map((r) => (r.status === "rejected" ? (r.reason instanceof Error ? r.reason.message : "Unknown error") : null))
          .filter(Boolean)
        if (failed.length > 0) {
          toast({
            title: "Some reallocation data could not load",
            description: String(failed[0]),
            variant: "destructive",
          })
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAll()
  }, [])

  const selectedDispatch = useMemo(
    () => dispatches.find((d) => d.id === selectedDispatchId || d.dcNumber === selectedDispatchId),
    [dispatches, selectedDispatchId]
  )

  /** When a DC is chosen in the dropdown, "View DC" should list only that challan, not every DC. */
  const dispatchesForViewDcDialog = useMemo(() => {
    if (selectedDispatchId === "none") return dispatches
    return dispatches.filter(
      (d) => d.id === selectedDispatchId || d.dcNumber === selectedDispatchId
    )
  }, [dispatches, selectedDispatchId])

  const addAllocRow = () => setAllocRows((prev) => [...prev, newAllocationRow()])
  const removeAllocRow = (id: string) => {
    setAllocSerialSearchByRow((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setAllocRows((prev) => {
      if (prev.length > 1) return prev.filter((r) => r.id !== id)
      return prev.map((r) =>
        r.id === id ? { id: r.id, materialName: "", qty: "", unit: "Nos", serialsText: "" } : r
      )
    })
  }
  const updateAllocRow = (id: string, patch: Partial<AllocationRow>) => {
    setAllocRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }
  const setAllocRowSerials = (id: string, serials: string[]) => {
    const unique = [...new Set(serials.map((s) => s.trim()).filter(Boolean))]
    updateAllocRow(id, {
      serialsText: unique.join("\n"),
      qty: unique.length > 0 ? String(unique.length) : "",
    })
  }
  const toggleAllocRowSerial = (id: string, serial: string) => {
    const row = allocRows.find((x) => x.id === id)
    if (!row) return
    const selected = parseSerialText(row.serialsText)
    const has = selected.some((s) => s.toLowerCase() === serial.toLowerCase())
    const next = has ? selected.filter((s) => s.toLowerCase() !== serial.toLowerCase()) : [...selected, serial]
    setAllocRowSerials(id, next)
    setAllocSerialSearchByRow((prev) => ({ ...prev, [id]: "" }))
  }

  const onAllocate = async () => {
    const householdId = allocSurvey?.id ?? ""
    if (!householdId) {
      toast({ title: "Household is required", variant: "destructive" })
      return
    }
    const validRows = allocRows.filter((r) => r.materialName.trim())
    if (validRows.length === 0) {
      toast({ title: "Add at least one material row", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      if (!allocProofFile) {
        throw new Error("Proof photo is mandatory for allocation.")
      }
      const proof = await uploadProof(allocProofFile)
      const batchId = `ALB-${Date.now()}`
      for (const row of validRows) {
        const serials = parseSerialText(row.serialsText)
        const qty = serials.length > 0 ? serials.length : Number(row.qty)
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new Error(`Quantity must be greater than 0 for ${row.materialName}.`)
        }
        if (canApprove) {
          await createHouseDeliveryAllocation({
            allocationBatchId: batchId,
            dispatchId: selectedDispatch?.id,
            toHouseholdId: householdId,
            materialName: row.materialName,
            qty,
            unit: row.unit || "Nos",
            serialNos: serials,
            notes: allocNotes.trim() || undefined,
            proofPhotoUrl: proof.url,
            proofPhotoGps: proof.gps,
          })
        } else {
          await requestHouseAllocationApproval({
            allocationBatchId: batchId,
            dispatchId: selectedDispatch?.id,
            toHouseholdId: householdId,
            materialName: row.materialName,
            qty,
            unit: row.unit || "Nos",
            serialNos: serials,
            notes: allocNotes.trim() || undefined,
            actorId: currentUser?.id,
            proofPhotoUrl: proof.url,
            proofPhotoGps: proof.gps,
          })
        }
      }
      toast({
        title: canApprove ? "Allocated" : "Allocation submitted for approval",
        description: canApprove
          ? "Material allocated to household."
          : "Manager/Admin approval is required before allocation is confirmed.",
      })
      setAllocRows([newAllocationRow()])
      setAllocNotes("")
      setAllocProofFile(null)
      loadAll()
    } catch (err) {
      toast({
        title: "Could not allocate",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const onReassign = async () => {
    if (!sourceDeliveryId || !(targetSurvey?.id ?? "").trim()) {
      toast({ title: "Source delivery and target household are required", variant: "destructive" })
      return
    }
    const serials = parseSerialText(reassignSerialsText)
    if (serials.length === 0) {
      toast({ title: "Select at least one serial to reassign", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const proof = await uploadProof(reassignProofFile)
      if (canApprove) {
        await reassignHouseMaterial({
          sourceDeliveryId,
          toHouseholdId: targetSurvey!.id,
          serialNos: serials,
          notes: reassignNotes.trim() || undefined,
          proofPhotoUrl: proof.url,
          proofPhotoGps: proof.gps,
        })
        toast({ title: "Reassigned", description: "Serials moved to target household." })
      } else {
        await requestHouseReassignApproval({
          sourceDeliveryId,
          toHouseholdId: targetSurvey!.id,
          serialNos: serials,
          notes: reassignNotes.trim() || undefined,
          actorId: currentUser?.id,
          proofPhotoUrl: proof.url,
          proofPhotoGps: proof.gps,
        })
        toast({ title: "Approval requested", description: "Reassignment sent for approval." })
      }
      setReassignNotes("")
      setReassignSerialsText("")
      setSourceDeliveryId("")
      setTargetSurvey(null)
      setReassignProofFile(null)
      loadAll()
    } catch (err) {
      toast({
        title: "Could not reassign",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const onReturnCancelled = async (delivery: HouseMaterialDelivery) => {
    setSubmitting(true)
    try {
      await returnHouseMaterial({
        deliveryId: delivery.id,
        serialNos: delivery.serialNos,
        notes: "Installation cancelled",
      })
      toast({ title: "Marked returned", description: `${delivery.id} moved back from household.` })
      loadAll()
    } catch (err) {
      toast({
        title: "Could not mark return",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const onApproveRequest = async (eventId: string) => {
    setSubmitting(true)
    try {
      await approveHouseReassignRequest({
        eventId,
        approverId: currentUser?.id,
        approverRole: role,
      })
      toast({ title: "Approved", description: "Reassignment has been processed." })
      loadAll()
    } catch (err) {
      toast({
        title: "Could not approve",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const applyDispatchPrefillToRow = (rowId: string, materialName: string) => {
    if (!selectedDispatch) return
    const item = selectedDispatch.items.find((i: { name: string }) => i.name === materialName)
    if (!item) return
    updateAllocRow(rowId, {
      unit: item.unit ?? "Nos",
      serialsText: "",
    })
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10">
      <WarehouseModuleHeader
        title="House Reallocation"
        description="Move serial-tracked materials between households with audit trail"
        icon={Repeat2}
        actions={
          <Link href="/warehouse/reallocation/allocations">
            <Button variant="outline" className="rounded-xl">
              Allocation List
            </Button>
          </Link>
        }
      />

      <Tabs value={activeTab} onValueChange={(value) => router.replace(`/warehouse/reallocation?tab=${value}`)} className="space-y-6">
        <TabsList>
          <TabsTrigger value="allocate">Allocate</TabsTrigger>
          <TabsTrigger value="reassign">Reassign</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="allocate">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Create Household Allocation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Household</Label>
                <div className="mt-2">
                  <SurveySelect
                    value={allocSurvey?.id ?? ""}
                    selectedSurvey={allocSurvey}
                    onSelect={setAllocSurvey}
                    placeholder="Select household"
                  />
                </div>
              </div>
              <div>
                <Label>Dispatch (optional)</Label>
                <Select value={selectedDispatchId} onValueChange={setSelectedDispatchId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select DC for prefill" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {dispatches.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.dcNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2 flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setOpenDcDialog(true)}>
                    View DC
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {selectedDispatch ? `Selected: ${selectedDispatch.dcNumber}` : "No DC selected"}
                  </p>
                </div>
              </div>

              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Items</Label>
                  <Button type="button" variant="outline" onClick={addAllocRow}>Add Item</Button>
                </div>
                {allocRows.map((row) => (
                  <div key={row.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-12">
                    <div className="md:col-span-4">
                      <Label>Material</Label>
                      <Select
                        value={row.materialName}
                        onValueChange={(v) => {
                          const selected = materials.find((m) => m.name === v)
                          updateAllocRow(row.id, { materialName: v, unit: selected?.unit || "Nos" })
                          applyDispatchPrefillToRow(row.id, v)
                          setAllocSerialSearchByRow((prev) => ({ ...prev, [row.id]: "" }))
                        }}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select material" />
                        </SelectTrigger>
                        <SelectContent>
                          {materials.map((m) => (
                            <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Qty</Label>
                      <Input className="mt-2" type="number" min="0" value={row.qty} onChange={(e) => updateAllocRow(row.id, { qty: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Unit</Label>
                      <Input className="mt-2" value={row.unit} onChange={(e) => updateAllocRow(row.id, { unit: e.target.value })} />
                    </div>
                    <div className="md:col-span-3">
                      <Label>Serial Nos (select)</Label>
                      {selectedDispatch?.items.find((i: { name: string }) => i.name === row.materialName)?.serialNos?.length ? (
                        <div className="mt-2 rounded-md border p-2">
                          <Input
                            placeholder="Search serial..."
                            value={allocSerialSearchByRow[row.id] ?? ""}
                            onChange={(e) => setAllocSerialSearchByRow((prev) => ({ ...prev, [row.id]: e.target.value }))}
                          />
                          <div className="mt-2 h-28 space-y-1 overflow-y-auto pr-1">
                            {(selectedDispatch?.items.find((i: { name: string }) => i.name === row.materialName)?.serialNos ?? [])
                              .filter((s: string) => {
                                const allocatedSet = allocatedSerialsByMaterial[row.materialName.trim().toLowerCase()] ?? new Set<string>()
                                return !allocatedSet.has(s.trim().toLowerCase())
                              })
                              .filter((s: string) => s.toLowerCase().includes((allocSerialSearchByRow[row.id] ?? "").toLowerCase()))
                              .map((serial: string) => {
                                const checked = parseSerialText(row.serialsText).some((x) => x.toLowerCase() === serial.toLowerCase())
                                return (
                                  <label key={serial} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted/50">
                                    <Checkbox checked={checked} onCheckedChange={() => toggleAllocRowSerial(row.id, serial)} />
                                    <span className="truncate">{serial}</span>
                                  </label>
                                )
                              })}
                          </div>
                        </div>
                      ) : (
                        <Input
                          className="mt-2"
                          placeholder="Select dispatch + material to pick serials"
                          value={row.serialsText}
                          onChange={(e) => updateAllocRow(row.id, { serialsText: e.target.value })}
                        />
                      )}
                    </div>
                    <div className="md:col-span-1 flex items-end">
                      <Button type="button" variant="ghost" onClick={() => removeAllocRow(row.id)}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea className="mt-2" value={allocNotes} onChange={(e) => setAllocNotes(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Proof Photo with GPS (mandatory)</Label>
                <Input id="alloc-proof-input" className="sr-only" type="file" accept="image/*" onChange={(e) => setAllocProofFile(e.target.files?.[0] ?? null)} />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => document.getElementById("alloc-proof-input")?.click()}>
                    Camera / Gallery
                  </Button>
                  {allocProofFile ? <span className="max-w-[260px] truncate text-xs text-muted-foreground">{allocProofFile.name}</span> : null}
                </div>
              </div>
              <div className="md:col-span-2">
                <Button onClick={() => void onAllocate()} disabled={submitting || loading} className="bg-green-600 text-white hover:bg-green-700">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {canApprove ? "Create Allocation" : "Submit Allocation for Approval"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reassign">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Household Reassignment</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Source Delivery</Label>
                <Select value={sourceDeliveryId} onValueChange={(v) => {
                  setSourceDeliveryId(v)
                  const source = activeDeliveries.find((d) => d.id === v)
                  setReassignSerialsText((source?.serialNos ?? []).join("\n"))
                }}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select source household delivery" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeDeliveries.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.id} · {d.toHouseholdId} · {d.materialName} · {d.serialNos.length || d.qty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target Household</Label>
                <div className="mt-2">
                  <SurveySelect
                    value={targetSurvey?.id ?? ""}
                    selectedSurvey={targetSurvey}
                    onSelect={setTargetSurvey}
                    placeholder="Select target household"
                  />
                </div>
              </div>
              <div>
                <Label>Serials to move</Label>
                <Textarea className="mt-2 h-28" value={reassignSerialsText} onChange={(e) => setReassignSerialsText(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea className="mt-2" value={reassignNotes} onChange={(e) => setReassignNotes(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Proof Photo with GPS (optional)</Label>
                <Input id="reassign-proof-input" className="sr-only" type="file" accept="image/*" onChange={(e) => setReassignProofFile(e.target.files?.[0] ?? null)} />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => document.getElementById("reassign-proof-input")?.click()}>
                    Camera / Gallery
                  </Button>
                  {reassignProofFile ? <span className="max-w-[260px] truncate text-xs text-muted-foreground">{reassignProofFile.name}</span> : null}
                </div>
              </div>
              <div className="md:col-span-2">
                <Button onClick={() => void onReassign()} disabled={submitting || loading} className="bg-blue-600 text-white hover:bg-blue-700">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Repeat2 className="mr-2 h-4 w-4" />}
                  {canApprove ? "Reassign" : "Submit for Approval"}
                </Button>
              </div>
            </CardContent>
          </Card>
          {!canApprove && (
            <p className="mt-3 text-xs text-muted-foreground">
              Your role cannot directly reassign. Requests will be sent for approval.
            </p>
          )}
        </TabsContent>

        <TabsContent value="ledger">
          <div className="space-y-6">
            <Card className="rounded-xl">
              <CardHeader><CardTitle>House Deliveries ({deliveries.length})</CardTitle></CardHeader>
              <CardContent>
                  <Table className="min-w-[860px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Household</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveries.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.id}</TableCell>
                          <TableCell>{d.toHouseholdId}</TableCell>
                          <TableCell>{d.materialName}</TableCell>
                          <TableCell className="text-right">{d.serialNos.length || d.qty}</TableCell>
                          <TableCell className="capitalize">{d.status}</TableCell>
                          <TableCell className="text-right">
                            {(d.status === "allocated" || d.status === "delivered" || d.status === "reassigned") ? (
                              <Button variant="outline" size="sm" onClick={() => void onReturnCancelled(d)} disabled={submitting}>
                                Mark Returned
                              </Button>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader><CardTitle>Movement Events ({events.length})</CardTitle></CardHeader>
              <CardContent>
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{new Date(e.createdAt).toLocaleString("en-IN")}</TableCell>
                          <TableCell className="capitalize">{e.eventType.replaceAll("_", " ")}</TableCell>
                          <TableCell>{e.materialName}</TableCell>
                          <TableCell>{e.fromHouseholdId || "—"}</TableCell>
                          <TableCell>{e.toHouseholdId || "—"}</TableCell>
                          <TableCell className="text-right">{e.serialNos.length || e.qty}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
              </CardContent>
            </Card>
            <Card className="rounded-xl">
              <CardHeader><CardTitle>Pending Reassign Approvals ({pendingRequests.length})</CardTitle></CardHeader>
              <CardContent>
                  <Table className="min-w-[1100px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingRequests.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.id}</TableCell>
                          <TableCell className="capitalize">{e.eventType.replaceAll("_", " ")}</TableCell>
                          <TableCell>{e.materialName}</TableCell>
                          <TableCell>{e.fromHouseholdId || "—"}</TableCell>
                          <TableCell>{e.toHouseholdId || "—"}</TableCell>
                          <TableCell className="text-right">{e.serialNos.length || e.qty}</TableCell>
                          <TableCell className="text-right">
                            {canApprove ? (
                              e.eventType === "allocate_request" ? (
                                <Button size="sm" onClick={async () => {
                                  setSubmitting(true)
                                  try {
                                    await approveHouseAllocationRequest({
                                      eventId: e.id,
                                      approverId: currentUser?.id,
                                      approverRole: role,
                                    })
                                    toast({ title: "Approved", description: "Allocation has been confirmed." })
                                    loadAll()
                                  } catch (err) {
                                    toast({
                                      title: "Could not approve",
                                      description: err instanceof Error ? err.message : "Please try again.",
                                      variant: "destructive",
                                    })
                                  } finally {
                                    setSubmitting(false)
                                  }
                                }} disabled={submitting}>
                                  Approve
                                </Button>
                              ) : (
                                <Button size="sm" onClick={() => void onApproveRequest(e.id)} disabled={submitting}>
                                  Approve
                                </Button>
                              )
                            ) : (
                              "Pending approval"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {pendingRequests.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                            No pending requests.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={openDcDialog} onOpenChange={setOpenDcDialog}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedDispatchId === "none"
                ? "Dispatch Challans"
                : selectedDispatch
                  ? `Dispatch · ${selectedDispatch.dcNumber}`
                  : "Dispatch Challans"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>DC No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      No dispatch challans found.
                    </TableCell>
                  </TableRow>
                ) : dispatchesForViewDcDialog.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      No dispatch matches the current selection. Choose another DC or reload the page.
                    </TableCell>
                  </TableRow>
                ) : (
                  dispatchesForViewDcDialog.map((d) => (
                    <TableRow key={d.id} className={selectedDispatchId === d.id ? "bg-muted/40" : ""}>
                      <TableCell className="font-medium">{d.dcNumber}</TableCell>
                      <TableCell>{d.dispatchDate}</TableCell>
                      <TableCell>{d.vehicleNo ?? "-"}</TableCell>
                      <TableCell>{d.items.map((i: { name: string; qty: number }) => `${i.name} (${i.qty})`).join(", ") || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={selectedDispatchId === d.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setSelectedDispatchId(d.id)
                            setOpenDcDialog(false)
                          }}
                        >
                          {selectedDispatchId === d.id ? "Selected" : "Select"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ReallocationPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading reallocation...</div>}>
      <ReallocationPageContent />
    </Suspense>
  )
}
