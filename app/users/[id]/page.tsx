"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Pencil, ShieldCheck, CircleDot, KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { User } from "@/lib/store/users"
import { useUser } from "@/lib/data/hooks"
import { permissionLabel, roleLabel } from "@/lib/rbac"
import { useRole } from "@/contexts/role-context"
import { UserDetailPageSkeleton } from "@/components/users-loading-skeletons"

export default function UserDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? null
  const { data: user, loading, error } = useUser(id)
  const { resolvePermissionsForRole } = useRole()

  if (!id) {
    return (
      <div className="p-6 sm:p-8">
        <p className="text-muted-foreground">Invalid user.</p>
        <Link href="/users">
          <Button variant="outline" className="mt-4">Back to Users</Button>
        </Link>
      </div>
    )
  }

  if (loading) {
    return <UserDetailPageSkeleton />
  }

  if (error) {
    return (
      <div className="p-6 sm:p-8">
        <p className="text-destructive">Could not load user. Please refresh.</p>
        <Link href="/users">
          <Button variant="outline" className="mt-4">Back to Users</Button>
        </Link>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-6 sm:p-8">
        <p className="text-muted-foreground">User not found.</p>
        <Link href="/users">
          <Button variant="outline" className="mt-4">Back to Users</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <Link href="/users">
          <Button variant="ghost" className="text-foreground hover:bg-accent">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Button>
        </Link>
      </div>

      <Card className="max-w-2xl border-border bg-card shadow-sm rounded-xl">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl text-foreground">{user.name}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">User ID: {user.id}</p>
              <span
                className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                  (user.status ?? "active") === "active"
                    ? "bg-muted/50 text-green-700"
                    : "bg-muted text-muted-foreground600"
                }`}
              >
                <CircleDot className="mr-1 h-3.5 w-3.5" />
                {(user.status ?? "active") === "active" ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="flex gap-2">
              <Link href={`/users/${user.id}/edit#password-section`}>
                <Button variant="outline" size="sm" className="border-solar bg-transparent">
                  <KeyRound className="mr-2 h-4 w-4" />
                  Change Password
                </Button>
              </Link>
              <Link href={`/users/${user.id}/edit`}>
                <Button variant="outline" size="sm" className="border-solar bg-transparent">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Full name</p>
              <p className="mt-1 text-foreground">{user.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="mt-1 text-foreground">{user.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Password</p>
              <p className="mt-1 text-foreground">{user.password ? "••••••••" : "—"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Role</p>
              <p className="mt-1 text-foreground">{roleLabel(user.role)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Phone number</p>
              <p className="mt-1 text-foreground">{user.phone || "—"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Aadhaar number</p>
              <p className="mt-1 text-foreground">{user.aadharNo || "—"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">City</p>
              <p className="mt-1 text-foreground">{user.city || "—"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">State</p>
              <p className="mt-1 text-foreground">{user.state || "—"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">District</p>
              <p className="mt-1 text-foreground">{user.district || "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">Full address</p>
              <p className="mt-1 text-foreground whitespace-pre-wrap">{user.fullAddress || "—"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created</p>
              <p className="mt-1 text-foreground">
                {user.createdAt ? new Date(user.createdAt).toLocaleString() : "—"}
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Permissions</p>
            <div className="flex flex-wrap gap-2">
              {resolvePermissionsForRole(user.role).map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-green-700"
                >
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                  {permissionLabel(p)}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
