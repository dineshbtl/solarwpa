"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { createSupplierReturn, listMaterialDefinitions, listWarehouses } from "@/lib/supabase/warehouse"
import { DEFAULT_WAREHOUSE_ID, DEFAULT_WAREHOUSES, type Warehouse } from "@/lib/store/warehouse"
import type { WarehouseItem } from "@/lib/store/warehouse"

const today = () => new Date().toISOString().split("T")[0]

const STATUSES = ["draft", "sent_to_supplier", "credited", "closed"] as const

interface LineRow {
  materialName: string
  qty: number
  serialText: string
}

export default function NewSupplierReturnPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [warehouses, setWarehouses] = useState<Warehouse[]>(DEFAULT_WAREHOUSES)
  const [materialOptions, setMaterialOptions] = useState<{ name: string }[]>([])

  const [fromWarehouseId, setFromWarehouseId] = useState(DEFAULT_WAREHOUSE_ID)
  const [poNumber, setPoNumber] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [returnDate, setReturnDate] = useState(today())
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("draft")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<LineRow[]>([{ materialName: "", qty: 1, serialText: "" }])

  const draftPayload = useMemo(
    () => ({ fromWarehouseId, poNumber, supplierName, returnDate, status, notes, lines }),
    [fromWarehouseId, poNumber, supplierName, returnDate, status, notes, lines],
  )
  const rmaDraft = useFormDraft<typeof draftPayload>("warehouse.supplier-returns.new", draftPayload)
  const [draftBannerOpen, setDraftBannerOpen] = useState(false)
  const [draftBannerSavedAt, setDraftBannerSavedAt] = useState<string | null>(null)
  const draftCheckedRef = useRef(false)

  useEffect(() => {
    if (draftCheckedRef.current) return
    draftCheckedRef.current = true
    if (rmaDraft.hasDraft()) {
      setDraftBannerSavedAt(rmaDraft.peekSavedAt())
      setDraftBannerOpen(true)
    }
  }, [rmaDraft])

  const handleRestoreDraft = () => {
    const d = rmaDraft.restore()
    if (d) {
      setFromWarehouseId(d.fromWarehouseId ?? DEFAULT_WAREHOUSE_ID)
      setPoNumber(d.poNumber ?? "")
      setSupplierName(d.supplierName ?? "")
      setReturnDate(d.returnDate ?? today())
      setStatus(d.status ?? "draft")
      setNotes(d.notes ?? "")
      if (Array.isArray(d.lines) && d.lines.length > 0) setLines(d.lines)
    }
    setDraftBannerOpen(false)
    toast({ title: "Draft restored" })
  }

  const handleDiscardDraft = () => {
    rmaDraft.clear()
    setDraftBannerOpen(false)
  }

  useEffect(() => {
    let cancelled = false
    void listWarehouses()
      .then((wh) => {
        if (cancelled || !wh?.length) return
        setWarehouses(wh)
        setFromWarehouseId((current) =>
          wh.some((w) => w.id === current)
            ? current
            : wh.find((w) => w.id === DEFAULT_WAREHOUSE_ID)?.id ?? wh[0].id
        )
      })
      .catch(() => {
        /* keep seeded fallback list */
      })
    void listMaterialDefinitions()
      .then((mats) => {
        if (!cancelled) setMaterialOptions(mats.map((m) => ({ name: m.name })))
      })
      .catch(() => {
        if (!cancelled) setMaterialOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const addLine = () => setLines((p) => [...p, { materialName: "", qty: 1, serialText: "" }])
  const removeLine = (i: number) => setLines((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : p))
  const updateLine = (i: number, patch: Partial<LineRow>) =>
    setLines((p) => p.map((row, j) => (j === i ? { ...row, ...patch } : row)))

  function parseSerials(input: string): string[] {
    return [...new Set(input.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))]
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fromWarehouseId || !poNumber.trim()) {
      toast({ title: "Fill required fields", description: "Warehouse and PO number are required.", variant: "destructive" })
      return
    }
    const valid = lines.filter((l) => l.materialName.trim() && l.qty > 0)
    if (valid.length === 0) {
      toast({ title: "Add lines", variant: "destructive" })
      return
    }

    let items: WarehouseItem[]
    try {
      items = valid.map((l) => {
        const serials = l.serialText.trim() ? parseSerials(l.serialText) : []
        if (serials.length > 0 && serials.length !== l.qty) {
          throw new Error(`Serial count must match qty for ${l.materialName}`)
        }
        return {
          name: l.materialName.trim(),
          qty: l.qty,
          unit: "Nos",
          serialNos: serials.length > 0 ? serials : undefined,
        }
      })
    } catch (err) {
      toast({
        title: "Validation",
        description: err instanceof Error ? err.message : "Invalid lines",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      await createSupplierReturn({
        fromWarehouseId,
        poNumber: poNumber.trim(),
        supplierName: supplierName.trim() || undefined,
        returnDate,
        status,
        items,
        notes: notes.trim() || undefined,
      })
      rmaDraft.clear()
      toast({ title: "Supplier RMA saved" })
      router.push("/warehouse/supplier-returns")
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full px-3 py-4 pb-28 sm:px-6 sm:py-6 lg:px-8">
      <Link href="/warehouse/supplier-returns" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Supplier RMA list
      </Link>

      <h1 className="text-2xl font-bold text-foreground">New supplier RMA</h1>
      <p className="mt-1 text-sm text-muted-foreground">Return defective or excess units to the vendor (audited separately from village returns).</p>

      {draftBannerOpen ? (
        <div className="mx-auto mt-4 max-w-4xl">
          <DraftBanner
            savedAt={draftBannerSavedAt}
            onRestore={handleRestoreDraft}
            onDiscard={handleDiscardDraft}
            hint=""
          />
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mx-auto mt-6 max-w-4xl space-y-6">
        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Header</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>From warehouse *</Label>
              <Select value={fromWarehouseId} onValueChange={setFromWarehouseId} required>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select" />
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
              <Label>Return date</Label>
              <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label>PO number *</Label>
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="rounded-lg" required />
            </div>
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="rounded-lg" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as (typeof STATUSES)[number])}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Lines</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {lines.map((line, idx) => (
              <div key={idx} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-12">
                <div className="sm:col-span-4 space-y-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">Material</Label>}
                  <Select value={line.materialName} onValueChange={(v) => updateLine(idx, { materialName: v })}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {materialOptions.map((m) => (
                        <SelectItem key={m.name} value={m.name}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 space-y-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">Qty</Label>}
                  <Input
                    type="number"
                    min={1}
                    value={line.qty}
                    onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })}
                    className="rounded-lg"
                  />
                </div>
                <div className="sm:col-span-5 space-y-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">Serials (recommended)</Label>}
                  <textarea
                    className="min-h-[56px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono"
                    placeholder="One per line — must match qty"
                    value={line.serialText}
                    onChange={(e) => updateLine(idx, { serialText: e.target.value })}
                  />
                </div>
                <div className="flex items-end sm:col-span-1">
                  <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeLine(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="rounded-lg" />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/warehouse/supplier-returns">Cancel</Link>
          </Button>
          <Button type="submit" disabled={submitting} className="rounded-xl">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save RMA
          </Button>
        </div>
      </form>
    </div>
  )
}
