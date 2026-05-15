"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Pencil, Printer, Trash2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { deleteDispatch, getDispatchById } from "@/lib/supabase/warehouse"
import { listEntityActivity, type ActivityLogEntry } from "@/lib/supabase/activity-log"
import type { MaterialDispatch, WarehouseItem } from "@/lib/store/warehouse"
import { toast } from "@/hooks/use-toast"

export default function DispatchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [dispatch, setDispatch] = useState<MaterialDispatch | null>(null)
  const [loading, setLoading] = useState(true)
  const [activity, setActivity] = useState<ActivityLogEntry[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    getDispatchById(id)
      .then((d) => setDispatch(d ?? null))
      .catch((err) => {
        toast({
          title: "Could not load dispatch",
          description: err instanceof Error ? err.message : "Please refresh.",
          variant: "destructive",
        })
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    void listEntityActivity("warehouse_dispatch", id)
      .then(setActivity)
      .catch(() => setActivity([]))
  }, [id])

  if (loading) {
    return (
      <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (!dispatch) {
    return (
      <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <p className="text-destructive">Dispatch not found.</p>
        <Link href="/warehouse/dispatch" className="mt-4 inline-block underline text-sm">
          ← Back to Dispatch
        </Link>
      </div>
    )
  }

  const formattedDate = dispatch.dispatchDate
    ? new Date(dispatch.dispatchDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—"

  const onDeleteConfirm = async () => {
    setIsDeleting(true)
    try {
      await deleteDispatch(dispatch.id)
      toast({ title: "Dispatch removed", description: `${dispatch.dcNumber} deleted.` })
      setDeleteOpen(false)
      router.push("/warehouse/dispatch")
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
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-12">
      {/* Action bar — hidden on print */}
      <div className="print:hidden mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <Link href="/warehouse/dispatch">
          <Button variant="ghost" className="text-foreground hover:bg-accent">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dispatch
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/warehouse/dispatch/${dispatch.id}/edit`}>
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </Button>
          <Button onClick={() => window.print()} className="bg-green-600 text-white hover:bg-green-700">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* ── Printable DC ─────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-3xl rounded-xl border border-gray-300 bg-white p-8 shadow-sm print:shadow-none print:border-gray-400">

        {/* Company header */}
        <div className="mb-6 border-b-2 border-gray-800 pb-4 text-center">
          <h1 className="text-2xl font-extrabold uppercase tracking-wide text-gray-900">
            SKY VOLT Renewables Pvt. Ltd
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Solar EPC — PM SURYA GHAR Scheme | District: Kurnool, Andhra Pradesh
          </p>
          <div className="mt-3 inline-block rounded border border-gray-800 px-6 py-1.5">
            <p className="text-base font-bold uppercase tracking-widest text-gray-900">Delivery Challan</p>
          </div>
        </div>

        {/* DC Number + Date */}
        <div className="mb-6 grid grid-cols-2 gap-6">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">DC Number</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{dispatch.dcNumber}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dispatch Date</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{formattedDate}</p>
          </div>
        </div>

        {/* Vehicle Details */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Vehicle Details</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="flex gap-2">
              <span className="w-28 shrink-0 font-medium text-gray-600">Vehicle No:</span>
              <span className="text-gray-900">{dispatch.vehicleNo || "—"}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-28 shrink-0 font-medium text-gray-600">Driver:</span>
              <span className="text-gray-900">{dispatch.driverName || "—"}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-28 shrink-0 font-medium text-gray-600">Driver Mobile:</span>
              <span className="text-gray-900">{dispatch.driverMobile || "—"}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-28 shrink-0 font-medium text-gray-600">Type:</span>
              <span className="text-gray-900">{dispatch.vehicleType || "—"}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-28 shrink-0 font-medium text-gray-600">Status:</span>
              <span className="capitalize text-gray-900">{dispatch.status}</span>
            </div>
            <div className="flex gap-2 col-span-2">
              <span className="w-28 shrink-0 font-medium text-gray-600">From:</span>
              <span className="text-gray-900">{dispatch.fromLocation || "—"}</span>
            </div>
            <div className="flex gap-2 col-span-2">
              <span className="w-28 shrink-0 font-medium text-gray-600">To:</span>
              <span className="text-gray-900">{dispatch.toLocation || "—"}</span>
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Materials</p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border border-gray-300 bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 w-10">#</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Material</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 w-16">Qty</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 w-16">Unit</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Serial Nos / Notes</th>
              </tr>
            </thead>
            <tbody>
              {dispatch.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-gray-300 px-3 py-4 text-center text-gray-500">
                    No items recorded.
                  </td>
                </tr>
              ) : (
                dispatch.items.map((item: WarehouseItem, idx: number) => (
                  <tr key={idx} className="even:bg-gray-50">
                    <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">{idx + 1}</td>
                    <td className="border border-gray-300 px-3 py-2 text-gray-900">{item.name}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center tabular-nums text-gray-900">{item.qty}</td>
                    <td className="border border-gray-300 px-3 py-2 text-center text-gray-700">{item.unit ?? "Nos"}</td>
                    <td className="border border-gray-300 px-3 py-2 text-gray-700">
                      {[(item.serialNos ?? []).join(", "), item.notes].filter(Boolean).join(" | ") || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {dispatch.notes && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</p>
            <p className="mt-1 text-sm text-gray-800">{dispatch.notes}</p>
          </div>
        )}

        {/* Signature lines */}
        <div className="mt-10 grid grid-cols-2 gap-12">
          <div>
            <div className="border-b border-gray-800 pb-1" />
            <p className="mt-2 text-sm font-semibold text-gray-700">Dispatched By</p>
            <p className="text-xs text-gray-400">Name &amp; Signature</p>
          </div>
          <div>
            <div className="border-b border-gray-800 pb-1" />
            <p className="mt-2 text-sm font-semibold text-gray-700">Received By</p>
            <p className="text-xs text-gray-400">Name &amp; Signature</p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          Generated by SKY VOLT Solar EPC System &nbsp;|&nbsp; {new Date().toLocaleString("en-IN")}
        </p>
      </div>

      {activity.length > 0 && (
        <Card className="mx-auto mt-6 max-w-3xl border-border bg-card shadow-sm rounded-xl print:hidden">
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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this dispatch challan?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes {dispatch.dcNumber}. Stock views will treat these quantities as never dispatched. You cannot
              remove it if a material receipt or household delivery still references this DC.
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
