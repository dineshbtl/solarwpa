"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, PackageSearch, Plus } from "lucide-react"
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
import { listSupplierReturns } from "@/lib/supabase/warehouse"
import type { SupplierMaterialReturn } from "@/lib/store/warehouse"

export default function SupplierReturnsListPage() {
  const [rows, setRows] = useState<SupplierMaterialReturn[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void listSupplierReturns()
      .then(setRows)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10">
      <WarehouseModuleHeader
        title="Supplier RMA"
        description="Vendor returns — defective units shipped back to supplier with PO reference"
        icon={PackageSearch}
        actions={
          <Link href="/warehouse/supplier-returns/new">
            <Button className="rounded-xl bg-gradient-primary-button text-white hover:opacity-90">
              <Plus className="mr-2 h-4 w-4" />
              New supplier RMA
            </Button>
          </Link>
        }
      />

      <Card className="rounded-xl border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Records</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No supplier RMA entries yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>PO</TableHead>
                  <TableHead>From WH</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.id}</TableCell>
                    <TableCell>{r.returnDate}</TableCell>
                    <TableCell>{r.poNumber}</TableCell>
                    <TableCell>{r.fromWarehouseId ?? "—"}</TableCell>
                    <TableCell className="capitalize">{r.status.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.items.length}</TableCell>
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
