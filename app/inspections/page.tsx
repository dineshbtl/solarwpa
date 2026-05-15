"use client"

import { useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CheckCircle, Search, Filter, LayoutGrid, Table2, Pencil, Loader2 } from "lucide-react"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useInspectionsPaginated, useUsers } from "@/lib/data/hooks"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { InspectionsListPageSkeleton } from "@/components/inspections-loading-skeletons"

export default function InspectionsPage() {
  const {
    data: items,
    total,
    loading,
    error,
    page,
    pageSize,
    search,
    statusFilter,
    setPage,
    setPageSize,
    setSearch,
    setStatusFilter,
  } = useInspectionsPaginated()

  const { data: users = [] } = useUsers()
  const [view, setView] = useState<"cards" | "table">("cards")

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = (value: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => setSearch(value), 300)
  }

  const getUserById = (id: string) => users.find((u) => u.id === id)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const showInitialSkeleton = loading && items.length === 0
  const showRefreshing = loading && items.length > 0

  if (showInitialSkeleton) {
    return <InspectionsListPageSkeleton />
  }

  if (error) {
    return (
      <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <p className="text-destructive">Could not load inspections. Please refresh.</p>
      </div>
    )
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Inspections</h1>
        <p className="mt-1 text-muted-foreground">Review and approve completed installations</p>
      </div>

      {/* Filters */}
      <Card className="mb-6 bg-card border-border shadow-sm rounded-xl">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by customer name, address, or ID..."
                defaultValue={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="border-border bg-background pl-9 rounded-lg"
              />
            </div>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full border-border bg-background sm:w-[200px] rounded-lg">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="reopened">Reopened</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg inline-flex items-center gap-2">
                Inspection List ({total})
                {showRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Refreshing list" />
                ) : null}
              </CardTitle>
              <p className="text-sm text-muted-foreground">Includes inspection requests created from installations</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="25">25 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                </SelectContent>
              </Select>

              <Tabs value={view} onValueChange={(v) => setView(v as "cards" | "table")}>
                <TabsList>
                  <TabsTrigger value="cards">
                    <LayoutGrid className="h-4 w-4" />
                    Cards
                  </TabsTrigger>
                  <TabsTrigger value="table">
                    <Table2 className="h-4 w-4" />
                    Table
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={view} onValueChange={(v) => setView(v as "cards" | "table")}>
            <TabsContent value="cards">
              {showInitialSkeleton ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: pageSize }).map((_, i) => (
                    <div key={i} className="h-52 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No inspections found.</p>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((inspection) => (
                    <Link key={inspection.id} href={`/inspections/${inspection.id}`}>
                      <Card className="h-full border-border bg-card shadow-sm transition-all hover:shadow-lg rounded-xl">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="rounded-lg bg-gradient-light-green p-2">
                              <CheckCircle className="h-5 w-5 text-white" />
                            </div>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                inspection.status === "approved"
                                  ? "bg-green-100 text-green-800"
                                  : inspection.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {inspection.status}
                            </span>
                          </div>
                          <CardTitle className="mt-4 text-lg text-foreground">{inspection.customerName}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Address</p>
                              <p className="text-sm text-foreground">{inspection.address.split(",").slice(0, 2).join(",")}</p>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Inspection ID</p>
                                <p className="text-sm font-semibold text-foreground">{inspection.id}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Installation</p>
                                <p className="text-sm font-semibold text-foreground">{inspection.installationId}</p>
                              </div>
                            </div>
                            <div className="space-y-2 pt-2">
                              <div className="flex items-center gap-2">
                                <CheckCircle className={`h-4 w-4 ${inspection.managerApproval.approved ? "text-green-600" : "text-muted-foreground"}`} />
                                <span className="text-xs text-muted-foreground">Manager Approval</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CheckCircle className={`h-4 w-4 ${inspection.governmentInspection?.approved ? "text-green-600" : "text-muted-foreground"}`} />
                                <span className="text-xs text-muted-foreground">Government Inspection</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="table" className="min-h-0">
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-20 bg-card shadow-[8px_0_10px_-8px_rgba(0,0,0,0.18)]">ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Installation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Gov</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Inspector</TableHead>
                      <TableHead className="sticky right-0 z-20 bg-card text-right shadow-[-8px_0_10px_-8px_rgba(0,0,0,0.18)]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {showInitialSkeleton ? (
                      Array.from({ length: pageSize }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 9 }).map((__, j) => (
                            <TableCell key={j}>
                              <div className="h-4 animate-pulse rounded bg-muted" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                          No inspections found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="sticky left-0 z-10 bg-card font-medium shadow-[8px_0_10px_-8px_rgba(0,0,0,0.12)]">
                            <Link href={`/inspections/${i.id}`} className="underline underline-offset-4">
                              {i.id}
                            </Link>
                          </TableCell>
                          <TableCell>{i.customerName}</TableCell>
                          <TableCell>{i.installationId}</TableCell>
                          <TableCell>{i.status}</TableCell>
                          <TableCell>{i.managerApproval.approved ? "Approved" : "Pending"}</TableCell>
                          <TableCell>{i.governmentInspection?.approved ? "Approved" : "Pending"}</TableCell>
                          <TableCell>{i.createdAt ? new Date(i.createdAt).toLocaleDateString() : "—"}</TableCell>
                          <TableCell>
                            {i.inspectorId ? getUserById(i.inspectorId)?.name ?? i.inspectorId : "—"}
                          </TableCell>
                          <TableCell className="sticky right-0 z-10 bg-card text-right shadow-[-8px_0_10px_-8px_rgba(0,0,0,0.12)]">
                            <Link href={`/inspections/${i.id}/edit`} className="inline-flex min-h-9 items-center text-sm underline underline-offset-4">
                              <Pencil className="mr-1 h-4 w-4" />
                              Edit
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
            </TabsContent>
          </Tabs>

          {/* Pagination */}
          {total > 0 && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span>–
                <span className="font-medium">{Math.min(page * pageSize, total)}</span> of{" "}
                <span className="font-medium">{total}</span>
              </p>

              <Pagination className="justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => { e.preventDefault(); setPage(Math.max(1, page - 1)) }}
                      aria-disabled={page === 1}
                      className={page === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>

                  {Array.from({ length: Math.min(totalPages, 7) }).map((_, idx) => {
                    const pageNum = idx + 1
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          href="#"
                          isActive={pageNum === page}
                          onClick={(e) => { e.preventDefault(); setPage(pageNum) }}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  })}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => { e.preventDefault(); setPage(Math.min(totalPages, page + 1)) }}
                      aria-disabled={page === totalPages}
                      className={page === totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
