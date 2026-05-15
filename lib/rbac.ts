export type Role =
  | 'admin'
  | 'manager'
  | 'store_manager'
  | 'supervisor'
  | 'engineer'
  | 'installer'
  // Legacy roles retained for backward compatibility during migration.
  | 'surveyor'
  | 'government'
  | 'state_store_officer'
  | 'district_store_incharge'
  | 'village_supervisor'

export const ROLES_LIST: Role[] = [
  'admin',
  'manager',
  'store_manager',
  'supervisor',
  'engineer',
  'installer',
  'surveyor',
  'government',
  'state_store_officer',
  'district_store_incharge',
  'village_supervisor',
]

/** Hidden from Settings → Roles UI (display:none on tabs) until workflows are shipped; still in RBAC/DB. */
export const ROLES_HIDDEN_IN_SETTINGS_UI: readonly Role[] = [
  'government',
  'state_store_officer',
  'district_store_incharge',
  'village_supervisor',
]

/** Map DB / API role strings to a valid app role for Selects and forms. */
export function normalizeAppRole(raw: string | null | undefined): Role | undefined {
  if (raw == null) return undefined
  if (typeof raw !== 'string') return undefined
  const t = raw.trim() as Role
  return ROLES_LIST.includes(t) ? t : undefined
}

export type LegacyPermission =
  | 'manage_users'
  | 'manage_projects'
  | 'assign_staff'
  | 'create_surveys'
  | 'read_surveys'
  | 'create_installations'
  | 'update_installations'
  | 'approve_surveys'
  | 'approve_installations'
  | 'perform_inspections'

export type ModuleKey =
  | "dashboard"
  | "users"
  | "projects"
  | "surveys"
  | "installations"
  | "warehouse"
  | "inspections"
  | "settings"
  | "profile"
  | "help"

export type CrudAction = "create" | "view" | "edit" | "delete"
export type ModulePermission = `${ModuleKey}.${CrudAction}`
export type Permission = LegacyPermission | ModulePermission

export const MODULES: ReadonlyArray<{ key: ModuleKey; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "users", label: "Users" },
  { key: "projects", label: "Projects" },
  { key: "surveys", label: "Surveys" },
  { key: "installations", label: "Installations" },
  { key: "warehouse", label: "Warehouse" },
  { key: "inspections", label: "Inspections" },
  { key: "settings", label: "Settings" },
  { key: "profile", label: "Profile" },
  { key: "help", label: "Help" },
]

