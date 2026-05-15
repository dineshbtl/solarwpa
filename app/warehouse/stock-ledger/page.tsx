"use client"

import { useEffect, useState } from "react"
import { Loader2, ScrollText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { WarehouseModuleHeader } from "@/components/warehouse/warehouse-module-header"
import { getStockLedgerMovements, type LedgerMovementRow } from "@/lib/supabase/warehouse"

export default function StockLedgerPage() {
  const [rows, setRows] = useState<LedgerMovementRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void getStockLedgerMovements()
      .then(setRows)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10">
      <WarehouseModuleHeader
        title="Stock ledger"
        description="Chronological movement audit (GRN, DC, village issue, returns, RMA)"
        icon={ScrollText}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={rows.length === 0}
            onClick={() => {
              const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
              const header = ["occurredAt", "docType", "docId", "material", "qty", "direction", "label"]
              const lines = [
                header.join(","),
                ...rows.map((r) =>
                  [
                    esc(r.occurredAt),
                    esc(r.docType),
                    esc(r.docId),
                    esc(r.material),
                    String(r.qty),
                    esc(r.direction),
                    esc(r.label),
                  ].join(",")
                ),
              ]
              const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = `stock-ledger-${new Date().toISOString().slice(0, 10)}.csv`
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            Export CSV
          </Button>
        }
      />

      <Card className="mt-6 rounded-xl border-border shadow-sm overflow-x-auto">
        <CardHeader>
          <CardTitle className="text-base">Movements</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading ledger…
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No movements recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Doc</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>In/Out</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={`${r.docId}-${r.material}-${i}`}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.occurredAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs capitalize">{r.docType.replace(/_/g, " ")}</TableCell>
                    <TableCell className="font-mono text-xs">{r.docId}</TableCell>
                    <TableCell className="font-medium">{r.material}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.qty}</TableCell>
                    <TableCell>
                      <span className={r.direction === "in" ? "text-green-600 font-medium" : "text-rose-600 font-medium"}>
                        {r.direction === "in" ? "In" : "Out"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground" title={r.label}>
                      {r.label}
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
