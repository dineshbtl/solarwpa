"use client"

import { useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Wrench,
  Search,
  Filter,
  LayoutGrid,
  Table2,
  Plus,
  Pencil,
  TrendingUp,
  Clock,
  Play,
  CheckCircle,
  Users,
  ClipboardList,
  ListTodo,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useInstallationsPaginated } from "@/lib/data/hooks"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ACTIVE_PROJECT_ID } from "@/lib/data/active-project"
import { InstallationsListPageSkeleton } from "@/components/installations-loading-skeletons"
import { useRole } from "@/contexts/role-context"
import { hasAnyPermissionFromMap } from "@/lib/rbac"
import { INSTALLATIONS_CREATE_PERMISSIONS } from "@/lib/route-permissions"

export default function InstallationsPage() {
  const { role, permissionMap } = useRole()
  const canCreateInstallation = hasAnyPermissionFromMap(role, INSTALLATIONS_CREATE_PERMISSIONS, permissionMap)
  const {
    data: items,
    total,
    kpi,
    kpiLoading,
    loadingExactTotal,
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
  } = useInstallationsPaginated()

  const [view, setView] = useState<"cards" | "table">("table")

  // Debounce search input so we don't fire a query on every keystroke
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = (value: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => setSearch(value), 300)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const showInitialSkeleton = loading && items.length === 0
  const showRefreshing = loading && items.length > 0

  const pending = kpi.pending
  const inProgress = kpi.inProgress
  const completed = kpi.completed
  const inspectionPending = kpi.inspectionPending
  const assignmentKpi = role === "installer" ? kpi.surveyAssignment : undefined

  if (showInitialSkeleton) {
    return <InstallationsListPageSkeleton />
  }

  if (error) {
    return (
      <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <p className="text-destructive">Could not load installations. Please refresh.</p>
      </div>
    )
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Installations</h1>
          <p className="mt-1 text-muted-foreground">Track and manage solar panel installations</p>
        </div>
        {canCreateInstallation ? (
          <Link href="/installations/new">
            <Button className="bg-gradient-primary-button text-white hover:opacity-90 rounded-xl">
              <Plus className="mr-2 h-4 w-4" />
              New Installation
            </Button>
          </Link>
        ) : null}
      </div>

      {/* KPI cards — installers: assignment coverage vs installation workflow */}
      {assignmentKpi ? (
        <>
          <p className="mb-3 text-sm font-medium text-muted-foreground">Survey assignment (your portfolio)</p>
          <div className="mb-6 sm:mb-8 overflow-x-auto pb-2 sm:overflow-visible sm:pb-0">
            <div className="flex min-w-max gap-4 sm:gap-6 sm:min-w-0 sm:grid sm:grid-cols-3">
              {([
                {
                  label: "Assigned households",
                  value: assignmentKpi.assignedHouseholds,
                  caption: "Surveys assigned to you in this project",
                  icon: Users,
                  href: "/assignments/survey-installers",
                },
                {
                  label: "Installation started",
                  value: assignmentKpi.householdsWithInstallation,
                  caption: "Household with an installation record",
                  icon: ClipboardList,
                  href: "/assignments/survey-installers?installation_status=__has_installation__",
                },
                {
                  label: "Not started yet",
                  value: assignmentKpi.householdsPendingInstallation,
                  caption: "Use New Installation to begin",
                  icon: ListTodo,
                  href: "/assignments/survey-installers?installation_status=__no_installation__",
                },
              ] as const).map((tile) => {
                const Icon = tile.icon
                return (
                  <Link
                    key={tile.label}
                    href={tile.href}
                    className="w-[260px] shrink-0 rounded-xl border border-green-900/40 bg-gradient-dark-green p-5 shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto sm:shrink"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white/85">{tile.label}</p>
                        <p className="mt-2 text-3xl font-bold tabular-nums text-white sm:text-4xl">
                          {kpiLoading ? "..." : tile.value}
                        </p>
                        <p className="mt-1 text-xs text-green-100">{tile.caption}</p>
                      </div>
                      <div className="rounded-lg bg-white/15 p-2.5 shrink-0">
                        <Icon className="h-6 w-6 text-white" aria-hidden />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
          <p className="mb-3 text-sm font-medium text-muted-foreground">Installation records (list below)</p>
        </>
      ) : null}
      <div className="mb-6 sm:mb-8 overflow-x-auto pb-2 sm:overflow-visible sm:pb-0">
        <div className="flex min-w-max gap-4 sm:gap-6 sm:min-w-0 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {([
            {
              id: "",
              label: "Total installations",
              value: kpi.total,
              caption:
                role === "installer" ? "Installation rows in your scope" : `Project ${ACTIVE_PROJECT_ID}`,
              icon: TrendingUp,
            },
            {
              id: "pending",
              label: "Pending",
              value: pending,
              caption: "Not started",
              icon: Clock,
            },
            {
              id: "in_progress",
              label: "In progress",
              value: inProgress,
              caption: "Active work",
              icon: Play,
            },
            {
              id: "completed",
              label: "Completed",
              value: completed,
              caption:
                inspectionPending > 0
                  ? `${inspectionPending} awaiting inspection`
                  : "Marked complete",
              icon: CheckCircle,
            },
          ] as const).map((tile) => {
            const Icon = tile.icon
            const active = statusFilter === tile.id
            return (
              <button
                key={tile.label}
                type="button"
                onClick={() => setStatusFilter(tile.id)}
                aria-pressed={active}
                disabled={kpiLoading}
                className={`w-[260px] shrink-0 rounded-xl bg-gradient-dark-green p-5 text-left shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-80 sm:w-auto sm:shrink ${
                  active ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-background" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white/85">{tile.label}</p>
                    <p className="mt-2 text-3xl font-bold tabular-nums text-white sm:text-4xl">
                      {kpiLoading ? "..." : tile.value}
                    </p>
                    <p className="mt-1 text-xs text-green-100">{tile.caption}</p>
                  </div>
                  <div className="rounded-lg bg-white/15 p-2.5 shrink-0">
                    <Icon className="h-6 w-6 text-white" aria-hidden />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6 bg-card border-border shadow-sm rounded-xl">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by customer name, address, mobile, service number, or ID..."
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
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="inspection_pending">Inspection Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-sm rounded-xl">
        <Tabs value={view} onValueChange={(v) => setView(v as "cards" | "table")} className="min-h-0">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg inline-flex items-center gap-2">
                  Installation List ({loadingExactTotal ? `~${total}` : total})
                  {showRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Refreshing list" />
                  ) : null}
                </CardTitle>
                <p className="text-sm text-muted-foreground">List and track installation progress</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / page</SelectItem>
                    <SelectItem value="20">20 / page</SelectItem>
                    <SelectItem value="50">50 / page</SelectItem>
                  </SelectContent>
                </Select>

                <TabsList>
                  <TabsTrigger value="cards">
                    <LayoutGrid className="h-4 w-4" />
                    Cards
                  </TabsTrigger>
                  <TabsTrigger value="table">
                    <Table2 className="h-4 w-4" />
                    List
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TabsContent value="cards" className="min-h-0">
              {showInitialSkeleton ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: pageSize }).map((_, i) => (
                    <div key={i} className="h-56 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No installations found.</p>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((installation) => (
                    <Link key={installation.id} href={`/installations/${installation.id}`}>
                      <Card className="h-full border-border bg-card shadow-sm transition-all hover:shadow-lg rounded-xl">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="rounded-lg bg-gradient-light-green p-2">
                              <Wrench className="h-5 w-5 text-white" />
                            </div>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                installation.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : installation.status === "in_progress"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {installation.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <CardTitle className="mt-4 text-lg text-foreground">{installation.customerName}</CardTitle>
                          {installation.id && (
                            <p className="mt-1 text-xs text-muted-foreground">ID: {installation.id}</p>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Survey contact</p>
                              <p className="text-sm text-foreground">
                                {installation.surveyServiceNo || "—"}
                                {installation.surveyMobile ? ` · ${installation.surveyMobile}` : ""}
                              </p>
                              {installation.surveyCircle ? (
                                <p className="mt-0.5 text-xs text-muted-foreground">Circle: {installation.surveyCircle}</p>
                              ) : null}
                            </div>
                            {(installation.projectId || installation.surveyId) && (
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                {installation.projectId && <span>Project: {installation.projectId}</span>}
                                {installation.surveyId && <span>Survey: {installation.surveyId}</span>}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Engineer</p>
                              <p className="text-sm text-foreground">{installation.engineerName || installation.engineerId || "—"}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Installer assigned by</p>
                              <p className="text-sm text-foreground">
                                {installation.installerAssignedByName || "—"}
                                {installation.installerAssignedAt ? (
                                  <span className="mt-0.5 block text-xs text-muted-foreground">
                                    {new Date(installation.installerAssignedAt).toLocaleString()}
                                  </span>
                                ) : null}
                              </p>
                            </div>
                            {installation.createdAt && (
                              <p className="text-xs text-muted-foreground">
                                Created: {new Date(installation.createdAt).toLocaleDateString()}
                              </p>
                            )}
                            <div className="pt-2">
                              <div className="flex items-center gap-2">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                                  <div
                                    className={`h-full bg-gradient-primary-button ${
                                      installation.status === "completed"
                                        ? "w-full"
                                        : installation.status === "in_progress"
                                          ? "w-2/3"
                                          : "w-1/3"
                                    }`}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {installation.status === "completed"
                                    ? "100%"
                                    : installation.status === "in_progress"
                                      ? "66%"
                                      : "33%"}
                                </span>
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
                <Table className="min-w-[1420px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-20 bg-card shadow-[8px_0_10px_-8px_rgba(0,0,0,0.18)]">ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Service No.</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Circle</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Survey</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Engineer</TableHead>
                      <TableHead>Installer assigned by</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead className="sticky right-0 z-20 bg-card text-right shadow-[-8px_0_10px_-8px_rgba(0,0,0,0.18)]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {showInitialSkeleton ? (
                      Array.from({ length: pageSize }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 14 }).map((__, j) => (
                            <TableCell key={j}>
                              <div className="h-4 animate-pulse rounded bg-muted" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={14} className="py-10 text-center text-sm text-muted-foreground">
                          No installations found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="sticky left-0 z-10 bg-card font-medium shadow-[8px_0_10px_-8px_rgba(0,0,0,0.12)]">
                            <Link href={`/installations/${i.id}`} className="underline underline-offset-4">
                              {i.id}
                            </Link>
                          </TableCell>
                          <TableCell>{i.customerName}</TableCell>
                          <TableCell>{i.surveyServiceNo || "—"}</TableCell>
                          <TableCell>{i.surveyMobile || "—"}</TableCell>
                          <TableCell>{i.surveyCircle || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{i.projectId || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{i.surveyId || "—"}</TableCell>
                          <TableCell>{i.status.replace(/_/g, " ")}</TableCell>
                          <TableCell>{i.engineerName || i.engineerId || "—"}</TableCell>
                          <TableCell className="min-w-[160px] max-w-[220px] text-sm">
                            {i.installerAssignedByName || "—"}
                            {i.installerAssignedAt ? (
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {new Date(i.installerAssignedAt).toLocaleString()}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell>{i.createdAt ? new Date(i.createdAt).toLocaleDateString() : "—"}</TableCell>
                          <TableCell>{i.startedAt ? new Date(i.startedAt).toLocaleDateString() : "—"}</TableCell>
                          <TableCell>{i.completedAt ? new Date(i.completedAt).toLocaleDateString() : "—"}</TableCell>
                          <TableCell className="sticky right-0 z-10 bg-card text-right shadow-[-8px_0_10px_-8px_rgba(0,0,0,0.12)]">
                            <Link href={`/installations/${i.id}/edit`} className="inline-flex min-h-9 items-center text-sm underline underline-offset-4">
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

          {/* Pagination */}
          {total > 0 && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span>–
                <span className="font-medium">{Math.min(page * pageSize, total)}</span> of{" "}
                <span className="font-medium">{loadingExactTotal ? `~${total}` : total}</span>
                {loadingExactTotal ? " (updating...)" : ""}
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
        </Tabs>
      </Card>
    </div>
  )
}
