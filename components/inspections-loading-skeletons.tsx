"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SolarWatermark } from "@/components/solar-watermark"

export function InspectionsListPageSkeleton() {
  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10" aria-busy="true" aria-label="Loading inspections">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-9 w-48 max-w-[85vw]" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Card className="mb-6 rounded-xl border-border bg-card shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Skeleton className="h-10 w-full flex-1 rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg sm:w-[200px]" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Skeleton className="h-10 w-full rounded-md sm:w-[140px]" />
              <Skeleton className="h-9 w-36 rounded-lg" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden rounded-xl border-border shadow-sm">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-6 w-[85%] max-w-[220px]" />
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[80%]" />
                  <div className="flex justify-between gap-4 pt-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-28" />
                  </div>
                  <div className="flex gap-4 pt-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/** Matches inspection detail layout (workflow + actions + grids). */
export function InspectionDetailPageSkeleton({ showWatermark = true }: { showWatermark?: boolean }) {
  return (
    <div className="relative w-full pb-10" aria-busy="true" aria-label="Loading inspection">
      {showWatermark ? <SolarWatermark /> : null}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="mb-6 h-10 w-52 rounded-md" />
        <div className="space-y-6">
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-8 w-72 max-w-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-9 w-28 rounded-full" />
              </div>
            </CardHeader>
          </Card>
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <Skeleton className="h-6 w-56" />
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </CardContent>
          </Card>
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-10 w-36 rounded-md" />
                <Skeleton className="h-10 w-36 rounded-md" />
                <Skeleton className="h-10 w-40 rounded-md" />
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <Skeleton className="h-6 w-44" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="h-32 w-full rounded-lg" />
              </CardContent>
            </Card>
            <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

export function InspectionEditPageSkeleton() {
  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10" aria-busy="true" aria-label="Loading inspection editor">
      <main className="relative z-10 mx-auto max-w-2xl">
        <Skeleton className="mb-6 h-10 w-40 rounded-md" />
        <Card className="border-border bg-card shadow-sm rounded-xl">
          <CardHeader>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="mt-2 h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-10 flex-1 rounded-md sm:flex-none sm:w-28" />
              <Skeleton className="h-10 flex-1 rounded-md sm:w-36" />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
