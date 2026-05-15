"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { deleteInward, getInwardById } from "@/lib/supabase/warehouse"
import { listEntityActivity, type ActivityLogEntry } from "@/lib/supabase/activity-log"
import type { MaterialInward } from "@/lib/store/warehouse"

export default function InwardDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [inward, setInward] = useState<MaterialInward | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activity, setActivity] = useState<ActivityLogEntry[]>([])

  useEffect(() => {
    if (!id) return
    getInwardById(id)
      .then((entry) => setInward(entry ?? null))
      .catch((err) =>
        toast({
          title: "Could not load inward entry",
          description: err instanceof Error ? err.message : "Please refresh.",
          variant: "destructive",
        })
      )
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    void listEntityActivity("warehouse_inward", id)
      .then(setActivity)
      .catch(() => setActivity([]))
  }, [id])

  const handleDelete = async () => {
    if (!inward) return
    setIsDeleting(true)
    try {
      await deleteInward(inward.id)
      toast({ title: "Inward removed", description: `${inward.id} has been deleted.` })
      router.push("/warehouse/inward")
    } catch (err) {
      toast({
        title: "Could not remove inward",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
      setIsDeleting(false)
      setDeleteOpen(false)
    }
  }

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

  if (!inward) {
    return (
      <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <p className="text-destructive">Inward entry not found.</p>
        <Link href="/warehouse/inward" className="mt-3 inline-block text-sm underline">
          ← Back to Inward
        </Link>
      </div>
    )
  }

  const formattedDate = new Date(inward.inwardDate).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <Link href="/warehouse/inward">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Inward
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/warehouse/inward/${inward.id}/edit`}>
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Remove Inward
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="border-border bg-card shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg">Inward Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Inward ID</p>
              <p className="font-medium">{inward.id}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="font-medium">{formattedDate}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">PO Number</p>
              <p className="font-medium">{inward.poNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reference</p>
              <p>{inward.refNo || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Supplier</p>
              <p>{inward.supplierName || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Warehouse</p>
              <p>{inward.warehouseId || "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg">Items ({inward.items.length})</CardTitle>
          </CardHeader>
          <CardContent>
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Material Name</TableHead>
                    <TableHead className="text-center">Quantity</TableHead>
                    <TableHead className="text-center">Unit</TableHead>
                    <TableHead>Serial Nos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inward.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No items recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    inward.items.map((item, idx) => (
                      <TableRow key={`${item.name}-${idx}`}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-center">{item.qty}</TableCell>
                        <TableCell className="text-center">{item.unit || "Nos"}</TableCell>
                        <TableCell className="max-w-[420px]">
                          <p className="whitespace-normal break-words text-sm text-muted-foreground">
                            {(item.serialNos ?? []).length > 0 ? item.serialNos?.join(", ") : "—"}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
          </CardContent>
        </Card>

        {inward.notes && (
          <Card className="border-border bg-card shadow-sm rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{inward.notes}</p>
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
            <AlertDialogTitle>Remove inward entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete inward <span className="font-medium">{inward.id}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
