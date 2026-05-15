"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Truck, Plus, Package, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { deleteDispatch, listDispatches } from "@/lib/supabase/warehouse"
import type { MaterialDispatch } from "@/lib/store/warehouse"
import { toast } from "@/hooks/use-toast"
import { WarehouseModuleHeader } from "@/components/warehouse/warehouse-module-header"

const STATUS_STYLES: Record<string, string> = {
  dispatched: "bg-blue-100 text-blue-800",
  received: "bg-green-100 text-green-800",
  draft: "bg-gray-100 text-gray-700",
}

export default function DispatchListPage() {
  const [dispatches, setDispatches] = useState<MaterialDispatch[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<MaterialDispatch | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const load = () => {
    setLoading(true)
    listDispatches()
      .then(setDispatches)
      .catch((err) => {
        toast({
          title: "Could not load dispatches",
          description: err instanceof Error ? err.message : "Please refresh.",
          variant: "destructive",
        })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const onDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteDispatch(deleteTarget.id)
      toast({ title: "Dispatch removed", description: `${deleteTarget.dcNumber} deleted.` })
      setDeleteTarget(null)
      load()
    } catch (e) {
      toast({
        title: "Could not delete",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10">
      <WarehouseModuleHeader
        title="DC · Material Dispatch"
        description="Dispatch from Kurnool Central Warehouse; enter the destination village in To Location"
        icon={Truck}
        actions={
          <Link href="/warehouse/dispatch/new">
            <Button className="rounded-xl bg-gradient-primary-button text-white hover:opacity-90">
              <Plus className="mr-2 h-4 w-4" />
              New Dispatch
            </Button>
          </Link>
        }
      />

      {/* List card */}
      <Card className="border-border bg-card shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            Dispatch Challans {!loading && `(${dispatches.length})`}
          </CardTitle>
          <p className="text-sm text-muted-foreground">All delivery challans from Hyderabad to Kurnool</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : dispatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Package className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="text-base font-medium text-foreground mb-1">No dispatches yet</p>
              <p className="text-sm text-muted-foreground mb-6">
                Create the first dispatch to start tracking material movement.
              </p>
              <Link href="/warehouse/dispatch/new">
                <Button className="bg-gradient-primary-button text-white hover:opacity-90 rounded-xl">
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Dispatch
                </Button>
              </Link>
            </div>
          ) : (
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-20 bg-card shadow-[8px_0_10px_-8px_rgba(0,0,0,0.18)]">DC No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle No</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Driver Mobile</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="sticky right-0 z-20 bg-card text-right shadow-[-8px_0_10px_-8px_rgba(0,0,0,0.18)]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dispatches.map((d) => (
                    <TableRow key={d.id} className="hover:bg-muted/40">
                      <TableCell className="sticky left-0 z-10 bg-card font-medium shadow-[8px_0_10px_-8px_rgba(0,0,0,0.12)]">
                        <Link
                          href={`/warehouse/dispatch/${d.id}`}
                          className="underline underline-offset-4 hover:text-green-700"
                        >
                          {d.dcNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {d.dispatchDate
                          ? new Date(d.dispatchDate).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell>{d.vehicleNo || "—"}</TableCell>
                      <TableCell>{d.driverName || "—"}</TableCell>
                      <TableCell>{d.driverMobile || "—"}</TableCell>
                      <TableCell className="text-center">{d.items.length}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                            STATUS_STYLES[d.status] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {d.status}
                        </span>
                      </TableCell>
                      <TableCell className="sticky right-0 z-10 bg-card text-right shadow-[-8px_0_10px_-8px_rgba(0,0,0,0.12)]">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/warehouse/dispatch/${d.id}/edit`}>
                            <Button variant="ghost" size="sm" className="min-h-9">
                              <Pencil className="mr-1.5 h-4 w-4" />
                              Edit
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(d)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="mr-1.5 h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove dispatch challan?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  This deletes <span className="font-medium">{deleteTarget.dcNumber}</span>. Stock views will treat these
                  quantities as never dispatched. You cannot delete if a receipt or household delivery still references
                  this DC.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault()
                void onDeleteConfirm()
              }}
            >
              {isDeleting ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
