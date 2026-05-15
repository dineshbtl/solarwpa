"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, RotateCcw, MapPin, Warehouse, Calendar, Hash, Pencil, Trash2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { toast } from "@/hooks/use-toast"
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
import { deleteReturn, listReturns } from "@/lib/supabase/warehouse"
import type { MaterialReturn } from "@/lib/store/warehouse"

const WH_LABEL: Record<string, string> = {
  "WH-001": "Hyderabad Central Store",
  "WH-002": "Kurnool Central Warehouse",
}

const REASON_COLORS: Record<string, string> = {
  excess: "bg-yellow-100 text-yellow-800",
  installation_cancelled: "bg-red-100 text-red-800",
  damaged: "bg-orange-100 text-orange-800",
}

export default function MaterialReturnsPage() {
  const [returns, setReturns] = useState<MaterialReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MaterialReturn | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    listReturns()
      .then(setReturns)
      .catch((e: Error) => setError(e.message ?? "Failed to load"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const onDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteReturn(deleteTarget.id)
      toast({ title: "Return deleted", description: `${deleteTarget.id} removed.` })
      setDeleteTarget(null)
      load()
    } catch (e) {
      toast({
        title: "Could not delete",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10">
      <WarehouseModuleHeader
        title="Field returns"
        description="Unused or damaged material from villages back to district warehouse (not supplier RMA)"
        icon={Undo2}
        actions={
          <Link href="/warehouse/returns/new">
            <Button className="rounded-xl bg-gradient-primary-button text-white hover:opacity-90">
              <Plus className="mr-2 h-4 w-4" />
              New Return
            </Button>
          </Link>
        }
      />

      {/* Content */}
      <Card className="border-border bg-card shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-muted-foreground" />
            Return Records ({loading ? "…" : returns.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : returns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="rounded-full bg-muted p-5">
                <RotateCcw className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-foreground">No returns recorded</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Record a new material return when items come back to the warehouse.
                </p>
              </div>
              <Link href="/warehouse/returns/new">
                <Button className="bg-gradient-primary-button text-white hover:opacity-90 rounded-xl">
                  <Plus className="mr-2 h-4 w-4" />
                  New Return
                </Button>
              </Link>
            </div>
          ) : (
              <Table className="min-w-[960px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-20 bg-card shadow-[8px_0_10px_-8px_rgba(0,0,0,0.18)]">
                      <span className="flex items-center gap-1">
                        <Hash className="h-3.5 w-3.5" /> Return ID
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> Village / Site
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1">
                        <Warehouse className="h-3.5 w-3.5" /> Warehouse
                      </span>
                    </TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> Date
                      </span>
                    </TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.map((ret) => (
                    <TableRow key={ret.id} className="hover:bg-muted/40">
                      <TableCell className="sticky left-0 z-10 bg-card font-medium shadow-[8px_0_10px_-8px_rgba(0,0,0,0.12)]">
                        <Link href={`/warehouse/returns/${ret.id}`} className="underline-offset-2 hover:underline">
                          {ret.id}
                        </Link>
                      </TableCell>
                      <TableCell>{ret.fromVillage ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {ret.toWarehouseId ? WH_LABEL[ret.toWarehouseId] ?? ret.toWarehouseId : "—"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            REASON_COLORS[ret.returnReason] ?? "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {ret.returnReason.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell>
                        {ret.returnDate
                          ? new Date(ret.returnDate).toLocaleDateString("en-IN")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          {Array.isArray(ret.items) ? ret.items.length : 0} items
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Edit">
                            <Link href={`/warehouse/returns/${ret.id}/edit`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete"
                            onClick={() => setDeleteTarget(ret)}
                          >
                            <Trash2 className="h-4 w-4" />
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
            <AlertDialogTitle>Delete this return?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {deleteTarget?.id} from the ledger. Stock calculations will treat these quantities as never returned.
              Only delete if the entry was recorded by mistake.
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
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
