"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Wrench, Search, Filter, LayoutGrid, Table2, Plus, Pencil } from "lucide-react"
import { mockInstallations } from "@/lib/mock-data"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useInstallations } from "@/lib/data/hooks"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export default function InstallationsPage() {
  const { data: storedList = [] } = useInstallations()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [view, setView] = useState<"cards" | "table">("cards")
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10)
  const [page, setPage] = useState(1)

  const allInstallations = useMemo(() => {
    const stored = storedList.map((i) => ({
      kind: "stored" as const,
      id: i.id,
      projectId: i.projectId ?? "",
      surveyId: i.surveyId ?? "",
      customerName: i.customerName,
      address: i.address,
      engineerName: i.engineerName ?? "",
      engineerId: i.engineerId ?? "",
      status: i.status,
      materialsCount: (i.materials ?? []).length,
      photosCount: (i.photos ?? []).length,
      startedAt: i.startedAt ?? "",
      completedAt: i.completedAt ?? "",
      createdAt: i.createdAt ?? "",
    }))
    if (isSupabaseConfigured()) return stored
    const legacy = mockInstallations.map((i) => ({
      kind: "legacy" as const,
      id: i.id,
      projectId: "",
      surveyId: "",
      customerName: i.customerName,
      address: i.address,
      engineerName: i.engineerName ?? "",
      engineerId: "",
      status: i.status,
      materialsCount: i.materials?.length ?? 0,
      photosCount: 0,
      startedAt: i.startedAt ?? "",
      completedAt: i.completedAt ?? "",
      createdAt: "",
    }))
    return [...stored, ...legacy]
  }, [storedList])

  const filteredInstallations = allInstallations.filter((installation: any) => {
    const matchesSearch =
      installation.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      installation.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      installation.id.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || installation.status === statusFilter

    return matchesSearch && matchesStatus
  })

  useEffect(() => {
    setPage(1)
  }, [searchQuery, statusFilter, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredInstallations.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const pageItems = filteredInstallations.slice(startIndex, endIndex)

  return (
    <div className="min-h-screen p-6 sm:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Installations</h1>
          <p className="mt-1 text-muted-foreground">Track and manage solar panel installations</p>
        </div>
        <Link href="/installations/new">
          <Button className="bg-gradient-primary-button text-white hover:opacity-90 rounded-xl">
            <Plus className="mr-2 h-4 w-4" />
            New Installation
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-6 bg-card border-border shadow-sm rounded-xl">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by customer name, address, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-border bg-background pl-9 rounded-lg"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Installation List ({filteredInstallations.length})</CardTitle>
              <p className="text-sm text-muted-foreground">List and track installation progress</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v) as 10 | 25 | 50)}>
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
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {pageItems.map((installation: any) => (
                  <Link key={`${installation.kind}-${installation.id}`} href={`/installations/${installation.id}`}>
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
                            {installation.status.replace("_", " ")}
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
                            <p className="text-sm font-medium text-muted-foreground">Address</p>
                            <p className="text-sm text-foreground">
                              {installation.address
                                ? installation.address.split(",").slice(0, 2).join(",").trim() || installation.address.slice(0, 60)
                                : "—"}
                            </p>
                          </div>
                          {(installation.projectId || installation.surveyId) && (
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              {installation.projectId && <span>Project: {installation.projectId}</span>}
                              {installation.surveyId && <span>Survey: {installation.surveyId}</span>}
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Materials</p>
                              <p className="text-sm font-semibold text-foreground">{installation.materialsCount} items</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Photos</p>
                              <p className="text-sm font-semibold text-foreground">{installation.photosCount ?? 0} items</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Engineer</p>
                            <p className="text-sm text-foreground">{installation.engineerName || installation.engineerId || "—"}</p>
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
            </TabsContent>

            <TabsContent value="table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Survey</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Engineer</TableHead>
                    <TableHead>Materials</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((i: any) => (
                    <TableRow key={`${i.kind}-${i.id}`}>
                      <TableCell className="font-medium">
                        <Link href={`/installations/${i.id}`} className="underline underline-offset-4">
                          {i.id}
                        </Link>
                      </TableCell>
                      <TableCell>{i.customerName}</TableCell>
                      <TableCell className="min-w-[200px] max-w-[280px] truncate" title={i.address}>{i.address || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{i.projectId || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{i.surveyId || "—"}</TableCell>
                      <TableCell>{i.status.replace("_", " ")}</TableCell>
                      <TableCell>{i.engineerName || i.engineerId || "—"}</TableCell>
                      <TableCell>{i.materialsCount}</TableCell>
                      <TableCell>{i.createdAt ? new Date(i.createdAt).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>{i.startedAt ? new Date(i.startedAt).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>{i.completedAt ? new Date(i.completedAt).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        {i.kind === "stored" ? (
                          <Link href={`/installations/${i.id}/edit`} className="inline-flex items-center text-sm underline underline-offset-4">
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
                              toast({
                                title: "Demo record",
                                description: "This installation comes from mock data and can't be edited.",
                              })
                            }
                          >
                            <Pencil className="mr-1 h-4 w-4" />
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {pageItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12} className="py-10 text-center text-sm text-muted-foreground">
                        No installations found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>

          {/* Pagination */}
          {filteredInstallations.length > 0 && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium">{startIndex + 1}</span>–
                <span className="font-medium">{Math.min(endIndex, filteredInstallations.length)}</span> of{" "}
                <span className="font-medium">{filteredInstallations.length}</span>
              </p>

              <Pagination className="justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setPage((p) => Math.max(1, p - 1))
                      }}
                      aria-disabled={safePage === 1}
                      className={safePage === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>

                  {Array.from({ length: totalPages }).slice(0, 7).map((_, idx) => {
                    const pageNum = idx + 1
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          href="#"
                          isActive={pageNum === safePage}
                          onClick={(e) => {
                            e.preventDefault()
                            setPage(pageNum)
                          }}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  })}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setPage((p) => Math.min(totalPages, p + 1))
                      }}
                      aria-disabled={safePage === totalPages}
                      className={safePage === totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card/Table already shows empty state */}
    </div>
  )
}
