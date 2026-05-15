"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react"
import { useFormDraft } from "@/lib/store/use-form-draft"
import { DraftBanner } from "@/components/draft-banner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getReturnById, updateReturn } from "@/lib/supabase/warehouse"
import type { MaterialReturn } from "@/lib/store/warehouse"

const WAREHOUSES = ["Kurnool Central Warehouse", "Hyderabad Central Store"] as const
const REASONS = ["Excess", "Installation Cancelled", "Damaged"] as const

const WH_ID_TO_LABEL: Record<string, string> = {
  "WH-002": "Kurnool Central Warehouse",
  "WH-001": "Hyderabad Central Store",
}

const MATERIAL_OPTIONS = [
  "Solar PV Module",
  "Inverter",
  "Mounting Structure",
  "Earthing Kit",
  "DC Cable 4.0 Sqmm Black",
  "AC Cable Red",
  "Conduit Kit",
  "Other",
]

interface ReturnItemRow {
  name: string
  qty: number
  notes: string
  serialText: string
}

function parseSerialLines(input: string): string[] {
  return [...new Set(input.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))]
}

function reasonDbToUi(rr: MaterialReturn["returnReason"]): (typeof REASONS)[number] {
  if (rr === "installation_cancelled") return "Installation Cancelled"
  if (rr === "damaged") return "Damaged"
  return "Excess"
}

