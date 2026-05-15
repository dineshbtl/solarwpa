"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function UsersTableSkeleton() {
  return (
    <div className="space-y-4 py-2" aria-busy="true" aria-label="Loading users">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created at</TableHead>
            <TableHead>Permissions</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="space-y-2 py-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-48 max-w-[200px]" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-10 w-full max-w-[180px] rounded-md" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-20 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-28 rounded-full" />
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function UserDetailPageSkeleton() {
  return (
    <div className="w-full px-4 py-6 sm:p-8 pb-10" aria-busy="true" aria-label="Loading user">
      <Skeleton className="mb-6 h-10 w-40 rounded-md" />
      <Card className="max-w-2xl rounded-xl border-border bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-9 w-56 max-w-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
            <Skeleton className="h-9 w-24 shrink-0 rounded-md" />
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-full max-w-[240px]" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export function UserEditPageSkeleton() {
  return (
    <div className="w-full px-4 py-6 sm:p-8 pb-10" aria-busy="true" aria-label="Loading user editor">
      <Skeleton className="mb-6 h-10 w-44 rounded-md" />
      <Card className="max-w-2xl rounded-xl border-border bg-card shadow-sm">
        <CardHeader>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-full max-w-lg" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md sm:col-span-2" />
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
          <Skeleton className="h-28 w-full rounded-md" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-28 rounded-md" />
            <Skeleton className="h-10 w-36 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
