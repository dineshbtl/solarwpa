"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Save, Shield } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { useRole } from "@/contexts/role-context"
import type { Permission, Role } from "@/lib/rbac"
import {
  ALL_PERMISSIONS,
  CRUD_ACTIONS,
  MODULES,
  ROLE_LABEL,
  ROLES_HIDDEN_IN_SETTINGS_UI,
  ROLES_LIST,
  ROLE_PERMISSIONS,
  modulePermission,
  permissionLabel,
} from "@/lib/rbac"
import { cn } from "@/lib/utils"
import { listRolePermissionsFromSupabase } from "@/lib/supabase/role-permissions"
import { saveRolePermissionsMapAction } from "@/app/settings/roles/actions"

function cloneMap(map: Record<Role, Permission[]>): Record<Role, Permission[]> {
  const out = {} as Record<Role, Permission[]>
  for (const r of ROLES_LIST) {
    out[r] = [...(map[r] ?? [])]
  }
  return out
}

export default function SettingsRolesPage() {
  const { refreshPermissionMap } = useRole()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<Role, Permission[]> | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadError(null)
      try {
        const map = await listRolePermissionsFromSupabase()
        if (!cancelled) setDraft(map)
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not load role permissions."
        if (!cancelled) {
          setLoadError(msg)
          setDraft(cloneMap(ROLE_PERMISSIONS))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const togglePermission = useCallback((role: Role, permission: Permission, checked: boolean) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneMap(prev)
      const set = new Set(next[role])
      if (checked) set.add(permission)
      else set.delete(permission)
      next[role] = Array.from(set)
      return next
    })
  }, [])

  const selectAllForRole = useCallback((role: Role) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneMap(prev)
      next[role] = [...ALL_PERMISSIONS]
      return next
    })
  }, [])

  const clearAllForRole = useCallback((role: Role) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = cloneMap(prev)
      next[role] = []
      return next
    })
  }, [])

  const resetDefaults = useCallback(() => {
    setDraft(cloneMap(ROLE_PERMISSIONS))
    toast({
      title: "Reset to code defaults",
      description: "Review each tab and click Save to persist.",
    })
  }, [])

  const onSave = async () => {
    if (!draft) return
    setSaving(true)
    try {
      await saveRolePermissionsMapAction(draft)
      await refreshPermissionMap()
      toast({
        title: "Roles saved",
        description: "Permission changes apply across the app.",
      })
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const defaultTab = ROLES_LIST[0]

  const dirtyHint = useMemo(() => {
    if (!draft || loading) return null
    return "Changes are kept locally until you save."
  }, [draft, loading])

  if (loading || !draft) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 py-10">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading role permissions…</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-4">
        <Link
          href="/settings"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Settings
        </Link>
        <p className="mt-2 text-xs text-muted-foreground">
          Administration · Users & permissions · Roles
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-green-700" />
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Roles</h1>
          </div>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Define what each role can do (similar to Strapi&apos;s Settings → Users & permissions → Roles).
            Users keep a single role on their profile; effective access follows the permissions you enable here.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Apply migration{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">00012_role_permissions.sql</code>{" "}
            if saving fails (missing table).
          </p>
          {loadError && (
            <p className="mt-2 text-sm text-destructive">
              Load warning: {loadError} — showing defaults until the table exists or access is fixed.
            </p>
          )}
          {dirtyHint && <p className="mt-2 text-xs text-muted-foreground">{dirtyHint}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/users">Users</Link>
          </Button>
          <Button variant="outline" type="button" onClick={resetDefaults}>
            Reset draft to defaults
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void onSave()}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save all roles
          </Button>
        </div>
      </div>

      <Card className="rounded-xl border-border shadow-sm">
        <CardHeader>
          <CardTitle>Roles & permissions</CardTitle>
          <CardDescription>
            Pick a role tab, toggle permissions, then save. All roles are written to the database together.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={defaultTab} className="w-full">
            <div className="mb-4 space-y-2">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-foreground">Role</p>
                <p className="text-xs text-muted-foreground">
                  Pick a role to edit CRUD and legacy permissions; save applies all roles.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-2 shadow-inner">
                <div className="-mx-0.5 overflow-x-auto px-0.5 pb-1 sm:mx-0 sm:overflow-visible sm:pb-0">
                  <TabsList className="inline-flex h-auto min-h-11 w-max min-w-full flex-nowrap items-center justify-start gap-2 bg-transparent p-1 sm:flex-wrap sm:justify-center lg:justify-start">
                    {ROLES_LIST.map((r) => (
                      <TabsTrigger
                        key={r}
                        value={r}
                        className={cn(
                          "flex-none shrink-0 rounded-lg border border-transparent px-3.5 py-2 text-sm font-medium capitalize shadow-none transition-[color,box-shadow,background,border-color]",
                          "hover:bg-background/80 hover:text-foreground",
                          "data-[state=active]:border-primary/25 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                          ROLES_HIDDEN_IN_SETTINGS_UI.includes(r) && "hidden",
                        )}
                      >
                        {ROLE_LABEL[r]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </div>
            </div>
            {ROLES_LIST.map((role) => (
              <TabsContent
                key={role}
                value={role}
                className={cn(
                  "mt-6 space-y-4",
                  ROLES_HIDDEN_IN_SETTINGS_UI.includes(role) && "hidden",
                )}
              >
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => selectAllForRole(role)}>
                    Select all
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => clearAllForRole(role)}>
                    Clear all
                  </Button>
                </div>
                <div className="space-y-4">
                  <div className="rounded-lg border border-border">
                    <div className="border-b bg-muted/30 px-4 py-2 text-sm font-medium text-foreground">
                      Module permissions (Strapi-style CRUD)
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Module</th>
                            {CRUD_ACTIONS.map((action) => (
                              <th key={action.key} className="px-3 py-2 text-left font-medium text-muted-foreground">
                                {action.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {MODULES.map((moduleDef) => (
                            <tr key={moduleDef.key} className="border-b last:border-0">
                              <td className="px-3 py-2 font-medium text-foreground">{moduleDef.label}</td>
                              {CRUD_ACTIONS.map((action) => {
                                const permission = modulePermission(moduleDef.key, action.key)
                                const id = `${role}-${permission}`
                                const checked = draft[role].includes(permission)
                                return (
                                  <td key={permission} className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        id={id}
                                        checked={checked}
                                        onCheckedChange={(v) => togglePermission(role, permission, v === true)}
                                      />
                                      <Label htmlFor={id} className="cursor-pointer text-xs text-muted-foreground">
                                        {action.label}
                                      </Label>
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border">
                    <div className="border-b bg-muted/30 px-4 py-2 text-sm font-medium text-foreground">
                      Legacy workflow permissions
                    </div>
                    <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
                      {ALL_PERMISSIONS.filter((permission) => !permission.includes(".")).map((permission) => {
                        const id = `${role}-${permission}`
                        const checked = draft[role].includes(permission)
                        return (
                          <div
                            key={permission}
                            className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3"
                          >
                            <Checkbox
                              id={id}
                              checked={checked}
                              onCheckedChange={(v) => togglePermission(role, permission, v === true)}
                            />
                            <Label htmlFor={id} className="cursor-pointer text-sm font-normal leading-snug">
                              {permissionLabel(permission)}
                              <span className="mt-0.5 block text-xs text-muted-foreground">{permission}</span>
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
