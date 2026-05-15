"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
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
import { deleteReturn, getReturnById } from "@/lib/supabase/warehouse"
import { listEntityActivity, type ActivityLogEntry } from "@/lib/supabase/activity-log"
import type { MaterialReturn } from "@/lib/store/warehouse"

const WH_LABEL: Record<string, string> = {
  "WH-001": "Hyderabad Central Store",
  "WH-002": "Kurnool Central Warehouse",
}

export default function ReturnDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [row, setRow] = useState<MaterialReturn | null>(null)
  const [loading, setLoading] = useState(true)
  const [activity, setActivity] = useState<ActivityLogEntry[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    getReturnById(id)
      .then((res) => setRow(res ?? null))
      .catch((err) =>
        toast({
          title: "Could not load return",
          description: err instanceof Error ? err.message : "Please refresh.",
          variant: "destructive",
        })
      )
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    void listEntityActivity("warehouse_return", id)
      .then(setActivity)
      .catch(() => setActivity([]))
  }, [id])

  if (loading) {
    return (
      <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (!row) {
    return (
      <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <p className="text-destructive">Return entry not found.</p>
        <Link href="/warehouse/returns" className="mt-3 inline-block text-sm underline">
          ← Back to Returns
        </Link>
      </div>
    )
  }

  const onDeleteConfirm = async () => {
    setIsDeleting(true)
    try {
      await deleteReturn(row.id)
      toast({ title: "Return deleted", description: `${row.id} removed.` })
      setDeleteOpen(false)
      router.push("/warehouse/returns")
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <Link href="/warehouse/returns">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Returns
          </Button>
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/warehouse/returns/${row.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="border-border bg-card shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg">Return Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Return ID</p>
              <p className="font-medium">{row.id}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Return Date</p>
              <p className="font-medium">{new Date(row.returnDate).toLocaleDateString("en-IN")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reason</p>
              <p className="font-medium capitalize">{row.returnReason.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">From Village / Site</p>
              <p>{row.fromVillage || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">To Warehouse</p>
              <p>
                {row.toWarehouseId
                  ? WH_LABEL[row.toWarehouseId] ?? row.toWarehouseId
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Returned By</p>
              <p>{row.returnedBy || "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg">Items ({row.items.length})</CardTitle>
          </CardHeader>
          <CardContent>
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Material Name</TableHead>
                    <TableHead className="text-center">Quantity</TableHead>
                    <TableHead className="text-center">Unit</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {row.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No items recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    row.items.map((item, idx) => (
                      <TableRow key={`${item.name}-${idx}`}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-center">{item.qty}</TableCell>
                        <TableCell className="text-center">{item.unit || "Nos"}</TableCell>
                        <TableCell className="max-w-[420px]">
                          <p className="truncate text-sm text-muted-foreground">{item.notes || "—"}</p>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
          </CardContent>
        </Card>

        {row.notes && (
          <Card className="border-border bg-card shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{row.notes}</p>
            </CardContent>
          </Card>
        )}

        {activity.length > 0 && (
          <Card className="border-border bg-card shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg">Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activity.map((evt) => {
                  const changedFields = Array.isArray(evt.meta?.changedFields)
                    ? (evt.meta?.changedFields as string[])
                    : []
                  return (
                    <div key={evt.id} className="rounded-md border border-border px-3 py-2">
                      <p className="text-sm font-medium">{evt.message}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {evt.actorName || "System"} · {new Date(evt.createdAt).toLocaleString("en-IN")}
                      </p>
                      {changedFields.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Changed: {changedFields.join(", ")}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this return?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {row.id} from the ledger. Stock calculations will treat these quantities as never returned.
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
