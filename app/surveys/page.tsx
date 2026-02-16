"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus, Filter, LayoutGrid, Table2, Pencil, Loader2, Trash2 } from "lucide-react"
import { mockSurveys } from "@/lib/mock-data"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSurveysLazy, useUsers } from "@/lib/data/hooks"
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
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { siteLocationOptions } from "@/lib/data/site-location-options"

const SEARCH_DEBOUNCE_MS = 300

export default function SurveysPage() {
  const {
    data: lazySurveys,
    total,
    loading: surveysLoading,
    loadingMore,
    hasMore,
    loadMore,
    setSearch: setSearchApi,
    refetch,
    sectionFilter,
    subDivisionFilter,
    setSectionFilter,
    setSubDivisionFilter,
  } = useSurveysLazy({ pageSize: 20 })
  const { data: users = [] } = useUsers()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [view, setView] = useState<"table" | "cards">("table")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const getUserById = (id: string) => users.find((u) => u.id === id)

  // Debounced search: sync searchQuery to API after typing stops
  useEffect(() => {
    const t = setTimeout(() => setSearchApi(searchQuery), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [searchQuery, setSearchApi])

  const allSurveys = useMemo(() => {
    const stored = lazySurveys.map((s) => ({
      kind: "stored" as const,
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
      approvedDate: s.approvedDate ?? "",
      aadhaar: s.aadharNo,
      mobile: s.mobile ?? "",
      status: s.status,
      installerId: s.installerId ?? "",
      submittedById: s.submittedById ?? "",
    }))
    if (isSupabaseConfigured()) return stored
    const legacy = mockSurveys.map((s) => ({
      kind: "legacy" as const,
      id: s.id,
      sno: s.id,
      circle: "",
      division: "",
      subDivision: "",
      section: "",
      serviceNumber: "",
      consumerName: s.customerName,
      contractedLoad: "",
      uploadDate: s.createdAt ?? "",
      approvedDate: s.approvedAt ?? "",
      aadhaar: "",
      mobile: "",
      status: s.status,
    }))
    return [...stored, ...legacy]
  }, [lazySurveys])

  const filteredSurveys = useMemo(
    () =>
      statusFilter === "all"
        ? allSurveys
        : allSurveys.filter((s: { status: string }) => s.status === statusFilter),
    [allSurveys, statusFilter]
  )

  const storedInView = useMemo(
    () => filteredSurveys.filter((s: { kind: string }) => s.kind === "stored"),
    [filteredSurveys]
  )
  const allStoredSelected =
    storedInView.length > 0 && storedInView.every((s: { id: string }) => selectedIds.has(s.id))
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
    else setSelectedIds(new Set(storedInView.map((s: { id: string }) => s.id)))
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

  // Infinite scroll: load more when sentinel is visible
  useEffect(() => {
    if (!hasMore || loadingMore || surveysLoading) return
    const el = loadMoreRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: "200px", threshold: 0 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, loadingMore, surveysLoading, loadMore])

  return (
    <div className="min-h-screen bg-background p-6 sm:p-8">
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
      <Card className="mb-6 bg-white border-gray-200 shadow-sm rounded-xl">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, service number, Aadhaar, PAN, section, mobile..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-gray-200 bg-background pl-9 rounded-lg"
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full border-gray-200 bg-background sm:w-[160px] rounded-lg">
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
                <Select value={sectionFilter || "all"} onValueChange={(v) => setSectionFilter(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-full border-gray-200 bg-background sm:w-[160px] rounded-lg">
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
                  <SelectTrigger className="w-full border-gray-200 bg-background sm:w-[180px] rounded-lg">
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

      <Card className="border-gray-200 bg-white shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Survey List ({filteredSurveys.length}{total > 0 ? ` of ${total}` : ""})</CardTitle>
              <p className="text-sm text-muted-foreground">First 20 load quickly; search or scroll to load more</p>
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
          {surveysLoading ? (
            <div className="space-y-1.5">
              <div className="flex gap-1 border-b pb-1.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 flex-1 min-w-[30px]" />
                ))}
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-1">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <Skeleton key={j} className="h-5 flex-1 min-w-[30px]" />
                  ))}
                </div>
              ))}
            </div>
          ) : (
          <Tabs value={view} onValueChange={(v) => setView(v as "table" | "cards")}>
            <TabsContent value="table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">
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
                    <TableHead>CIRCLE</TableHead>
                    <TableHead>DIVISION</TableHead>
                    <TableHead>SUB DIVISION</TableHead>
                    <TableHead>SECTION</TableHead>
                    <TableHead>Contracted Load</TableHead>
                    <TableHead>Upload Date</TableHead>
                    <TableHead>Approved Date</TableHead>
                    <TableHead>AADHAAR</TableHead>
                    <TableHead>MOBILE</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Installer</TableHead>
                    <TableHead>Surveyor</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSurveys.map((s: any, idx: number) => (
                    <TableRow key={`${s.kind}-${s.id}`}>
                      <TableCell className="w-24">
                        <div className="flex items-center gap-2">
                          {s.kind === "stored" && (
                            <Checkbox
                              checked={selectedIds.has(s.id)}
                              onCheckedChange={() => toggleSelect(s.id)}
                              aria-label={`Select ${s.serviceNumber || s.id}`}
                            />
                          )}
                          <span>{idx + 1}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/surveys/${s.id}`} className="underline underline-offset-4">
                          {s.serviceNumber || s.id}
                        </Link>
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        <Link href={`/surveys/${s.id}`} className="hover:underline underline-offset-4">
                          {s.consumerName || "-"}
                        </Link>
                      </TableCell>
                      <TableCell>{s.circle || "-"}</TableCell>
                      <TableCell>{s.division || "-"}</TableCell>
                      <TableCell>{s.subDivision || "-"}</TableCell>
                      <TableCell>{s.section || "-"}</TableCell>
                      <TableCell>{s.contractedLoad || "-"}</TableCell>
                      <TableCell>{s.uploadDate ? new Date(s.uploadDate).toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }) : "-"}</TableCell>
                      <TableCell>{s.approvedDate ? new Date(s.approvedDate).toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }) : "-"}</TableCell>
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
                    {s.kind === "stored" && s.installerId ? getUserById(s.installerId)?.name ?? s.installerId : "-"}
                  </TableCell>
                  <TableCell>
                    {s.kind === "stored" && s.submittedById
                      ? getUserById(s.submittedById)?.name ?? s.submittedById
                      : "-"}
                  </TableCell>
                      <TableCell>
                        {s.kind === "stored" ? (
                          <Link href={`/surveys/${s.id}/edit`} className="inline-flex items-center text-sm underline underline-offset-4">
                            <Pencil className="mr-1 h-4 w-4" />
                            Edit
                          </Link>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="px-2"
                            onClick={() =>
                              toast({ title: "Demo record", description: "This survey comes from mock data and can't be edited." })
                            }
                          >
                            <Pencil className="mr-1 h-4 w-4" />
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredSurveys.length === 0 && !surveysLoading && (
                    <TableRow>
                      <TableCell colSpan={16} className="py-10 text-center text-sm text-muted-foreground">
                        No surveys found. Try a different search or status filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="cards">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSurveys.map((s: any, idx: number) => (
                  <Link key={`${s.kind}-${s.id}`} href={`/surveys/${s.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Card className="border-gray-200 bg-white shadow-sm rounded-xl transition-colors hover:bg-muted/50 cursor-pointer">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">SNO: {idx + 1}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Service No: <span className="font-medium text-foreground">{s.serviceNumber || "-"}</span>
                            </p>
                            <CardTitle className="mt-1 text-base truncate">{s.consumerName || "-"}</CardTitle>
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
                      <span className="text-muted-foreground">Installer</span>
                      <span className="font-medium">
                        {s.kind === "stored" && s.installerId ? getUserById(s.installerId)?.name ?? s.installerId : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Surveyor</span>
                      <span className="font-medium">
                        {s.kind === "stored" && s.submittedById
                          ? getUserById(s.submittedById)?.name ?? s.submittedById
                          : "-"}
                      </span>
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
                        <span className="text-muted-foreground">Contracted Load</span>
                        <span className="font-medium">{s.contractedLoad || "-"}</span>
                      </div>
                      <div className="pt-2 text-xs text-muted-foreground">
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <span>CIRCLE: {s.circle || "-"}</span>
                          <span>DIV: {s.division || "-"}</span>
                          <span>SUB: {s.subDivision || "-"}</span>
                          <span>SEC: {s.section || "-"}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          <span>Upload: {s.uploadDate ? new Date(s.uploadDate).toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }) : "-"}</span>
                          <span>Approved: {s.approvedDate ? new Date(s.approvedDate).toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }) : "-"}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  </Link>
                ))}
                {filteredSurveys.length === 0 && !surveysLoading && (
                  <Card className="border-gray-200 bg-white shadow-sm rounded-xl sm:col-span-2 lg:col-span-3">
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                      No surveys found. Try a different search or status filter.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
          )}

          {/* Load more / count */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium">{filteredSurveys.length}</span>
              {total > 0 && (
                <>
                  {" "}
                  of <span className="font-medium">{total}</span>
                </>
              )}
            </p>
            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center py-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-lg"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table already shows empty state */}
    </div>
  )
}
