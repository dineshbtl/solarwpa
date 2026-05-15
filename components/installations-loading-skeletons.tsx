"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SolarWatermark } from "@/components/solar-watermark"

function KpiCardSkeleton() {
  return (
    <div className="w-[260px] shrink-0 rounded-xl bg-gradient-dark-green p-5 shadow-lg sm:w-auto sm:shrink">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-4 w-32 bg-white/25" />
          <Skeleton className="h-10 w-14 bg-white/25 sm:h-11" />
          <Skeleton className="h-3 w-24 bg-white/20" />
        </div>
        <Skeleton className="h-11 w-11 shrink-0 rounded-lg bg-white/20" />
      </div>
    </div>
  )
}

export function InstallationsListPageSkeleton() {
  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 pb-10" aria-busy="true" aria-label="Loading installations">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-52 max-w-[85vw]" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-11 w-44 shrink-0 rounded-xl" />
      </div>

      <div className="mb-6 sm:mb-8 overflow-x-auto pb-2 sm:overflow-visible sm:pb-0">
        <div className="flex min-w-max gap-4 sm:min-w-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
        </div>
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
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Skeleton className="h-10 w-full rounded-md sm:w-[140px]" />
              <Skeleton className="h-9 w-36 rounded-lg" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-11 gap-3 border-b border-border pb-3">
                {Array.from({ length: 11 }).map((_, i) => (
                  <Skeleton key={`head-${i}`} className="h-4 w-20" />
                ))}
              </div>
              <div className="space-y-3 pt-4">
                {Array.from({ length: 10 }).map((_, row) => (
                  <div key={`row-${row}`} className="grid grid-cols-11 gap-3">
                    {Array.from({ length: 11 }).map((__, col) => (
                      <Skeleton key={`cell-${row}-${col}`} className="h-4 w-full" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-4 w-44" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function InstallationDetailPageSkeleton({ showWatermark = true }: { showWatermark?: boolean }) {
  return (
    <div className="relative w-full pb-10" aria-busy="true" aria-label="Loading installation">
      {showWatermark ? <SolarWatermark /> : null}
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="mb-6 h-10 w-48 rounded-md" />
        <div className="space-y-6">
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-8 w-64 max-w-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-28 rounded-full" />
                  <Skeleton className="h-9 w-24 rounded-md" />
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </CardContent>
          </Card>

          <Card className="border-solar bg-solar-card shadow-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-full max-w-md" />
                  <Skeleton className="h-4 w-full max-w-sm" />
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Skeleton className="h-10 w-full rounded-md sm:w-40" />
                  <Skeleton className="h-10 w-full rounded-md sm:w-44" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </CardContent>
            </Card>
            <Card className="border-solar bg-solar-card shadow-sm">
              <CardHeader>
                <Skeleton className="h-6 w-36" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

export function InstallationEditPageSkeleton({
  ariaLabel = "Loading installation editor",
}: {
  ariaLabel?: string
}) {
  return (
    <div className="w-full px-4 py-6 sm:p-8 pb-12" aria-busy="true" aria-label={ariaLabel}>
      <main className="relative z-10 mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Skeleton className="h-10 w-44 rounded-md" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-24 rounded-md" />
            <Skeleton className="h-10 w-36 rounded-md" />
          </div>
        </div>
        <div className="space-y-6">
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-8 w-56" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-8 w-24 shrink-0 rounded-full" />
              </div>
              <Skeleton className="mt-3 h-3 w-full max-w-lg" />
            </CardHeader>
          </Card>
          <Card className="border-solar bg-solar-card shadow-sm">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

/** Same layout as the edit form; used on /installations/new */
export function InstallationNewPageSkeleton() {
  return <InstallationEditPageSkeleton ariaLabel="Loading new installation form" />
}
