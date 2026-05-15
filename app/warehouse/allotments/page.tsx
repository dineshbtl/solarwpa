"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, UserCheck, MapPin, User, Users, Calendar } from "lucide-react"
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
import { listAllotments } from "@/lib/supabase/warehouse"
import type { VillageAllotment } from "@/lib/store/warehouse"

export default function AllotmentsPage() {
  const [allotments, setAllotments] = useState<VillageAllotment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listAllotments()
      .then(setAllotments)
      .catch((e: Error) => setError(e.message ?? "Failed to load"))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Installer Allotments</h1>
          <p className="mt-1 text-muted-foreground">Assign installation engineers to villages</p>
        </div>
        <Link href="/warehouse/allotments/new">
          <Button className="bg-solar-dark text-white hover:bg-solar-dark/90">
            <Plus className="mr-2 h-4 w-4" />
            New Allotment
          </Button>
        </Link>
      </div>

      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-muted-foreground" />
            Allotment Records ({loading ? "…" : allotments.length})
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
          ) : allotments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="rounded-full bg-muted p-5">
                <UserCheck className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-foreground">No allotments yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Create a new allotment to assign an engineer to a village.</p>
              </div>
              <Link href="/warehouse/allotments/new">
                <Button className="bg-solar-dark text-white hover:bg-solar-dark/90">
                  <Plus className="mr-2 h-4 w-4" />
                  New Allotment
                </Button>
              </Link>
            </div>
          ) : (
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-20 bg-card shadow-[8px_0_10px_-8px_rgba(0,0,0,0.18)]"><span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Mandal</span></TableHead>
                    <TableHead>Village</TableHead>
                    <TableHead><span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> Engineer ID</span></TableHead>
                    <TableHead><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> HH Allotted</span></TableHead>
                    <TableHead><span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Date</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allotments.map((a) => (
                    <TableRow key={a.id} className="hover:bg-muted/40">
                      <TableCell className="sticky left-0 z-10 bg-card font-medium shadow-[8px_0_10px_-8px_rgba(0,0,0,0.12)]">{a.mandal}</TableCell>
                      <TableCell>{a.villageName}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          {a.engineerId ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">{a.householdsAllotted ?? "—"}</TableCell>
                      <TableCell>
                        {a.allottedDate ? new Date(a.allottedDate).toLocaleDateString("en-IN") : "—"}
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