export default function EditReturnPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [fromVillage, setFromVillage] = useState("")
  const [toWarehouse, setToWarehouse] = useState("")
  const [returnDate, setReturnDate] = useState("")
  const [reason, setReason] = useState<(typeof REASONS)[number] | "">("")
  const [notes, setNotes] = useState("")
  const [itemRows, setItemRows] = useState<ReturnItemRow[]>([{ name: "", qty: 1, notes: "", serialText: "" }])

  const draftPayload = useMemo(
    () => ({ fromVillage, toWarehouse, returnDate, reason, notes, itemRows }),
    [fromVillage, toWarehouse, returnDate, reason, notes, itemRows],
  )
  const [draftEnabled, setDraftEnabled] = useState(false)
  const returnDraft = useFormDraft<typeof draftPayload>(
    id ? `warehouse.returns.edit.${id}` : "warehouse.returns.edit.__unknown__",
    draftPayload,
    { enabled: draftEnabled && !!id },
  )
  const [draftBannerOpen, setDraftBannerOpen] = useState(false)
  const [draftBannerSavedAt, setDraftBannerSavedAt] = useState<string | null>(null)
  const draftCheckedRef = useRef(false)

  const handleRestoreDraft = () => {
    const d = returnDraft.restore()
    if (d) {
      setFromVillage(d.fromVillage ?? "")
      setToWarehouse(d.toWarehouse ?? "")
      setReturnDate(d.returnDate ?? "")
      setReason(d.reason ?? "")
      setNotes(d.notes ?? "")
      if (Array.isArray(d.itemRows) && d.itemRows.length > 0) setItemRows(d.itemRows)
    }
    setDraftBannerOpen(false)
    setDraftEnabled(true)
    toast({ title: "Draft restored" })
  }

  const handleDiscardDraft = () => {
    returnDraft.clear()
    setDraftBannerOpen(false)
    setDraftEnabled(true)
  }

  useEffect(() => {
    if (!id) return
    // Hydrate from server exactly once per mount. returnDraft must not be in deps —
    // it returns a new reference on every debounced write and would re-trigger the load.
    if (draftCheckedRef.current) return
    draftCheckedRef.current = true
    void getReturnById(id)
      .then((row) => {
        if (!row) {
          toast({ title: "Not found", variant: "destructive" })
          router.replace("/warehouse/returns")
          return
        }
        setFromVillage(row.fromVillage ?? "")
        setToWarehouse(WH_ID_TO_LABEL[row.toWarehouseId ?? ""] ?? WAREHOUSES[0])
        setReturnDate(row.returnDate?.slice(0, 10) ?? "")
        setReason(reasonDbToUi(row.returnReason))
        setNotes(row.notes ?? "")
        setItemRows(
          row.items.length > 0
            ? row.items.map((it) => ({
                name: it.name,
                qty: it.qty,
                notes: it.notes ?? "",
                serialText: (it.serialNos ?? []).join("\n"),
              }))
            : [{ name: "", qty: 1, notes: "", serialText: "" }]
        )
        if (returnDraft.hasDraft()) {
          setDraftBannerSavedAt(returnDraft.peekSavedAt())
          setDraftBannerOpen(true)
        } else {
          setDraftEnabled(true)
        }
      })
      .catch((err) => {
        toast({
          title: "Could not load return",
          description: err instanceof Error ? err.message : "Try again",
          variant: "destructive",
        })
        router.replace("/warehouse/returns")
      })
      .finally(() => setLoading(false))
    // returnDraft intentionally omitted — guarded by draftCheckedRef above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router, toast])

  const warehouseIdMap: Record<string, string> = {
    "Kurnool Central Warehouse": "WH-002",
    "Hyderabad Central Store": "WH-001",
  }

  const addRow = () =>
    setItemRows((prev) => [...prev, { name: "", qty: 1, notes: "", serialText: "" }])

  const removeRow = (idx: number) =>
    setItemRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))

  const updateRow = (idx: number, field: keyof ReturnItemRow, value: string | number) =>
    setItemRows((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fromVillage || !toWarehouse || !reason) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields.",
        variant: "destructive",
      })
      return
    }
    const validItemsRaw = itemRows.filter((r) => r.name.trim() && r.qty > 0)
    if (validItemsRaw.length === 0) {
      toast({ title: "Validation Error", description: "Add at least one item.", variant: "destructive" })
      return
    }

    let validItems: { name: string; qty: number; notes: string; serialNos?: string[] }[]
    try {
      validItems = validItemsRaw.map((r) => {
        const serials = r.serialText.trim() ? parseSerialLines(r.serialText) : []
        if (serials.length > 0 && serials.length !== r.qty) {
          throw new Error(`Serial line count must match quantity for ${r.name} (${serials.length} ≠ ${r.qty})`)
        }
        return {
          name: r.name,
          qty: r.qty,
          notes: r.notes,
          serialNos: serials.length > 0 ? serials : undefined,
        }
      })
    } catch (err) {
      toast({
        title: "Serial validation",
        description: err instanceof Error ? err.message : "Check serial lines",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      await updateReturn(id, {
        projectId: undefined,
        fromVillage: fromVillage || undefined,
        toWarehouseId: warehouseIdMap[toWarehouse] ?? "WH-002",
        returnDate,
        returnReason:
          reason === "Installation Cancelled"
            ? "installation_cancelled"
            : reason === "Damaged"
              ? "damaged"
              : "excess",
        returnedBy: undefined,
        items: validItems,
        notes: notes.trim() || undefined,
      })
      returnDraft.clear()
      toast({ title: "Return updated", description: `${id} saved.` })
      router.push(`/warehouse/returns/${id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading…
      </div>
    )
  }

  return (
    <div className="w-full px-3 py-4 pb-28 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mb-8">
        <Link
          href={`/warehouse/returns/${id}`}
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to return
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Edit material return</h1>
        <p className="mt-1 text-muted-foreground font-mono text-sm">{id}</p>
      </div>

      {draftBannerOpen ? (
        <div className="mb-4 max-w-4xl">
          <DraftBanner
            savedAt={draftBannerSavedAt}
            onRestore={handleRestoreDraft}
            onDiscard={handleDiscardDraft}
            hint=""
          />
        </div>
      ) : null}

      <form id="returns-edit-form" onSubmit={handleSubmit} className="max-w-4xl space-y-6">
        <Card className="border-border bg-card shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">Return Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fromVillage">
                From Village / Site <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fromVillage"
                value={fromVillage}
                onChange={(e) => setFromVillage(e.target.value)}
                required
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>
                To Warehouse <span className="text-destructive">*</span>
              </Label>
              <Select value={toWarehouse} onValueChange={setToWarehouse} required>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSES.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="returnDate">Return Date</Label>
              <Input
                id="returnDate"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>
                Return Reason <span className="text-destructive">*</span>
              </Label>
              <Select value={reason} onValueChange={(v) => setReason(v as typeof reason)}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addRow} className="rounded-lg">
              <Plus className="mr-1 h-4 w-4" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {itemRows.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_80px_1fr_1fr_auto] items-start"
              >
                <div className="space-y-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">Material</Label>}
                  <Select value={row.name} onValueChange={(v) => updateRow(idx, "name", v)}>
                    <SelectTrigger className="rounded-lg text-sm h-9">
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAL_OPTIONS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">Qty</Label>}
                  <Input
                    type="number"
                    min={1}
                    value={row.qty}
                    onChange={(e) => updateRow(idx, "qty", Number(e.target.value))}
                    className="h-9 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1 sm:col-span-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">Serials (optional)</Label>}
                  <textarea
                    placeholder="One serial per line if tracked"
                    value={row.serialText}
                    onChange={(e) => updateRow(idx, "serialText", e.target.value)}
                    className="min-h-[52px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono"
                    rows={2}
                  />
                </div>
                <div className="space-y-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">Notes</Label>}
                  <Input
                    placeholder="Optional note"
                    value={row.notes}
                    onChange={(e) => updateRow(idx, "notes", e.target.value)}
                    className="h-9 rounded-lg text-sm"
                  />
                </div>
                <div className={idx === 0 ? "mt-5" : ""}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:text-destructive"
                    onClick={() => removeRow(idx)}
                    disabled={itemRows.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">Notes (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-lg"
            />
          </CardContent>
        </Card>

        <div className="hidden justify-end gap-3 sm:flex">
          <Link href={`/warehouse/returns/${id}`}>
            <Button type="button" variant="outline" className="rounded-xl">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-gradient-primary-button text-white hover:opacity-90 rounded-xl"
          >
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-4xl gap-2">
          <Link href={`/warehouse/returns/${id}`} className="flex-1">
            <Button type="button" variant="outline" className="w-full">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            form="returns-edit-form"
            disabled={submitting}
            className="flex-1 bg-gradient-primary-button text-white hover:opacity-90"
          >
            {submitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}
