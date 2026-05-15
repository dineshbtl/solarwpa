"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { getHouseDeliveryById } from "@/lib/supabase/warehouse"
import { listEntityActivity, type ActivityLogEntry } from "@/lib/supabase/activity-log"
import type { HouseMaterialDelivery } from "@/lib/store/warehouse"

export default function AllocationDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const [row, setRow] = useState<HouseMaterialDelivery | null>(null)
  const [loading, setLoading] = useState(true)
  const [activity, setActivity] = useState<ActivityLogEntry[]>([])

  useEffect(() => {
    if (!id) return
    getHouseDeliveryById(id)
      .then((res) => {
        if (!res) {
          toast({ title: "Allocation not found", variant: "destructive" })
          return
        }
        setRow(res)
      })
      .catch((err) =>
        toast({
          title: "Could not load allocation",
          description: err instanceof Error ? err.message : "Please refresh.",
          variant: "destructive",
        })
      )
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    void listEntityActivity("warehouse_allocation", id)
      .then(setActivity)
      .catch(() => setActivity([]))
  }, [id])

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading allocation...</div>
  if (!row) return <div className="p-6 text-sm text-muted-foreground">Allocation not found.</div>

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href="/warehouse/reallocation/allocations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Allocation List
            </Button>
          </Link>
          <h1 className="text-xl font-bold sm:text-2xl">Allocation Details</h1>
        </div>
        <Link href={`/warehouse/reallocation/allocations/${row.id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit
          </Button>
        </Link>
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>{row.id}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <p><span className="text-muted-foreground">Batch:</span> {row.allocationBatchId ?? "-"}</p>
          <p><span className="text-muted-foreground">Status:</span> <span className="capitalize">{row.status}</span></p>
          <p><span className="text-muted-foreground">Household:</span> {row.toHouseholdId}</p>
          <p><span className="text-muted-foreground">Material:</span> {row.materialName}</p>
          <p><span className="text-muted-foreground">Qty:</span> {row.qty} {row.unit ?? "Nos"}</p>
          <p><span className="text-muted-foreground">Dispatch:</span> {row.dispatchId ?? "Not selected"}</p>
          <p className="md:col-span-2"><span className="text-muted-foreground">Serials:</span> {row.serialNos.join(", ") || "-"}</p>
          <p className="md:col-span-2"><span className="text-muted-foreground">Notes:</span> {row.notes ?? "-"}</p>
          <p><span className="text-muted-foreground">Created:</span> {new Date(row.createdAt).toLocaleString("en-IN")}</p>
          <p><span className="text-muted-foreground">Updated:</span> {row.updatedAt ? new Date(row.updatedAt).toLocaleString("en-IN") : "-"}</p>

          <div className="md:col-span-2 flex flex-wrap gap-2 pt-1">
            {row.dispatchId ? (
              <Link href={`/warehouse/dispatch/${row.dispatchId}`}>
                <Button variant="outline" size="sm">View DC</Button>
              </Link>
            ) : null}
            {row.proofPhotoUrl ? (
              <a href={row.proofPhotoUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm">
                  View Proof Photo
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </a>
            ) : (
              <span className="text-muted-foreground">No proof photo uploaded</span>
            )}
          </div>
          <p className="md:col-span-2">
            <span className="text-muted-foreground">GPS:</span>{" "}
            {row.proofPhotoGps ? `${row.proofPhotoGps.latitude}, ${row.proofPhotoGps.longitude}` : "-"}
          </p>
          {row.proofPhotoUrl ? (
            <div className="md:col-span-2">
              <p className="mb-2 text-muted-foreground">Proof Photo:</p>
              <a href={row.proofPhotoUrl} target="_blank" rel="noreferrer">
                <img
                  src={row.proofPhotoUrl}
                  alt="Allocation proof"
                  className="max-h-72 w-full max-w-xl rounded-md border object-cover"
                />
              </a>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {activity.length > 0 && (
        <Card className="mt-6 rounded-xl">
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
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
  )
}
