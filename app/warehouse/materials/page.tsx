"use client"

import { useEffect, useState } from "react"
import { BarChart3, Package, Users, TrendingUp, AlertCircle, Plus, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { WarehouseModuleHeader } from "@/components/warehouse/warehouse-module-header"
import {
  createMaterialDefinition,
  getMaterialMasterDashboard,
  type MaterialMasterRow,
} from "@/lib/supabase/warehouse"

function BalanceCell({ value }: { value: number }) {
  if (value > 0)
    return <span className="font-semibold tabular-nums text-green-600">{value.toLocaleString()}</span>
  if (value < 0)
    return (
      <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-red-600">
        <AlertCircle className="h-3.5 w-3.5" />
        {value.toLocaleString()}
      </span>
    )
  return <span className="tabular-nums text-muted-foreground">0</span>
}

function UtilizationSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-5 w-64 rounded bg-muted" />
      <div className="h-4 w-80 rounded bg-muted" />
      <div className="mt-3 flex gap-4">
        <div className="h-10 w-36 rounded-lg bg-muted" />
        <div className="h-10 w-36 rounded-lg bg-muted" />
        <div className="h-10 w-36 rounded-lg bg-muted" />
      </div>
    </div>
  )
}

export default function MaterialMasterPage() {
  const { toast } = useToast()
  const [utilization, setUtilization] = useState<{ totalApproved: number; householdsIssued: number; householdsPending: number } | null>(null)
  const [materials, setMaterials] = useState<MaterialMasterRow[]>([])
  const [loadingUtil, setLoadingUtil] = useState(true)
  const [loadingMat, setLoadingMat] = useState(true)
  const [openAddDialog, setOpenAddDialog] = useState(false)
  const [newMaterialName, setNewMaterialName] = useState("")
  const [newMaterialPerHh, setNewMaterialPerHh] = useState("1")
  const [newMaterialRequiresBarcode, setNewMaterialRequiresBarcode] = useState(false)
  const [newMaterialTrackSerial, setNewMaterialTrackSerial] = useState(true)
  const [savingMaterial, setSavingMaterial] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = async () => {
    getMaterialMasterDashboard()
      .then((data) => {
        setUtilization(data.utilization)
        setMaterials(data.materials)
      })
      .catch((e) => setError(e.message ?? "Failed to load material dashboard"))
      .finally(() => {
        setLoadingUtil(false)
        setLoadingMat(false)
      })
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    const perHh = Number(newMaterialPerHh)
    if (!newMaterialName.trim()) {
      toast({ title: "Validation Error", description: "Material name is required.", variant: "destructive" })
      return
    }
    if (!Number.isFinite(perHh) || perHh <= 0) {
      toast({ title: "Validation Error", description: "Per-household quantity must be greater than 0.", variant: "destructive" })
      return
    }

    setSavingMaterial(true)
    try {
      await createMaterialDefinition({
        name: newMaterialName.trim(),
        perHh,
        requiresBarcode: newMaterialRequiresBarcode,
        trackSerial: newMaterialTrackSerial,
      })
      toast({ title: "Material added", description: `${newMaterialName.trim()} added to master list.` })
      setOpenAddDialog(false)
      setNewMaterialName("")
      setNewMaterialPerHh("1")
      setNewMaterialRequiresBarcode(false)
      setNewMaterialTrackSerial(true)
      await loadDashboard()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add material"
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setSavingMaterial(false)
    }
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10">
      <WarehouseModuleHeader
        title="Material Master"
        description="Required vs GRN vs DC vs issued vs returns — clarified pipeline columns"
        icon={BarChart3}
        actions={
          <Button
            type="button"
            onClick={() => setOpenAddDialog(true)}
            className="gap-2 rounded-xl bg-gradient-primary-button text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add Material
          </Button>
        }
      />

      {/* Project Utilization Card */}
      <Card className="mb-6 border-border bg-card shadow-sm rounded-xl overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-primary-button" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            Project Utilization
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingUtil ? (
            <UtilizationSkeleton />
          ) : utilization ? (
            <div className="space-y-3">
              <div>
                <p className="text-lg font-bold text-foreground">SC & ST PM SURYA GHAR SCHEME</p>
                <p className="text-sm text-muted-foreground">
                  District: <span className="font-medium text-foreground">Kurnool</span>
                  {" · "}
                  System: <span className="font-medium text-foreground">2kW per HH</span>
                  {" · "}
                  Total HH: <span className="font-medium text-foreground">{utilization.totalApproved.toLocaleString()}</span>
                  {" · "}
                  Total Capacity:{" "}
                  <span className="font-medium text-foreground">
                    {((utilization.totalApproved * 2) / 1000).toFixed(2)} MW
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2.5">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Approved</p>
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      {utilization.totalApproved.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2.5">
                  <Package className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">HH Issued</p>
                    <p className="text-lg font-bold tabular-nums text-green-700">
                      {utilization.householdsIssued > 0 ? utilization.householdsIssued.toLocaleString() : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-yellow-50 px-4 py-2.5">
                  <BarChart3 className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">HH Pending</p>
                    <p className="text-lg font-bold tabular-nums text-yellow-700">
                      {utilization.householdsPending > 0 ? utilization.householdsPending.toLocaleString() : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-destructive">{error ?? "Failed to load"}</p>
          )}
        </CardContent>
      </Card>

      {/* Material Balance Table */}
      <Card className="border-border bg-card shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-muted-foreground" />
            Material Balance
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Based on 8,929 total approved households. GRN and DC columns are cumulative project totals (receipts and challan lines). Pipeline sums those two flows — it is not physical stock. On-hand at KNL uses warehouse WH-002 (Kurnool): GRN in, minus DC out, plus DC in and field returns to KNL, minus supplier RMA from KNL — same logic as the Stock Report for that warehouse.
          </p>
        </CardHeader>
        <CardContent>
            <Table className="min-w-[1280px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Required (8929 HH)</TableHead>
                  <TableHead className="text-right">Total GRN received</TableHead>
                  <TableHead className="text-right">DC dispatch only</TableHead>
                  <TableHead className="text-right">Pipeline (GRN + DC)</TableHead>
                  <TableHead className="text-right">Issued to Villages</TableHead>
                  <TableHead className="text-right">Field returns</TableHead>
                  <TableHead className="text-right">Supplier RMA out (total)</TableHead>
                  <TableHead className="text-right">On hand at KNL (WH-002)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMat
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 9 }).map((__, j) => (
                          <TableCell key={j}>
                            <div className="h-4 animate-pulse rounded bg-muted" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : materials.length === 0
                  ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                        No material data available.
                      </TableCell>
                    </TableRow>
                  )
                  : materials.map((row) => (
                      <TableRow key={row.material} className="hover:bg-muted/40">
                        <TableCell className="font-medium">{row.material}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {row.requiredTotal.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.inwardQty > 0
                            ? row.inwardQty.toLocaleString()
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.dcChallanQty > 0
                            ? row.dcChallanQty.toLocaleString()
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {row.inwardPlusDispatchQty > 0
                            ? row.inwardPlusDispatchQty.toLocaleString()
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.issued > 0
                            ? row.issued.toLocaleString()
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.returned > 0
                            ? <span className="text-green-600">{row.returned.toLocaleString()}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.supplierRmaQty > 0
                            ? row.supplierRmaQty.toLocaleString()
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <BalanceCell value={row.knLiveQty} />
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
        </CardContent>
      </Card>

      <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Material</DialogTitle>
          </DialogHeader>
          <form id="add-material-form" className="space-y-4 pt-1" onSubmit={handleAddMaterial}>
            <div className="space-y-2">
              <Label htmlFor="material-name">Material Name</Label>
              <Input
                id="material-name"
                placeholder="e.g. Junction Box"
                value={newMaterialName}
                onChange={(e) => setNewMaterialName(e.target.value)}
                disabled={savingMaterial}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-per-hh">Required Per HH</Label>
              <Input
                id="material-per-hh"
                type="number"
                min={1}
                step={1}
                value={newMaterialPerHh}
                onChange={(e) => setNewMaterialPerHh(e.target.value)}
                disabled={savingMaterial}
              />
            </div>
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="mat-req-bc"
                  checked={newMaterialRequiresBarcode}
                  onCheckedChange={(v) => setNewMaterialRequiresBarcode(v === true)}
                  disabled={savingMaterial}
                />
                <Label htmlFor="mat-req-bc" className="text-sm font-normal cursor-pointer">
                  Require barcode scan (one per serial on inward)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="mat-track-serial"
                  checked={newMaterialTrackSerial}
                  onCheckedChange={(v) => setNewMaterialTrackSerial(v === true)}
                  disabled={savingMaterial}
                />
                <Label htmlFor="mat-track-serial" className="text-sm font-normal cursor-pointer">
                  Track serial numbers
                </Label>
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenAddDialog(false)} disabled={savingMaterial}>
              Cancel
            </Button>
            <Button type="submit" form="add-material-form" disabled={savingMaterial}>
              {savingMaterial && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {savingMaterial ? "Saving..." : "Save Material"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