export const CRUD_ACTIONS: ReadonlyArray<{ key: CrudAction; label: string }> = [
  { key: "create", label: "Create" },
  { key: "view", label: "View" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
]

/** Short labels for permission chips (UI). */
export const LEGACY_PERMISSION_LABEL: Record<LegacyPermission, string> = {
  manage_users: 'Manage users',
  manage_projects: 'Manage projects',
  assign_staff: 'Assign staff',
  create_surveys: 'Create surveys',
  read_surveys: 'Read surveys',
  create_installations: 'Create installations',
  update_installations: 'Update installations',
  approve_surveys: 'Approve surveys',
  approve_installations: 'Approve installations',
  perform_inspections: 'Perform inspections',
}

export function permissionLabel(p: Permission): string {
  const legacy = LEGACY_PERMISSION_LABEL[p as LegacyPermission]
  if (legacy) return legacy
  const [moduleKey, actionKey] = p.split(".")
  const moduleLabel = MODULES.find((m) => m.key === moduleKey)?.label ?? moduleKey
  const actionLabel = CRUD_ACTIONS.find((a) => a.key === actionKey)?.label ?? actionKey
  return `${moduleLabel}: ${actionLabel}`
}

/** Full capability set — every role receives these until per-role/module toggles are implemented. */
export const ALL_PERMISSIONS: Permission[] = [
  ...Object.keys(LEGACY_PERMISSION_LABEL) as LegacyPermission[],
  ...MODULES.flatMap((moduleDef) =>
    CRUD_ACTIONS.map((actionDef) => `${moduleDef.key}.${actionDef.key}` as ModulePermission),
  ),
]

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Superadmin',
  manager: 'Manager',
  store_manager: 'Store Manager',
  supervisor: 'Supervisor',
  engineer: 'Engineer',
  installer: 'Installer',
  surveyor: 'Surveyor',
  government: 'Government',
  state_store_officer: 'State Store Officer',
  district_store_incharge: 'District Store Incharge',
  village_supervisor: 'Village Supervisor',
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL_PERMISSIONS,
  manager: [
    "dashboard.view",
    "profile.view",
    "help.view",
    "projects.create",
    "projects.view",
    "projects.edit",
    "surveys.create",
    "surveys.view",
    "surveys.edit",
    "installations.create",
    "installations.view",
    "installations.edit",
    "warehouse.view",
    "inspections.view",
    "inspections.edit",
    'manage_projects',
    'assign_staff',
    'create_surveys',
    'read_surveys',
    'approve_surveys',
    'approve_installations',
  ],
  store_manager: [
    "dashboard.view",
    "profile.view",
    "help.view",
    "warehouse.create",
    "warehouse.view",
    "warehouse.edit",
    "installations.view",
    "surveys.view",
    'read_surveys',
    'update_installations',
    'approve_installations',
  ],
  supervisor: [
    "dashboard.view",
    "profile.view",
    "help.view",
    "surveys.view",
    "surveys.edit",
    "warehouse.create",
    "warehouse.view",
    "warehouse.edit",
    "installations.view",
    "installations.edit",
    'read_surveys',
    'assign_staff',
    'approve_surveys',
    'update_installations',
  ],
  engineer: [
    "dashboard.view",
    "profile.view",
    "help.view",
    "surveys.view",
    "surveys.edit",
    "installations.create",
    "installations.view",
    "installations.edit",
    'read_surveys',
    'create_installations',
    'assign_staff',
  ],
  installer: [
    "dashboard.view",
    "profile.view",
    "help.view",
    "installations.create",
    "installations.view",
    "installations.edit",
    "warehouse.view",
    "surveys.view",
    'create_installations',
    'read_surveys',
    'update_installations',
  ],
  // Compatibility defaults for legacy roles.
  surveyor: ['surveys.create', 'surveys.view', 'create_surveys', 'read_surveys'],
  government: ['inspections.view', 'inspections.edit', 'read_surveys', 'perform_inspections', 'approve_installations'],
  state_store_officer: ['warehouse.view', 'warehouse.edit', 'read_surveys', 'approve_installations'],
  district_store_incharge: ['warehouse.view', 'warehouse.edit', 'read_surveys', 'update_installations', 'approve_installations'],
  village_supervisor: ['surveys.view', 'warehouse.view', 'read_surveys', 'assign_staff', 'update_installations'],
}

export function roleLabel(role: Role | string) {
  if (role != null && typeof role === "string" && role in ROLE_LABEL) {
    return ROLE_LABEL[role as Role]
  }
  return typeof role === "string" && role.trim() ? role : "Unknown role"
}

export function permissionsForRole(role: Role): Permission[] {
  const p = ROLE_PERMISSIONS[role]
  return Array.isArray(p) ? p : []
}

export function hasPermission(role: Role, permission: Permission): boolean {
  const p = ROLE_PERMISSIONS[role]
  return Array.isArray(p) && p.includes(permission)
}

export function modulePermission(moduleKey: ModuleKey, action: CrudAction): ModulePermission {
  return `${moduleKey}.${action}`
}

/** Use merged DB map when available (see RoleProvider). Always returns an array (never undefined). */
export function permissionsForRoleFromMap(
  role: Role | string | undefined,
  map: Record<Role, Permission[]> | null,
): Permission[] {
  const safeStatic = (r: string | undefined): Permission[] => {
    if (r == null || !(r in ROLE_PERMISSIONS)) return []
    const v = ROLE_PERMISSIONS[r as Role]
    return Array.isArray(v) ? v : []
  }

  if (!map) return safeStatic(role)

  const r = role as Role
  const fromMap = map[r]
  if (Array.isArray(fromMap)) return fromMap

  return safeStatic(role)
}

export function hasPermissionFromMap(role: Role, permission: Permission, map: Record<Role, Permission[]> | null): boolean {
  return permissionsForRoleFromMap(role, map).includes(permission)
}

export function hasAnyPermissionFromMap(
  role: Role,
  permissions: Permission[],
  map: Record<Role, Permission[]> | null,
): boolean {
  if (permissions.length === 0) return true
  return permissions.some((p) => hasPermissionFromMap(role, p, map))
}

