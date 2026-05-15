"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function KpiSkeleton() {
  return (
    <Card className="overflow-hidden rounded-xl border border-border shadow-lg">
      <div className="bg-gradient-dark-green p-6">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-14 w-14 rounded-xl bg-white/20" />
          <Skeleton className="h-4 w-12 rounded bg-white/15" />
        </div>
        <Skeleton className="h-4 w-28 bg-white/25" />
        <Skeleton className="mt-3 h-10 w-16 bg-white/25" />
      </div>
    </Card>
  )
}

export function ProjectsPageSkeleton() {
  return (
    <div className="w-full px-4 py-6 sm:p-8 pb-10" aria-busy="true" aria-label="Loading projects">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-11 w-56 max-w-[85vw]" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-11 w-44 shrink-0 rounded-xl" />
      </div>

      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
      </div>

      <div className="space-y-4">
        {[0, 1].map((k) => (
          <Card key={k} className="overflow-hidden rounded-xl border border-border shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-7 w-64 max-w-full" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-4 w-full max-w-md" />
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Skeleton className="h-6 w-28 rounded-full" />
                      <Skeleton className="h-6 w-32 rounded-full" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-8 w-24 rounded-full" />
                  <Skeleton className="h-9 w-24 rounded-lg" />
                  <Skeleton className="h-9 w-28 rounded-lg" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="mb-4 flex flex-wrap gap-3">
                <Skeleton className="h-24 w-36 rounded-lg" />
                <Skeleton className="h-24 w-36 rounded-lg" />
                <Skeleton className="h-24 w-36 rounded-lg" />
              </div>
              <Skeleton className="h-4 w-full max-w-2xl" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function ProjectEditPageSkeleton() {
  return (
    <div className="w-full px-4 py-6 sm:p-8 pb-10" aria-busy="true" aria-label="Loading project editor">
      <Skeleton className="mb-6 h-10 w-44 rounded-md" />
      <Card className="max-w-2xl rounded-xl border-border bg-card shadow-sm">
        <CardHeader>
          <Skeleton className="h-8 w-52" />
          <Skeleton className="mt-2 h-4 w-full max-w-lg" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-11 w-full rounded-md" />
              <Skeleton className="h-11 w-full rounded-md" />
              <Skeleton className="h-11 w-full rounded-md" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-28 rounded-md" />
            <Skeleton className="h-10 w-36 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
