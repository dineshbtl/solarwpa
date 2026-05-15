"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Eye, Inbox, Package, Pencil, Plus, Trash2, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import {
  deleteInward,
  listInwards,
  listMaterialDefinitions,
  type MaterialDefinition,
} from "@/lib/supabase/warehouse"
import type { MaterialInward } from "@/lib/store/warehouse"
import { toast } from "@/hooks/use-toast"
import { WarehouseModuleHeader } from "@/components/warehouse/warehouse-module-header"

/** Parse inward date for calendar year/day (handles `YYYY-MM-DD` without UTC shift). */
function parseInwardCalendarParts(isoOrDate: string): { y: number; m: number; d: number } | null {
  const s = isoOrDate.trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) {
    return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
  }
  const t = new Date(s)
  if (Number.isNaN(t.getTime())) return null
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }
}

function calendarYmd(parts: { y: number; m: number; d: number }): string {
  return `${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`
}

export default function InwardListPage() {
  const [inwards, setInwards] = useState<MaterialInward[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<MaterialInward | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [materialFilter, setMaterialFilter] = useState("all")
  const [yearFilter, setYearFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState("")
  const [materialCatalog, setMaterialCatalog] = useState<MaterialDefinition[]>([])

  const loadInwards = () => {
    listInwards()
      .then(setInwards)
      .catch((err) => {
        toast({
          title: "Could not load inwards",
          description: err instanceof Error ? err.message : "Please refresh.",
          variant: "destructive",
        })
      })
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([listInwards(), listMaterialDefinitions()])
      .then(([inv, defs]) => {
        if (!cancelled) {
          setInwards(inv)
          setMaterialCatalog(defs)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast({
            title: "Could not load inward list",
            description: err instanceof Error ? err.message : "Please refresh.",
            variant: "destructive",
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const materialOptions = useMemo(() => {
    const names = new Set<string>()
    for (const def of materialCatalog) {
      const n = def.name?.trim()
      if (n) names.add(n)
    }
    for (const inv of inwards) {
      for (const it of inv.items) {
        const n = it.name?.trim()
        if (n) names.add(n)
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [inwards, materialCatalog])

  const yearOptions = useMemo(() => {
    const years = new Set<number>()
    for (const inv of inwards) {
      const p = parseInwardCalendarParts(inv.inwardDate)
      if (p) years.add(p.y)
    }
    return [...years].sort((a, b) => b - a)
  }, [inwards])

  const filteredInwards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const yearNum = yearFilter === "all" ? null : Number(yearFilter)

    return inwards.filter((row) => {
      const itemText = row.items.map((it) => `${it.name} ${it.qty}`).join(" ").toLowerCase()
      const matchSearch =
        q.length === 0 ||
        row.id.toLowerCase().includes(q) ||
        row.poNumber.toLowerCase().includes(q) ||
        (row.refNo ?? "").toLowerCase().includes(q) ||
        (row.supplierName ?? "").toLowerCase().includes(q) ||
        itemText.includes(q)

      const matchMaterial =
        materialFilter === "all" || row.items.some((it) => it.name === materialFilter)

      const parts = parseInwardCalendarParts(row.inwardDate)
      let matchDate = true
      if (dateFilter && parts) {
        matchDate = calendarYmd(parts) === dateFilter
      } else if (dateFilter && !parts) {
        matchDate = false
      } else if (!dateFilter && yearNum !== null && parts) {
        matchDate = parts.y === yearNum
      } else if (!dateFilter && yearNum !== null && !parts) {
        matchDate = false
      }

      return matchSearch && matchMaterial && matchDate
    })
  }, [inwards, searchQuery, materialFilter, yearFilter, dateFilter])

  const filtersActive =
    searchQuery.trim().length > 0 || materialFilter !== "all" || yearFilter !== "all" || dateFilter.length > 0

  const clearFilters = () => {
    setSearchQuery("")
    setMaterialFilter("all")
    setYearFilter("all")
    setDateFilter("")
  }

  const onDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteInward(deleteTarget.id)
      toast({ title: "Inward removed", description: `${deleteTarget.id} has been deleted.` })
      setDeleteTarget(null)
      loadInwards()
    } catch (err) {
      toast({
        title: "Could not remove inward",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10">
      <WarehouseModuleHeader
        title="GRN · Material Inward"
        description="Record PO inward into warehouse with quantity and serial numbers"
        icon={Inbox}
        actions={
          <Link href="/warehouse/inward/new">
            <Button className="rounded-xl bg-gradient-primary-button text-white hover:opacity-90">
              <Plus className="mr-2 h-4 w-4" />
              New Inward
            </Button>
          </Link>
        }
      />

      <Card className="border-border bg-card shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            Inward Entries{" "}
            {!loading &&
              (inwards.length === 0
                ? "(0)"
                : filtersActive
                  ? `(${filteredInwards.length} of ${inwards.length})`
                  : `(${inwards.length})`)}
          </CardTitle>
          <p className="text-sm text-muted-foreground">All inward stock entries captured against PO/reference</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : inwards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Package className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="text-base font-medium text-foreground mb-1">No inward entries yet</p>
              <p className="text-sm text-muted-foreground mb-6">
                Add your first inward entry from supplier/PO to start tracking received stock.
              </p>
              <Link href="/warehouse/inward/new">
                <Button className="bg-gradient-primary-button text-white hover:opacity-90 rounded-xl">
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Inward
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
                <div className="lg:col-span-4">
                  <Label htmlFor="inward-search">Search</Label>
                  <Input
                    id="inward-search"
                    className="mt-2 rounded-lg"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ID, PO, reference, supplier, items…"
                  />
                </div>
                <div className="lg:col-span-3">
                  <Label>Material</Label>
                  <Select value={materialFilter} onValueChange={setMaterialFilter}>
                    <SelectTrigger className="mt-2 rounded-lg">
                      <SelectValue placeholder="All materials" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All materials</SelectItem>
                      {materialOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="lg:col-span-2">
                  <Label>Year</Label>
                  <Select
                    value={yearFilter}
                    onValueChange={setYearFilter}
                    disabled={!!dateFilter}
                  >
                    <SelectTrigger className="mt-2 rounded-lg">
                      <SelectValue placeholder="All years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All years</SelectItem>
                      {yearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="lg:col-span-2">
                  <Label htmlFor="inward-date">Date</Label>
                  <Input
                    id="inward-date"
                    type="date"
                    className="mt-2 rounded-lg"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateFilter ? "Year filter ignored when a date is set." : "Leave empty to filter by year only."}
                  </p>
                </div>
                <div className="flex lg:col-span-1 lg:justify-end">
                  {filtersActive ? (
                    <Button type="button" variant="outline" size="sm" className="mt-2 rounded-lg" onClick={clearFilters}>
                      <X className="mr-1.5 h-4 w-4" />
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>

              {filteredInwards.length === 0 ? (
                <div className="rounded-lg border border-dashed p-10 text-center">
                  <p className="text-sm font-medium text-foreground">No entries match your filters</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try changing search, material, year, or date.</p>
                  <Button type="button" variant="outline" className="mt-4 rounded-lg" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </div>
              ) : (
              <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-20 bg-card shadow-[8px_0_10px_-8px_rgba(0,0,0,0.18)]">Inward ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Items (Name x Qty)</TableHead>
                    <TableHead className="sticky right-0 z-20 bg-card text-right shadow-[-8px_0_10px_-8px_rgba(0,0,0,0.18)]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInwards.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="sticky left-0 z-10 bg-card font-medium shadow-[8px_0_10px_-8px_rgba(0,0,0,0.12)]">
                        <Link href={`/warehouse/inward/${row.id}`} className="underline-offset-2 hover:underline">
                          {row.id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {new Date(row.inwardDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>{row.poNumber}</TableCell>
                      <TableCell>{row.refNo || "—"}</TableCell>
                      <TableCell>{row.supplierName || "—"}</TableCell>
                      <TableCell className="max-w-[360px]">
                        {row.items.length === 0 ? (
                          "—"
                        ) : (
                          <p className="truncate text-sm text-muted-foreground">
                            {row.items.map((item) => `${item.name} x ${item.qty}`).join(", ")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="sticky right-0 z-10 bg-card text-right shadow-[-8px_0_10px_-8px_rgba(0,0,0,0.12)]">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/warehouse/inward/${row.id}`}>
                            <Button variant="ghost" size="sm" className="min-h-9">
                              <Eye className="mr-1.5 h-4 w-4" />
                              View
                            </Button>
                          </Link>
                          <Link href={`/warehouse/inward/${row.id}/edit`}>
                            <Button variant="ghost" size="sm" className="min-h-9">
                              <Pencil className="mr-1.5 h-4 w-4" />
                              Edit
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(row)}
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
              </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove inward entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  This will permanently delete inward <span className="font-medium">{deleteTarget.id}</span>. This action
                  cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void onDeleteConfirm()
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
