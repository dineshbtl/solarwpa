"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus, Filter, LayoutGrid, Table2, Pencil, Loader2, Trash2 } from "lucide-react"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSurveysPaginated, useUsers } from "@/lib/data/hooks"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
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
import * as surveysData from "@/lib/data/surveys"
import { Skeleton } from "@/components/ui/skeleton"
import { siteLocationOptions } from "@/lib/data/site-location-options"
import { ACTIVE_PROJECT_ID } from "@/lib/data/active-project"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"

const SEARCH_DEBOUNCE_MS = 300

export default function SurveysPage() {
  const {
    data: surveys,
    total,
    loading: surveysLoading,
    error: surveysError,
    page,
    pageSize,
    setPage,
    setSearch: setSearchApi,
    refetch,
    sectionFilter,
    subDivisionFilter,
    statusFilter,
    feasibilityFilter,
    setSectionFilter,
    setSubDivisionFilter,
    setStatusFilter,
    setFeasibilityFilter,
  } = useSurveysPaginated({ pageSize: 20 })
  const { data: users = [] } = useUsers()
  const [searchQuery, setSearchQuery] = useState("")
  const [view, setView] = useState<"table" | "cards">("table")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const getUserById = (id: string) => users.find((u) => u.id === id)

  // Debounced search: sync searchQuery to API after typing stops
  useEffect(() => {
    const t = setTimeout(() => setSearchApi(searchQuery), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [searchQuery, setSearchApi])

  const allSurveys = useMemo(() => {
    return surveys
      .filter((s) => s.projectId === ACTIVE_PROJECT_ID)
      .map((s) => ({
        id: s.id,
        sno: s.id,
        circle: s.siteLocation?.circle ?? "",
        division: s.siteLocation?.division ?? "",
        subDivision: s.siteLocation?.subDivision ?? "",
        section: s.siteLocation?.section ?? "",
        serviceNumber: s.serviceNo,
        consumerName: s.beneficiaryName,
        contractedLoad: s.contractedLoad ?? "",
        uploadDate: s.uploadDate,
        updatedAt: (s as { updatedAt?: string }).updatedAt,
        approvedDate: s.approvedDate ?? "",
        aadhaar: s.aadharNo,
        mobile: s.mobile ?? "",
        status: s.status,
        installerId: s.installerId ?? "",
        submittedById: s.submittedById ?? "",
        feasibility: s.siteDetails?.overallFeasibility ?? "",
      }))
  }, [surveys])

  const storedInView = allSurveys
  const allStoredSelected =
    storedInView.length > 0 && storedInView.every((s) => selectedIds.has(s.id))
  const someSelected = selectedIds.size > 0

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allStoredSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(storedInView.map((s) => s.id)))
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    setDeleteDialogOpen(false)
    setDeleting(true)
    try {
      let done = 0
      for (const id of selectedIds) {
        await surveysData.deleteSurvey(id)
        done++
      }
      setSelectedIds(new Set())
      refetch()
      toast({ title: "Surveys deleted", description: `${done} survey(s) removed.` })
    } catch (e) {
      toast({
        title: "Could not delete",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const showInitialSkeleton = surveysLoading && surveys.length === 0
  const showRefreshing = surveysLoading && surveys.length > 0

  return (
    <div className="min-h-screen p-6 sm:p-8">
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size} survey(s) will be permanently removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteSelected}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Site Surveys</h1>
          <p className="mt-1 text-muted-foreground">Manage and review site feasibility surveys</p>
        </div>
        <Link href="/surveys/new">
          <Button className="bg-gradient-primary-button text-white hover:opacity-90 rounded-xl">
            <Plus className="mr-2 h-4 w-4" />
            New Survey
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-6 bg-card border-border shadow-sm rounded-xl">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, service number, Aadhaar, PAN, section, mobile..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-border bg-background pl-9 rounded-lg"
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-full border-border bg-background sm:w-[160px] rounded-lg">
                    <Filter className="mr-2 h-4 w-4 shrink-0" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={feasibilityFilter || "all"} onValueChange={(v) => setFeasibilityFilter(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-full border-border bg-background sm:w-[180px] rounded-lg">
                    <SelectValue placeholder="Feasibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Feasibility</SelectItem>
                    <SelectItem value="Feasible">Feasible</SelectItem>
                    <SelectItem value="Not Feasible">Not Feasible</SelectItem>
                    <SelectItem value="pending">Pending Assessment</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sectionFilter || "all"} onValueChange={(v) => setSectionFilter(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-full border-border bg-background sm:w-[160px] rounded-lg">
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {siteLocationOptions.sections.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={subDivisionFilter || "all"} onValueChange={(v) => setSubDivisionFilter(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-full border-border bg-background sm:w-[180px] rounded-lg">
                    <SelectValue placeholder="Sub Division" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sub Divisions</SelectItem>
                    {siteLocationOptions.subDivisions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg inline-flex items-center gap-2">
                Survey List ({total})
                {showRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Refreshing list" />
                ) : null}
              </CardTitle>
              <p className="text-sm text-muted-foreground">Use pagination to browse survey records</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
              {someSelected && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="rounded-lg"
                  disabled={deleting}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  {deleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete ({selectedIds.size})
                </Button>
              )}
              <Tabs value={view} onValueChange={(v) => setView(v as "table" | "cards")}>
                <TabsList>
                  <TabsTrigger value="table">
                    <Table2 className="h-4 w-4" />
                    Table
                  </TabsTrigger>
                  <TabsTrigger value="cards">
                    <LayoutGrid className="h-4 w-4" />
                    Cards
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {surveysError ? (
            <div className="pb-4 text-sm text-destructive">Could not load surveys. Please refresh.</div>
          ) : null}
          {showInitialSkeleton ? (
            <div className="min-h-[320px] space-y-1.5" aria-busy="true" aria-label="Loading surveys">
              <div className="flex gap-1 border-b pb-1.5">
                {Array.from({ length: 13 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 flex-1 min-w-[30px]" />
                ))}
              </div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-1">
                  {Array.from({ length: 13 }).map((_, j) => (
                    <Skeleton key={j} className="h-5 flex-1 min-w-[30px]" />
                  ))}
                </div>
              ))}
            </div>
          ) : (
          <Tabs value={view} onValueChange={(v) => setView(v as "table" | "cards")} className={showRefreshing ? "opacity-90" : undefined}>
            <TabsContent value="table">
              <div className="w-full overflow-x-auto">
              <Table className="min-w-[1600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-20 w-24 bg-card shadow-[8px_0_10px_-8px_rgba(0,0,0,0.18)]">
                      <div className="flex items-center gap-2">
                        {storedInView.length > 0 && (
                          <Checkbox
                            checked={allStoredSelected}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all"
                          />
                        )}
                        <span>No.</span>
                      </div>
                    </TableHead>
                    <TableHead>Service Number</TableHead>
                    <TableHead>Consumer Name</TableHead>
                    <TableHead>Circle</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>Sub Division</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Updated on</TableHead>
                    <TableHead>Aadhaar</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Feasibility</TableHead>
                    <TableHead className="sticky right-0 z-20 bg-card text-right shadow-[-8px_0_10px_-8px_rgba(0,0,0,0.18)]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSurveys.map((s: any, idx: number) => (
                    <TableRow key={s.id}>
                      <TableCell className="sticky left-0 z-10 w-24 bg-card shadow-[8px_0_10px_-8px_rgba(0,0,0,0.12)]">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedIds.has(s.id)}
                            onCheckedChange={() => toggleSelect(s.id)}
                            aria-label={`Select ${s.serviceNumber || s.id}`}
                          />
                          <span>{(page - 1) * pageSize + idx + 1}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/surveys/${s.id}`} className="underline underline-offset-4">
                          {s.serviceNumber || s.id}
                        </Link>
                      </TableCell>
                      <TableCell className="min-w-[220px] capitalize">
                        <Link href={`/surveys/${s.id}`} className="hover:underline underline-offset-4">
                          {s.consumerName || "-"}
                        </Link>
                      </TableCell>
                      <TableCell className="capitalize">{s.circle || "-"}</TableCell>
                      <TableCell className="capitalize">{s.division || "-"}</TableCell>
                      <TableCell className="capitalize">{s.subDivision || "-"}</TableCell>
                      <TableCell className="capitalize">{s.section || "-"}</TableCell>
                      <TableCell>
                        {(s.updatedAt ?? s.uploadDate)
                          ? new Date(s.updatedAt ?? s.uploadDate).toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" })
                          : "-"}
                      </TableCell>
                      <TableCell>{s.aadhaar || "-"}</TableCell>
                      <TableCell>{s.mobile || "-"}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            s.status === "approved"
                              ? "bg-green-100 text-green-800"
                              : s.status === "rejected"
                                ? "bg-red-100 text-red-800"
                            : s.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {s.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            s.feasibility === "Feasible"
                              ? "bg-green-100 text-green-800"
                              : s.feasibility === "Not Feasible"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {s.feasibility || "Pending"}
                        </span>
                      </TableCell>
                      <TableCell className="sticky right-0 z-10 bg-card text-right shadow-[-8px_0_10px_-8px_rgba(0,0,0,0.12)]">
                        <Link href={`/surveys/${s.id}/edit`} className="inline-flex min-h-9 items-center text-sm underline underline-offset-4">
                          <Pencil className="mr-1 h-4 w-4" />
                          Edit
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {allSurveys.length === 0 && !surveysLoading && (
                    <TableRow>
                      <TableCell colSpan={13} className="py-10 text-center text-sm text-muted-foreground">
                        No surveys found. Try a different search or status filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </TabsContent>

            <TabsContent value="cards">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {allSurveys.map((s: any, idx: number) => (
                  <Link key={s.id} href={`/surveys/${s.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Card className="border-border bg-card shadow-sm rounded-xl transition-colors hover:bg-muted/50 cursor-pointer">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">SNO: {(page - 1) * pageSize + idx + 1}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Service No: <span className="font-medium text-foreground">{s.serviceNumber || "-"}</span>
                            </p>
                            <CardTitle className="mt-1 text-base truncate capitalize">{s.consumerName || "-"}</CardTitle>
                          </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            s.status === "approved"
                              ? "bg-green-100 text-green-800"
                              : s.status === "rejected"
                                ? "bg-red-100 text-red-800"
                          : s.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Service No</span>
                        <span className="font-medium">{s.serviceNumber || "-"}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Mobile</span>
                        <span className="font-medium">{s.mobile || "-"}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Aadhaar</span>
                        <span className="font-medium">{s.aadhaar || "-"}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Feasibility</span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.feasibility === "Feasible"
                              ? "bg-green-100 text-green-800"
                              : s.feasibility === "Not Feasible"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {s.feasibility || "Pending"}
                        </span>
                      </div>
                      <div className="pt-2 text-xs text-muted-foreground">
                        <div className="flex flex-wrap gap-x-3 gap-y-1 capitalize">
                          <span>Circle: {s.circle || "-"}</span>
                          <span>Div: {s.division || "-"}</span>
                          <span>Sub: {s.subDivision || "-"}</span>
                          <span>Sec: {s.section || "-"}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          <span>Updated on: {(s.updatedAt ?? s.uploadDate) ? new Date(s.updatedAt ?? s.uploadDate).toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }) : "-"}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  </Link>
                ))}
                {allSurveys.length === 0 && !surveysLoading && (
                  <Card className="border-border bg-card shadow-sm rounded-xl sm:col-span-2 lg:col-span-3">
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                      No surveys found. Try a different search or status filter.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
          )}

          {/* Pagination / count */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium">{total === 0 ? 0 : (page - 1) * pageSize + 1}</span>–
              <span className="font-medium">{Math.min(page * pageSize, total)}</span> of{" "}
              <span className="font-medium">{total}</span>
            </p>
            {total > 0 && (
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
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table already shows empty state */}
    </div>
  )
}
