"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CheckCircle, Search, Filter, LayoutGrid, Table2, Pencil } from "lucide-react"
import { mockInspections } from "@/lib/mock-data"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useInspections, useUsers } from "@/lib/data/hooks"
import { seedUsers } from "@/lib/data/users"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"

export default function InspectionsPage() {
  const { data: storedList = [], refetch } = useInspections()
  const { data: users = [], refetch: refetchUsers } = useUsers()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [view, setView] = useState<"cards" | "table">("cards")
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10)
  const [page, setPage] = useState(1)

  useEffect(() => {
    seedUsers().then(() => refetchUsers())
  }, [refetchUsers])

  const getUserById = (id: string) => users.find((u) => u.id === id)

  const allInspections = useMemo(() => {
    const stored = storedList.map((i) => ({
      kind: "stored" as const,
      id: i.id,
      status: i.status,
      customerName: i.customerName,
      address: i.address,
      installationId: i.installationId,
      inspectorId: i.inspectorId ?? "",
      managerApproved: i.managerApproval.approved,
      governmentApproved: Boolean(i.governmentInspection?.approved),
      createdAt: i.createdAt,
    }))
    const legacy = mockInspections.map((i) => ({
      kind: "legacy" as const,
      id: i.id,
      status: i.status,
      customerName: i.customerName,
      address: i.address,
      installationId: i.installationId,
      inspectorId: "",
      managerApproved: i.managerApproval.approved,
      governmentApproved: Boolean(i.governmentInspection?.approved),
      createdAt: i.createdAt,
    }))
    return [...stored, ...legacy]
  }, [storedList])

  const filteredInspections = allInspections.filter((inspection: any) => {
    const matchesSearch =
      inspection.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inspection.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inspection.id.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || inspection.status === statusFilter

    return matchesSearch && matchesStatus
  })

  useEffect(() => {
    seedUsers()
    setPage(1)
  }, [searchQuery, statusFilter, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredInspections.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const pageItems = filteredInspections.slice(startIndex, endIndex)

  return (
    <div className="min-h-screen p-6 sm:p-8">
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
              <CardTitle className="text-lg">Inspection List ({filteredInspections.length})</CardTitle>
              <p className="text-sm text-muted-foreground">Includes inspection requests created from installations</p>
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
                {pageItems.map((inspection: any) => (
                  <Link key={`${inspection.kind}-${inspection.id}`} href={`/inspections/${inspection.id}`}>
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
                              <CheckCircle className={`h-4 w-4 ${inspection.managerApproved ? "text-green-600" : "text-muted-foreground300"}`} />
                              <span className="text-xs text-muted-foreground">Manager Approval</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle className={`h-4 w-4 ${inspection.governmentApproved ? "text-green-600" : "text-muted-foreground300"}`} />
                              <span className="text-xs text-muted-foreground">Government Inspection</span>
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
                    <TableHead>Installation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Gov</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Inspector</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((i: any) => (
                    <TableRow key={`${i.kind}-${i.id}`}>
                      <TableCell className="font-medium">
                        <Link href={`/inspections/${i.id}`} className="underline underline-offset-4">
                          {i.id}
                        </Link>
                      </TableCell>
                      <TableCell>{i.customerName}</TableCell>
                      <TableCell>{i.installationId}</TableCell>
                      <TableCell>{i.status}</TableCell>
                      <TableCell>{i.managerApproved ? "Approved" : "Pending"}</TableCell>
                      <TableCell>{i.governmentApproved ? "Approved" : "Pending"}</TableCell>
                      <TableCell>{i.createdAt ? new Date(i.createdAt).toLocaleDateString() : "-"}</TableCell>
                      <TableCell>
                        {i.kind === "stored" && i.inspectorId ? getUserById(i.inspectorId)?.name ?? i.inspectorId : "-"}
                      </TableCell>
                      <TableCell>
                        {i.kind === "stored" ? (
                          <Link href={`/inspections/${i.id}/edit`} className="inline-flex items-center text-sm underline underline-offset-4">
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
                              toast({ title: "Demo record", description: "This inspection comes from mock data and can't be edited." })
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
                      <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                        No inspections found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>

          {filteredInspections.length > 0 && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium">{startIndex + 1}</span>–
                <span className="font-medium">{Math.min(endIndex, filteredInspections.length)}</span> of{" "}
                <span className="font-medium">{filteredInspections.length}</span>
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
