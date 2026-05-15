/**
 * Persisted role → permissions mapping (Supabase table role_permissions).
 */
import type { Permission, Role } from '@/lib/rbac'
import { ALL_PERMISSIONS, ROLE_PERMISSIONS, ROLES_LIST } from '@/lib/rbac'
import { getSupabaseAdminClient, getSupabaseBrowserClient } from '@/lib/supabase/client'

// Bypass Supabase v2 complex generic type inference to prevent `never` types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function q(client: any): { from: (table: string) => any } {
  return client as unknown as { from: (table: string) => any }
}


function isPermission(p: string): p is Permission {
  return ALL_PERMISSIONS.includes(p as Permission)
}

/** PostgREST: missing relation / not exposed (e.g. migration not applied on prod). */
function isRolePermissionsUnavailable(error: {
  message?: string
  code?: string
  details?: string
  hint?: string
}): boolean {
  const code = error.code ?? ''
  const msg = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('role_permissions') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist')
  )
}

export function mergeRolePermissionsFromRows(
  rows: { role: string; permissions: string[] | null }[],
): Record<Role, Permission[]> {
  const map = {} as Record<Role, Permission[]>
  const rolesWithDbRows = new Set(
    rows.map((r) => r.role).filter((r) => ROLES_LIST.includes(r as Role)),
  )
  for (const r of ROLES_LIST) {
    // Use code defaults only if there's no DB row for this role
    if (!rolesWithDbRows.has(r)) {
      map[r] = [...ROLE_PERMISSIONS[r]]
    }
  }
  for (const row of rows) {
    if (!ROLES_LIST.includes(row.role as Role)) continue
    const role = row.role as Role
    const perms = (row.permissions ?? []).filter(isPermission)
    // Use exactly what's stored in the DB for this role (allows removing permissions via UI)
    map[role] = perms
  }
  return map
}

export async function listRolePermissionsFromSupabase(): Promise<Record<Role, Permission[]>> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await q(supabase).from('role_permissions').select('role, permissions')
  if (error) {
    if (isRolePermissionsUnavailable(error)) {
      return mergeRolePermissionsFromRows([])
    }
    throw error
  }
  return mergeRolePermissionsFromRows(data ?? [])
}

export async function upsertAllRolePermissionsInSupabase(map: Record<Role, Permission[]>): Promise<void> {
  const admin = getSupabaseAdminClient()
  for (const role of ROLES_LIST) {
    const permissions = map[role] ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await q(admin).from('role_permissions').upsert({ role, permissions } as any, { onConflict: 'role' })
    if (error) throw error
  }
}
