"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Plus, ShieldCheck, Trash2, Eye, Pencil, CircleDot } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/hooks/use-toast"
import type { Role } from "@/lib/rbac"
import { permissionsForRole, roleLabel } from "@/lib/rbac"
import { deleteUser, updateUserRole, seedUsers } from "@/lib/data/users"
import { deleteUserAction } from "@/app/users/actions"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { UserStatus } from "@/lib/store/users"
import { useUsers } from "@/lib/data/hooks"

export default function UsersPage() {
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all")
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all")
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const { data: allUsers = [], refetch } = useUsers()

  useEffect(() => {
    seedUsers().then(() => refetch())
  }, [refetch])

  const users = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allUsers.filter((u) => {
      const matchesQ =
        q.length === 0 ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      const matchesRole = roleFilter === "all" || u.role === roleFilter
      const effectiveStatus = u.status ?? "active"
      const matchesStatus = statusFilter === "all" || effectiveStatus === statusFilter
      return matchesQ && matchesRole && matchesStatus
    })
  }, [allUsers, search, roleFilter, statusFilter])

  const onRoleChange = async (userId: string, role: Role) => {
    try {
      const updated = await updateUserRole(userId, role)
      toast({
        title: "User updated",
        description: `${updated.name} is now ${roleLabel(updated.role)}.`,
      })
      refetch()
    } catch (e) {
      toast({
        title: "Update failed",
        description: e instanceof Error ? e.message : "Unable to update user.",
        variant: "destructive",
      })
    }
  }

  const onDeleteClick = (user: { id: string; name: string }) => {
    setDeleteTarget(user)
  }

  const onDeleteConfirm = async () => {
    if (!deleteTarget) return
    const userId = deleteTarget.id
    setDeleteTarget(null)
    try {
      if (isSupabaseConfigured()) {
        await deleteUserAction(userId)
      } else {
        await deleteUser(userId)
      }
      toast({ title: "User deleted" })
      refetch()
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Unable to delete user.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Users</h1>
          <p className="mt-1 text-muted-foreground">Create users, assign roles, and review role permissions.</p>
        </div>
        <Link href="/users/new">
          <Button className="bg-gradient-primary-button text-white hover:opacity-90 rounded-xl">
            <Plus className="mr-2 h-4 w-4" />
            Create User
          </Button>
        </Link>
      </div>

      <Card className="mb-6 bg-card border-border shadow-sm rounded-xl">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Input
              placeholder="Search by name, email, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-border bg-background rounded-lg"
            />
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as Role | "all")}>
              <SelectTrigger className="w-full border-border bg-background sm:w-[220px] rounded-lg">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="engineer">Engineer</SelectItem>
                <SelectItem value="surveyor">Surveyor</SelectItem>
                <SelectItem value="government">Government</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as UserStatus | "all")}>
              <SelectTrigger className="w-full border-border bg-background sm:w-[180px] rounded-lg">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">All users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
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
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="min-w-[220px]">
                    <Link href={`/users/${u.id}`} className="block hover:opacity-80">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{u.name}</span>
                        <span className="text-xs text-muted-foreground">{u.id}</span>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="min-w-[220px]">{u.email}</TableCell>
                  <TableCell className="min-w-[200px]">
                    <Select value={u.role} onValueChange={(v) => onRoleChange(u.id, v as Role)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="engineer">Engineer</SelectItem>
                        <SelectItem value="surveyor">Surveyor</SelectItem>
                        <SelectItem value="government">Government</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="min-w-[100px]">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        (u.status ?? "active") === "active"
                          ? "bg-muted/50 text-green-700"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <CircleDot className="mr-1 h-3 w-3" />
                      {(u.status ?? "active") === "active" ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-[140px] text-muted-foreground text-sm whitespace-nowrap">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </TableCell>
                  <TableCell className="min-w-[280px]">
                    <div className="flex flex-wrap gap-2">
                      {permissionsForRole(u.role)
                        .slice(0, 3)
                        .map((p) => (
                          <span
                            key={p}
                            className="inline-flex items-center rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-green-700"
                          >
                            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                            {p}
                          </span>
                        ))}
                      {permissionsForRole(u.role).length > 3 && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          +{permissionsForRole(u.role).length - 3} more
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/users/${u.id}`}>
                        <Button variant="ghost" size="sm" className="text-foreground hover:bg-accent">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/users/${u.id}/edit`}>
                        <Button variant="ghost" size="sm" className="text-foreground hover:bg-accent">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteClick({ id: u.id, name: u.name })}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `This will permanently delete the user "${deleteTarget.name}". This action cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                onDeleteConfirm()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

