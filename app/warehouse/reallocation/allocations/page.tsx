"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Download, ExternalLink, Eye, Pencil, Plus, Repeat2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { listHouseDeliveries, listMaterialDefinitions, type MaterialDefinition } from "@/lib/supabase/warehouse"
import type { HouseMaterialDelivery } from "@/lib/store/warehouse"
import { WarehouseModuleHeader } from "@/components/warehouse/warehouse-module-header"

function toCsv(rows: HouseMaterialDelivery[]): string {
  const header = [
    "ID",
    "BatchID",
    "Household",
    "Material",
    "Qty",
    "Unit",
    "SerialCount",
    "Status",
    "ProofPhotoUrl",
    "ProofGps",
    "Notes",
    "CreatedAt",
  ]
  const lines = rows.map((r) =>
    [
      r.id,
      r.allocationBatchId ?? "",
      r.toHouseholdId,
      r.materialName,
      String(r.qty),
      r.unit ?? "",
      String(r.serialNos.length),
      r.status,
      r.proofPhotoUrl ?? "",
      r.proofPhotoGps ? `${r.proofPhotoGps.latitude},${r.proofPhotoGps.longitude}` : "",
      r.notes ?? "",
      r.createdAt,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  )
  return [header.join(","), ...lines].join("\n")
}

export default function ReallocationAllocationsPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<HouseMaterialDelivery[]>([])
  const [materials, setMaterials] = useState<MaterialDefinition[]>([])
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [material, setMaterial] = useState("all")
  const [groupByBatch, setGroupByBatch] = useState(false)

  useEffect(() => {
    Promise.all([listHouseDeliveries(), listMaterialDefinitions()])
      .then(([d, m]) => {
        setRows(d)
        setMaterials(m)
      })
      .catch((err) =>
        toast({
          title: "Could not load allocations",
          description: err instanceof Error ? err.message : "Please refresh.",
          variant: "destructive",
        })
      )
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      const matchQ =
        q.length === 0 ||
        r.id.toLowerCase().includes(q) ||
        r.toHouseholdId.toLowerCase().includes(q) ||
        r.materialName.toLowerCase().includes(q)
      const matchStatus = status === "all" || r.status === status
      const matchMaterial = material === "all" || r.materialName === material
      return matchQ && matchStatus && matchMaterial
    })
  }, [rows, query, status, material])

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        batchId: string
        householdId: string
        rows: HouseMaterialDelivery[]
        totalQty: number
        totalSerials: number
        createdAt: string
      }
    >()
    for (const row of filtered) {
      const key = row.allocationBatchId?.trim() ? row.allocationBatchId : `single:${row.id}`
      if (!map.has(key)) {
        map.set(key, {
          batchId: row.allocationBatchId?.trim() || row.id,
          householdId: row.toHouseholdId,
          rows: [],
          totalQty: 0,
          totalSerials: 0,
          createdAt: row.createdAt,
        })
      }
      const g = map.get(key)!
      g.rows.push(row)
      g.totalQty += Number(row.qty ?? 0)
      g.totalSerials += row.serialNos.length
      if (new Date(row.createdAt).getTime() > new Date(g.createdAt).getTime()) g.createdAt = row.createdAt
    }
    return [...map.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [filtered])

  const onExport = () => {
    const csv = toCsv(filtered)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `house-allocations-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10">
      <WarehouseModuleHeader
        title="Allocation list"
        description="Search, filter, and export household allocations"
        icon={Repeat2}
        actions={
          <>
            <Button variant="outline" className="rounded-xl" onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Link href="/warehouse/reallocation?tab=allocate">
              <Button className="rounded-xl bg-gradient-primary-button text-white hover:opacity-90">
                <Plus className="mr-2 h-4 w-4" />
                Allocate
              </Button>
            </Link>
          </>
        }
      />

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>Search</Label>
            <Input className="mt-2" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by ID, household, material" />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="allocated">Allocated</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="reassigned">Reassigned</SelectItem>
                <SelectItem value="installed">Installed</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Material</Label>
            <Select value={material} onValueChange={setMaterial}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="mt-2 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Switch checked={groupByBatch} onCheckedChange={setGroupByBatch} />
              Group by Batch
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 rounded-xl">
        <CardHeader>
          <CardTitle>Allocations ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:hidden">
            {loading ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">No allocations found.</div>
            ) : groupByBatch ? (
              grouped.map((g) => (
                <div key={g.batchId} className="rounded-lg border p-3">
                  <p className="font-medium">Batch: {g.batchId}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.householdId} · {g.rows.length} item(s) · Qty {g.totalQty} · Serials {g.totalSerials}
                  </p>
                  <div className="mt-2 space-y-2">
                    {g.rows.map((r) => (
                      <div key={r.id} className="rounded border p-2 text-sm">
                        <p className="font-medium">{r.materialName}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.qty} {r.unit ?? "Nos"} · {r.status}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              filtered.map((r) => (
                <div key={r.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{r.id}</p>
                      <p className="text-xs text-muted-foreground">{r.allocationBatchId ?? "No batch"}</p>
                    </div>
                    <Link href={`/warehouse/reallocation/allocations/${r.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </Link>
                    <Link href={`/warehouse/reallocation/allocations/${r.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        View
                      </Button>
                    </Link>
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Household:</span> {r.toHouseholdId}</p>
                    <p><span className="text-muted-foreground">Material:</span> {r.materialName}</p>
                    <p><span className="text-muted-foreground">Qty:</span> {r.qty} {r.unit ?? "Nos"}</p>
                    <p><span className="text-muted-foreground">Status:</span> <span className="capitalize">{r.status}</span></p>
                    {r.proofPhotoUrl ? (
                      <a className="inline-flex items-center text-primary underline" href={r.proofPhotoUrl} target="_blank" rel="noreferrer">
                        Proof Photo <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="hidden w-full md:block">
            <Table className="min-w-[1400px]">
              <TableHeader>
                {groupByBatch ? (
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Household</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total Qty</TableHead>
                    <TableHead className="text-right">Total Serials</TableHead>
                    <TableHead>Materials</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Household</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Serials</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Proof</TableHead>
                    <TableHead>GPS</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                )}
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={12} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="py-8 text-center text-muted-foreground">No allocations found.</TableCell></TableRow>
                ) : groupByBatch ? (
                  grouped.map((g) => (
                    <TableRow key={g.batchId}>
                      <TableCell className="font-medium">{g.batchId}</TableCell>
                      <TableCell>{g.householdId}</TableCell>
                      <TableCell className="text-right">{g.rows.length}</TableCell>
                      <TableCell className="text-right">{g.totalQty}</TableCell>
                      <TableCell className="text-right">{g.totalSerials}</TableCell>
                      <TableCell className="max-w-[260px] truncate">
                        {g.rows.map((r) => r.materialName).join(", ")}
                      </TableCell>
                      <TableCell>{new Date(g.createdAt).toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.id}</TableCell>
                      <TableCell>{r.allocationBatchId ?? "-"}</TableCell>
                      <TableCell>{r.toHouseholdId}</TableCell>
                      <TableCell>{r.materialName}</TableCell>
                      <TableCell className="text-right">{r.qty}</TableCell>
                      <TableCell className="text-right">{r.serialNos.length}</TableCell>
                      <TableCell className="capitalize">{r.status}</TableCell>
                      <TableCell>
                        {r.proofPhotoUrl ? (
                          <a className="inline-flex items-center text-primary underline" href={r.proofPhotoUrl} target="_blank" rel="noreferrer">
                            Open <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {r.proofPhotoGps ? `${r.proofPhotoGps.latitude}, ${r.proofPhotoGps.longitude}` : "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.notes ?? "-"}</TableCell>
                      <TableCell>{new Date(r.createdAt).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/warehouse/reallocation/allocations/${r.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="mr-1 h-3.5 w-3.5" />
                              View
                            </Button>
                          </Link>
                          <Link href={`/warehouse/reallocation/allocations/${r.id}/edit`}>
                            <Button variant="outline" size="sm">
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
