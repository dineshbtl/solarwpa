"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Info, Upload } from "lucide-react"
import { useFormDraft } from "@/lib/store/use-form-draft"
import { DraftBanner } from "@/components/draft-banner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  calcVillageIssueItems,
  type VillageIssueItem,
  type VillageIssueTemplateItem,
} from "@/lib/store/warehouse"
import { createVillageIssue, listMaterialDefinitions } from "@/lib/supabase/warehouse"

const today = () => new Date().toISOString().split("T")[0]
const SOLAR_PANEL_NAME = "Solar PV Module"

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

export default function NewVillageIssuePage() {
  const router = useRouter()
  const { toast } = useToast()

  const [mandal, setMandal] = useState("")
  const [village, setVillage] = useState("")
  const [households, setHouseholds] = useState<number>(0)
  const [challanNo, setChallanNo] = useState("")
  const [issueDate, setIssueDate] = useState(today())
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<VillageIssueItem[]>([])
  const [masterItems, setMasterItems] = useState<VillageIssueTemplateItem[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Persist text fields only — `items` is auto-recalculated from households + masterItems each render.
  const draftPayload = useMemo(
    () => ({ mandal, village, households, challanNo, issueDate, notes }),
    [mandal, village, households, challanNo, issueDate, notes],
  )
  const villageDraft = useFormDraft<typeof draftPayload>("warehouse.villages.new", draftPayload)
  const [draftBannerOpen, setDraftBannerOpen] = useState(false)
  const [draftBannerSavedAt, setDraftBannerSavedAt] = useState<string | null>(null)
  const draftCheckedRef = useRef(false)

  useEffect(() => {
    if (draftCheckedRef.current) return
    draftCheckedRef.current = true
    if (villageDraft.hasDraft()) {
      setDraftBannerSavedAt(villageDraft.peekSavedAt())
      setDraftBannerOpen(true)
    }
  }, [villageDraft])

  const handleRestoreDraft = () => {
    const d = villageDraft.restore()
    if (d) {
      setMandal(d.mandal ?? "")
      setVillage(d.village ?? "")
      setHouseholds(typeof d.households === "number" ? d.households : 0)
      setChallanNo(d.challanNo ?? "")
      setIssueDate(d.issueDate ?? today())
      setNotes(d.notes ?? "")
    }
    setDraftBannerOpen(false)
    toast({ title: "Draft restored", description: "Item quantities will auto-recalculate." })
  }

  const handleDiscardDraft = () => {
    villageDraft.clear()
    setDraftBannerOpen(false)
  }

  useEffect(() => {
    void listMaterialDefinitions()
      .then((definitions) => {
        setMasterItems(
          definitions.map((row) => ({
            name: row.name,
            qtyPerHh: row.perHh,
            unit: row.unit ?? "Nos",
          }))
        )
      })
      .catch(() => {
        toast({
          title: "Material master unavailable",
          description: "Could not load item master list. Please try again.",
          variant: "destructive",
        })
      })
  }, [toast])

  useEffect(() => {
    if (households > 0) {
      setItems(calcVillageIssueItems(households, masterItems))
    } else {
      setItems([])
    }
  }, [households, masterItems])

  const handleQtyPerHHChange = (index: number, value: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, qtyPerHh: value, totalQty: value * households }
          : item
      )
    )
  }

  const handleImportSerials = async (index: number, file: File) => {
    try {
      const serials = await parseSerialsFromExcel(file)
      if (serials.length === 0) {
        toast({ title: "No serials found", description: "Excel file appears empty.", variant: "destructive" })
        return
      }
      setItems((prev) =>
        prev.map((item, i) =>
          i === index
            ? { ...item, serialNos: serials, totalQty: serials.length, qtyPerHh: households > 0 ? serials.length / households : item.qtyPerHh }
            : item
        )
      )
      toast({ title: "Serials imported", description: `${serials.length} serial numbers loaded.` })
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Could not parse Excel file.",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mandal || !village || !households || !challanNo) {
      toast({ title: "Validation Error", description: "Please fill all required fields.", variant: "destructive" })
      return
    }
    const panelItem = items.find((item) => item.name === SOLAR_PANEL_NAME)
    if (panelItem && panelItem.totalQty > 0 && (!panelItem.serialNos || panelItem.serialNos.length !== panelItem.totalQty)) {
      toast({
        title: "Panel serials required",
        description: "Import Solar PV Module serial numbers equal to total quantity before submitting.",
        variant: "destructive",
      })
      return
    }
    setSubmitting(true)
    try {
      await createVillageIssue({
        issueChallanNo: challanNo,
        mandal,
        villageName: village,
        householdsApproved: households,
        issueDate,
        notes: notes || undefined,
        items,
        projectId: undefined,
        fromWarehouseId: "WH-002",
        issuedBy: undefined,
      })
      villageDraft.clear()
      toast({ title: "Village issue created", description: `Challan ${challanNo} saved successfully.` })
      router.push("/warehouse/villages")
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
          href="/warehouse/villages"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Village Issues
        </Link>
        <h1 className="text-3xl font-bold text-foreground">New Village Issue</h1>
        <p className="mt-1 text-muted-foreground">
          Issue materials from Kurnool Warehouse to a village
        </p>
      </div>

      {draftBannerOpen ? (
        <div className="mb-4 max-w-4xl">
          <DraftBanner
            savedAt={draftBannerSavedAt}
            onRestore={handleRestoreDraft}
            onDiscard={handleDiscardDraft}
            hint="Item quantities are recalculated from households — re-upload Solar PV serials after restore."
          />
        </div>
      ) : null}

      <form id="villages-new-form" onSubmit={handleSubmit} className="max-w-4xl space-y-6">
        {/* Section 1: Location */}
        <Card className="border-border bg-card shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">Section 1 — Location</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mandal">
                Mandal <span className="text-destructive">*</span>
              </Label>
              <Input
                id="mandal"
                placeholder="e.g. Kalluru"
                value={mandal}
                onChange={(e) => setMandal(e.target.value)}
                required
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="village">
                Village Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="village"
                placeholder="e.g. A.Gokulapadu"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                required
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="households">
                Households Approved <span className="text-destructive">*</span>
              </Label>
              <Input
                id="households"
                type="number"
                min={1}
                placeholder="e.g. 120"
                value={households || ""}
                onChange={(e) => setHouseholds(Number(e.target.value))}
                required
                className="rounded-lg"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Issue Details */}
        <Card className="border-border bg-card shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">Section 2 — Issue Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="challanNo">
                Issue Challan No <span className="text-destructive">*</span>
              </Label>
              <Input
                id="challanNo"
                placeholder="e.g. VIC-2026-001"
                value={challanNo}
                onChange={(e) => setChallanNo(e.target.value)}
                required
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue Date</Label>
              <Input
                id="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="rounded-lg"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Items */}
        <Card className="border-border bg-card shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">Section 3 — Items (Auto-calculated)</CardTitle>
          </CardHeader>
          <CardContent>
            {households > 0 && items.length > 0 ? (
              <>
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Quantities auto-calculated based on households. Edit individual rows if needed.
                  </span>
                </div>
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  <Upload className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    For <strong>Solar PV Module</strong>, upload serial numbers from supplier Excel. Stock and duplicates are validated from inward history.
                  </span>
                </div>
                <div>
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead className="w-32">Qty / HH</TableHead>
                        <TableHead className="w-24">Unit</TableHead>
                        <TableHead className="w-28">Total</TableHead>
                        <TableHead className="w-56">Serial Import</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => (
                        <TableRow key={item.name}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={item.qtyPerHh}
                              onChange={(e) =>
                                handleQtyPerHHChange(idx, Number(e.target.value))
                              }
                              className="h-8 w-20 rounded-md text-sm"
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                          <TableCell className="font-semibold tabular-nums">{item.totalQty}</TableCell>
                          <TableCell>
                            {item.name === SOLAR_PANEL_NAME ? (
                              <div className="space-y-1">
                                <Input
                                  type="file"
                                  accept=".xlsx,.xls,.csv"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) void handleImportSerials(idx, file)
                                  }}
                                  className="h-8 text-xs"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                  {item.serialNos?.length ? `${item.serialNos.length} serials imported` : "Upload panel serial Excel"}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Qty-based item</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Enter the number of households to see auto-calculated quantities.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Section 4: Notes */}
        <Card className="border-border bg-card shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">Section 4 — Notes (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Any additional notes for this issue..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-lg"
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="hidden justify-end gap-3 sm:flex">
          <Link href="/warehouse/villages">
            <Button type="button" variant="outline" className="rounded-xl">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-gradient-primary-button text-white hover:opacity-90 rounded-xl"
          >
            {submitting ? "Saving…" : "Create Village Issue"}
          </Button>
        </div>
      </form>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-4xl gap-2">
          <Link href="/warehouse/villages" className="flex-1">
            <Button type="button" variant="outline" className="w-full">Cancel</Button>
          </Link>
          <Button type="submit" form="villages-new-form" disabled={submitting} className="flex-1 bg-gradient-primary-button text-white hover:opacity-90">
            {submitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}
