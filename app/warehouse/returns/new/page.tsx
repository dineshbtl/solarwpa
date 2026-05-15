"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
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
import { createReturn, listMaterialDefinitions, listWarehouses } from "@/lib/supabase/warehouse"
import type { MaterialDefinition } from "@/lib/supabase/warehouse"
import { DEFAULT_WAREHOUSE_ID, DEFAULT_WAREHOUSES, type Warehouse } from "@/lib/store/warehouse"

const today = () => new Date().toISOString().split("T")[0]

const REASONS = ["Excess", "Installation Cancelled", "Damaged"] as const

interface ReturnItemRow {
  name: string
  qty: number
  notes: string
  /** Optional — when set, must match qty for traceability */
  serialText: string
}

function parseSerialLines(input: string): string[] {
  return [...new Set(input.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))]
}

export default function NewReturnPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [warehouses, setWarehouses] = useState<Warehouse[]>(DEFAULT_WAREHOUSES)
  const [materialOptions, setMaterialOptions] = useState<MaterialDefinition[]>([])

  const [fromVillage, setFromVillage] = useState("")
  const [toWarehouseId, setToWarehouseId] = useState(DEFAULT_WAREHOUSE_ID)
  const [returnDate, setReturnDate] = useState(today())
  const [reason, setReason] = useState<(typeof REASONS)[number] | "">("")
  const [notes, setNotes] = useState("")
  const [itemRows, setItemRows] = useState<ReturnItemRow[]>([
    { name: "", qty: 1, notes: "", serialText: "" },
  ])
  const [submitting, setSubmitting] = useState(false)

  const draftPayload = useMemo(
    () => ({ fromVillage, toWarehouseId, returnDate, reason, notes, itemRows }),
    [fromVillage, toWarehouseId, returnDate, reason, notes, itemRows],
  )
  const returnDraft = useFormDraft<typeof draftPayload>("warehouse.returns.new", draftPayload)
  const [draftBannerOpen, setDraftBannerOpen] = useState(false)
  const [draftBannerSavedAt, setDraftBannerSavedAt] = useState<string | null>(null)
  const draftCheckedRef = useRef(false)

  useEffect(() => {
    if (draftCheckedRef.current) return
    draftCheckedRef.current = true
    if (returnDraft.hasDraft()) {
      setDraftBannerSavedAt(returnDraft.peekSavedAt())
      setDraftBannerOpen(true)
    }
  }, [returnDraft])

  const handleRestoreDraft = () => {
    const d = returnDraft.restore()
    if (d) {
      setFromVillage(d.fromVillage ?? "")
      setToWarehouseId(d.toWarehouseId ?? DEFAULT_WAREHOUSE_ID)
      setReturnDate(d.returnDate ?? today())
      setReason(d.reason ?? "")
      setNotes(d.notes ?? "")
      if (Array.isArray(d.itemRows) && d.itemRows.length > 0) setItemRows(d.itemRows)
    }
    setDraftBannerOpen(false)
    toast({ title: "Draft restored" })
  }

  const handleDiscardDraft = () => {
    returnDraft.clear()
    setDraftBannerOpen(false)
  }

  useEffect(() => {
    let cancelled = false
    void listWarehouses()
      .then((wh) => {
        if (cancelled || !wh?.length) return
        setWarehouses(wh)
        setToWarehouseId((current) =>
          wh.some((w) => w.id === current)
            ? current
            : wh.find((w) => w.id === DEFAULT_WAREHOUSE_ID)?.id ?? wh[0].id
        )
      })
      .catch(() => {
        /* keep DEFAULT_WAREHOUSES */
      })
    void listMaterialDefinitions()
      .then((mats) => {
        if (!cancelled) setMaterialOptions(mats)
      })
      .catch(() => {
        if (!cancelled) setMaterialOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const addRow = () =>
    setItemRows((prev) => [...prev, { name: "", qty: 1, notes: "", serialText: "" }])

  const removeRow = (idx: number) =>
    setItemRows((prev) => prev.filter((_, i) => i !== idx))

  const updateRow = (idx: number, field: keyof ReturnItemRow, value: string | number) =>
    setItemRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fromVillage || !toWarehouseId || !reason) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields.",
        variant: "destructive",
      })
      return
    }
    const validItemsRaw = itemRows.filter((r) => r.name.trim() && r.qty > 0)
    if (validItemsRaw.length === 0) {
      toast({
        title: "Validation Error",
        description: "Add at least one item.",
        variant: "destructive",
      })
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
      const created = await createReturn({
        projectId: undefined,
        fromVillage: fromVillage || undefined,
        toWarehouseId,
        returnDate,
        returnReason: (reason === "Installation Cancelled" ? "installation_cancelled" : reason === "Damaged" ? "damaged" : "excess") as "excess" | "installation_cancelled" | "damaged",
        returnedBy: undefined,
        items: validItems,
        notes: notes.trim() || undefined,
      })
      returnDraft.clear()
      toast({ title: "Return recorded", description: `Return ${created.id} saved successfully.` })
      router.push("/warehouse/returns")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full px-3 py-4 pb-28 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/warehouse/returns"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Material Returns
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Record Material Return</h1>
        <p className="mt-1 text-muted-foreground">
          Record materials returned from a village or installation site
        </p>
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

      <form id="returns-new-form" onSubmit={handleSubmit} className="max-w-4xl space-y-6">
        {/* Return Info */}
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
                placeholder="e.g. A.Gokulapadu, Kalluru"
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
              <Select value={toWarehouseId} onValueChange={setToWarehouseId} required>
                <SelectTrigger className="rounded-lg w-full min-w-0">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
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

        {/* Items */}
        <Card className="border-border bg-card shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Items</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              className="rounded-lg"
            >
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
                  {idx === 0 && (
                    <Label className="text-xs text-muted-foreground">Material</Label>
                  )}
                  <Select
                    value={row.name}
                    onValueChange={(v) => updateRow(idx, "name", v)}
                  >
                    <SelectTrigger className="rounded-lg text-sm h-9">
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(70vh,22rem)]">
                      {materialOptions.map((m) => (
                        <SelectItem key={m.id} value={m.name}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  {idx === 0 && (
                    <Label className="text-xs text-muted-foreground">Qty</Label>
                  )}
                  <Input
                    type="number"
                    min={1}
                    value={row.qty}
                    onChange={(e) => updateRow(idx, "qty", Number(e.target.value))}
                    className="h-9 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-1 sm:col-span-1">
                  {idx === 0 && (
                    <Label className="text-xs text-muted-foreground">Serials (optional)</Label>
                  )}
                  <textarea
                    placeholder="Wedge scan — one serial per line (must match qty if used)"
                    value={row.serialText}
                    onChange={(e) => updateRow(idx, "serialText", e.target.value)}
                    className="min-h-[52px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono"
                    rows={2}
                  />
                </div>
                <div className="space-y-1">
                  {idx === 0 && (
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                  )}
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

        {/* Notes */}
        <Card className="border-border bg-card shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">Notes (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Additional remarks about this return..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-lg"
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="hidden justify-end gap-3 sm:flex">
          <Link href="/warehouse/returns">
            <Button type="button" variant="outline" className="rounded-xl">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-gradient-primary-button text-white hover:opacity-90 rounded-xl"
          >
            {submitting ? "Saving…" : "Record Return"}
          </Button>
        </div>
      </form>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-4xl gap-2">
          <Link href="/warehouse/returns" className="flex-1">
            <Button type="button" variant="outline" className="w-full">Cancel</Button>
          </Link>
          <Button type="submit" form="returns-new-form" disabled={submitting} className="flex-1 bg-gradient-primary-button text-white hover:opacity-90">
            {submitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}
