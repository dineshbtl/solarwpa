import { modulePermission, normalizeAppRole, type CrudAction, type ModuleKey, type Permission, type Role } from "@/lib/rbac"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { actorHasAnyPermission, getRolePermissionMapForAuthz } from "@/lib/server/role-permissions-map"

export type AuthenticatedActor = {
  userId: string
  role: Role
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization")
  if (!header) return null
  const [scheme, token] = header.split(" ")
  if (!scheme || !token) return null
  if (scheme.toLowerCase() !== "bearer") return null
  return token.trim()
}

/** Returns the signed-in profile when `Authorization: Bearer` is valid; otherwise null (no throw). */
export async function tryResolveAuthenticatedActor(request: Request): Promise<AuthenticatedActor | null> {
  try {
    return await resolveAuthenticatedActor(request)
  } catch {
    return null
  }
}

export async function resolveAuthenticatedActor(request: Request): Promise<AuthenticatedActor> {
  const token = getBearerToken(request)
  if (!token) {
    throw new Error("Unauthorized: missing bearer token")
  }

  const supabaseAuth = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(token)
  if (authError || !user?.id) {
    throw new Error("Unauthorized: invalid auth token")
  }

  const supabaseAdmin = createSupabaseServerClient({ useServiceRole: true })
  const { data: profile, error: profileError } = await (supabaseAdmin as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: { id?: string; role?: string | null } | null; error: unknown }>
        }
      }
    }
  })
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (profileError) throw new Error("Unauthorized: failed to load profile")
  if (!profile?.id || !profile?.role) throw new Error("Unauthorized: role not found")

  const normalizedRole = normalizeAppRole(String(profile.role))
  if (!normalizedRole) throw new Error("Unauthorized: invalid role")

  return { userId: profile.id, role: normalizedRole }
}

export async function assertRoleAllowed(request: Request, allowedRoles: Role[]): Promise<AuthenticatedActor> {
  const actor = await resolveAuthenticatedActor(request)
  if (!allowedRoles.includes(actor.role)) {
    throw new Error("Forbidden: role not allowed")
  }
  return actor
}

export async function assertAnyPermission(
  request: Request,
  permissions: Permission[],
): Promise<AuthenticatedActor> {
  const actor = await resolveAuthenticatedActor(request)
  const map = await getRolePermissionMapForAuthz()
  const allowed = actorHasAnyPermission(actor, permissions, map)
  if (!allowed) {
    throw new Error("Forbidden: permission denied")
  }
  return actor
}

export async function assertModuleAction(
  request: Request,
  moduleKey: ModuleKey,
  action: CrudAction,
): Promise<AuthenticatedActor> {
  const permission = modulePermission(moduleKey, action) as Permission
  return assertAnyPermission(request, [permission])
}
