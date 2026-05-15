"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Package, MapPin, Users, Calendar, User, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { listVillageIssues } from "@/lib/supabase/warehouse"
import type { MaterialIssueVillage } from "@/lib/store/warehouse"

export default function VillageIssuesPage() {
  const [issues, setIssues] = useState<MaterialIssueVillage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listVillageIssues()
      .then(setIssues)
      .catch((e: Error) => setError(e.message ?? "Failed to load"))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Issue to Villages</h1>
          <p className="mt-1 text-muted-foreground">
            Issue materials from Kurnool Warehouse to villages (household-based)
          </p>
        </div>
        <Link href="/warehouse/villages/new">
          <Button className="bg-gradient-primary-button text-white hover:opacity-90 rounded-xl">
            <Plus className="mr-2 h-4 w-4" />
            New Village Issue
          </Button>
        </Link>
      </div>

      {/* Content */}
      <Card className="border-border bg-card shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            Village Issue Records ({loading ? "…" : issues.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : issues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="rounded-full bg-muted p-5">
                <Package className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-foreground">No village issues yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start by creating a new village issue challan.
                </p>
              </div>
              <Link href="/warehouse/villages/new">
                <Button className="bg-gradient-primary-button text-white hover:opacity-90 rounded-xl">
                  <Plus className="mr-2 h-4 w-4" />
                  New Village Issue
                </Button>
              </Link>
            </div>
          ) : (
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-20 bg-card shadow-[8px_0_10px_-8px_rgba(0,0,0,0.18)]">
                      <span className="flex items-center gap-1">
                        <Hash className="h-3.5 w-3.5" /> Challan No
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> Mandal
                      </span>
                    </TableHead>
                    <TableHead>Village</TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> Households
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> Date
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" /> Issued By
                      </span>
                    </TableHead>
                    <TableHead>Items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((issue) => (
                    <TableRow key={issue.id} className="hover:bg-muted/40">
                      <TableCell className="sticky left-0 z-10 bg-card font-medium shadow-[8px_0_10px_-8px_rgba(0,0,0,0.12)]">{issue.issueChallanNo}</TableCell>
                      <TableCell>{issue.mandal}</TableCell>
                      <TableCell>{issue.villageName}</TableCell>
                      <TableCell className="tabular-nums">{issue.householdsApproved}</TableCell>
                      <TableCell>
                        {issue.issueDate
                          ? new Date(issue.issueDate).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>{issue.issuedBy || "—"}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          {Array.isArray(issue.items) ? issue.items.length : 0} items
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
