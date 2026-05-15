"use client"

import { useEffect, useMemo, useState } from "react"
import { ClipboardList, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { WarehouseModuleHeader } from "@/components/warehouse/warehouse-module-header"
import { getWarehouseStockBalances, listWarehouses } from "@/lib/supabase/warehouse"
import {
  DEFAULT_WAREHOUSE_ID,
  DEFAULT_WAREHOUSES,
  resolveDefaultWarehouseId,
  type Warehouse,
} from "@/lib/store/warehouse"

export default function StockReportPage() {
  // Render with the seeded list immediately — no network wait for the dropdown.
  const [warehouses, setWarehouses] = useState<Warehouse[]>(DEFAULT_WAREHOUSES)
  const [warehouseId, setWarehouseId] = useState<string>(DEFAULT_WAREHOUSE_ID)
  const [rows, setRows] = useState<Array<{ material: string; qty: number }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Refresh the dropdown in the background; ignore failures so the UI never blocks.
    void listWarehouses()
      .then((w) => {
        if (cancelled || !w?.length) return
        setWarehouses(w)
        setWarehouseId((current) =>
          w.some((wh) => wh.id === current) ? current : resolveDefaultWarehouseId(w)
        )
      })
      .catch(() => {
        /* keep seeded fallback list */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!warehouseId) return
    let cancelled = false
    setLoading(true)
    void getWarehouseStockBalances(warehouseId)
      .then((r) => {
        if (!cancelled) setRows(r)
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [warehouseId])

  const selectedWarehouse = useMemo(
    () => warehouses.find((w) => w.id === warehouseId),
    [warehouses, warehouseId]
  )

  function exportCsv() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    const exportDateStr = `${y}-${m}-${day}`
    const esc = (v: string) => {
      if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
      return v
    }
    const lines = [
      `Warehouse,${esc(selectedWarehouse?.name ?? "")}`,
      `Export date,${exportDateStr}`,
      "",
      ["Material", "Qty balance"].join(","),
      ...rows.map((r) => [esc(r.material), String(r.qty)].join(",")),
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `warehouse_stock_report_${exportDateStr}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10">
      <WarehouseModuleHeader
        title="Stock report"
        description="Per-warehouse quantity balances from inward, dispatch, returns, and supplier RMA"
        icon={ClipboardList}
        actions={
          <div className="w-full max-w-xs space-y-2 sm:w-56">
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="rounded-lg">
                <SelectValue>{selectedWarehouse?.name ?? "Select warehouse"}</SelectValue>
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
        }
      />

      <Card className="rounded-xl border-border shadow-sm overflow-x-auto">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">
            On-hand (qty roll-up){selectedWarehouse?.name ? ` — ${selectedWarehouse.name}` : ""}
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg shrink-0"
            disabled={loading || rows.length === 0}
            onClick={exportCsv}
          >
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Qty balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.material}>
                    <TableCell className="font-medium">{r.material}</TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-semibold ${r.qty < 0 ? "text-destructive" : r.qty > 0 ? "text-green-600" : "text-muted-foreground"}`}
                    >
                      {r.qty.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
