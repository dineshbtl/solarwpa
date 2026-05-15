'use server'

import type { Permission, Role } from '@/lib/rbac'
import { ALL_PERMISSIONS, ROLES_LIST } from '@/lib/rbac'
import { invalidateRolePermissionMapCache } from '@/lib/server/role-permissions-map'
import { assertSupabaseConfigured } from '@/lib/supabase/config'
import { upsertAllRolePermissionsInSupabase } from '@/lib/supabase/role-permissions'

/** Keep module CRUD and legacy installation workflow keys in sync (matches API OR checks). */
function syncInstallationPermissionPairs(perms: Permission[]): Permission[] {
  const set = new Set(perms)
  const wantsCreate = set.has('installations.create') || set.has('create_installations')
  if (wantsCreate) {
    set.add('installations.create')
    set.add('create_installations')
  } else {
    set.delete('installations.create')
    set.delete('create_installations')
  }
  const wantsEdit = set.has('installations.edit') || set.has('update_installations')
  if (wantsEdit) {
    set.add('installations.edit')
    set.add('update_installations')
  } else {
    set.delete('installations.edit')
    set.delete('update_installations')
  }
  return Array.from(set)
}

function sanitizeMap(map: Record<Role, Permission[]>): Record<Role, Permission[]> {
  const out = {} as Record<Role, Permission[]>
  for (const role of ROLES_LIST) {
    const raw = map[role] ?? []
    const filtered = raw.filter((p) => ALL_PERMISSIONS.includes(p))
    out[role] = syncInstallationPermissionPairs(filtered)
  }
  return out
}

export async function saveRolePermissionsMapAction(map: Record<Role, Permission[]>): Promise<void> {
  assertSupabaseConfigured()
  await upsertAllRolePermissionsInSupabase(sanitizeMap(map))
  invalidateRolePermissionMapCache()
}
