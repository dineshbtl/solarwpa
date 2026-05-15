"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { UsersTableSkeleton } from "@/components/users-loading-skeletons"

export default function Loading() {
  return (
    <div className="w-full px-4 py-6 sm:p-8 pb-10" aria-busy="true" aria-label="Loading users">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-9 w-52 max-w-[85vw]" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Card className="mb-6 rounded-xl border-border bg-card shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg sm:w-[180px]" />
            <Skeleton className="h-10 w-full rounded-lg sm:w-[180px]" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <Skeleton className="h-7 w-40" />
        </CardHeader>
        <CardContent>
          <UsersTableSkeleton />
        </CardContent>
      </Card>
    </div>
  )
}
