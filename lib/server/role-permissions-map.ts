/**
 * Server-only: load merged role → permissions map from Supabase (same merge rules as the browser).
 */
import type { Permission, Role } from "@/lib/rbac"
import { hasPermissionFromMap } from "@/lib/rbac"
import { mergeRolePermissionsFromRows } from "@/lib/supabase/role-permissions"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function q(client: any): { from: (table: string) => any } {
  return client as unknown as { from: (table: string) => any }
}

function isRolePermissionsUnavailable(error: {
  message?: string
  code?: string
  details?: string
  hint?: string
}): boolean {
  const code = error.code ?? ""
  const msg = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase()
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    msg.includes("could not find the table") ||
    msg.includes("role_permissions") ||
    msg.includes("schema cache") ||
    msg.includes("does not exist")
  )
}

let cache: { map: Record<Role, Permission[]>; expiresAt: number } | null = null
const TTL_MS = 60_000

async function loadRolePermissionMapServer(): Promise<Record<Role, Permission[]>> {
  const supabase = createSupabaseServerClient({ useServiceRole: true })
  const { data, error } = await q(supabase).from("role_permissions").select("role, permissions")
  if (error) {
    if (isRolePermissionsUnavailable(error)) {
      return mergeRolePermissionsFromRows([])
    }
    throw error
  }
  return mergeRolePermissionsFromRows(data ?? [])
}

/** Merged map for API authorization; short TTL to avoid per-request DB hits while staying fresh after saves. */
export async function getRolePermissionMapForAuthz(): Promise<Record<Role, Permission[]>> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) {
    return cache.map
  }
  const map = await loadRolePermissionMapServer()
  cache = { map, expiresAt: now + TTL_MS }
  return map
}

/** For tests or admin flows that need immediate consistency after permission writes. */
export function invalidateRolePermissionMapCache(): void {
  cache = null
}

export function actorHasAnyPermission(
  actor: { role: Role },
  permissions: Permission[],
  map: Record<Role, Permission[]>,
): boolean {
  return permissions.some((p) => hasPermissionFromMap(actor.role, p, map))
}
