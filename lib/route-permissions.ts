/**
 * Route-based permissions for navigation and access control
 */
import type { Role } from './rbac'
import { hasAnyPermissionFromMap, hasPermissionFromMap, type ModuleKey, type Permission } from './rbac'

/** Every role can reach every module for now — trim `allowedRoles` per route later to hide modules. */
export const ALL_APP_ROLES: Role[] = [
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

/** Use with hasAnyPermissionFromMap for buttons/links matching create-route rules */
export const INSTALLATIONS_CREATE_PERMISSIONS: Permission[] = ['installations.create', 'create_installations']

export interface RouteConfig {
  href: string
  label: string
  icon: string
  moduleKey?: ModuleKey
  /** Roles that can access this route. If undefined, accessible to all */
  allowedRoles?: Role[]
  /** Permission required to access this route (ignored if `anyOf` is set) */
  permission?: Permission
  /** Any of these permissions grants access (OR); used for legacy + module duplicates on create flows */
  anyOf?: Permission[]
  /** When false, excluded from sidebar nav but still used by route guard */
  includeInSidebar?: boolean
}

export const ROUTE_CONFIG: RouteConfig[] = [
  {
    href: '/assignments',
    label: 'Assignments',
    icon: 'UserCog',
    permission: 'assign_staff',
  },
  // Create flows must appear before parent paths — first match wins in canAccessRoute.
  {
    href: '/installations/new',
    label: 'New Installation',
    icon: 'Zap',
    moduleKey: 'installations',
    anyOf: INSTALLATIONS_CREATE_PERMISSIONS,
    includeInSidebar: false,
  },
  {
    href: '/projects/new',
    label: 'New Project',
    icon: 'FolderOpen',
    moduleKey: 'projects',
    anyOf: ['projects.create', 'manage_projects'],
    includeInSidebar: false,
  },
  {
    href: '/surveys/new',
    label: 'New Survey',
    icon: 'FileText',
    moduleKey: 'surveys',
    anyOf: ['surveys.create', 'create_surveys'],
    includeInSidebar: false,
  },
  {
    href: '/users/new',
    label: 'New User',
    icon: 'Users',
    moduleKey: 'users',
    anyOf: ['users.create', 'manage_users'],
    includeInSidebar: false,
  },
  {
    href: '/warehouse/villages/new',
    label: 'New Village',
    icon: 'Package',
    moduleKey: 'warehouse',
    anyOf: ['warehouse.create'],
    includeInSidebar: false,
  },
  {
    href: '/warehouse/inward/new',
    label: 'New Inward',
    icon: 'Package',
    moduleKey: 'warehouse',
    anyOf: ['warehouse.create'],
    includeInSidebar: false,
  },
  {
    href: '/warehouse/dispatch/new',
    label: 'New Dispatch',
    icon: 'Package',
    moduleKey: 'warehouse',
    anyOf: ['warehouse.create'],
    includeInSidebar: false,
  },
  {
    href: '/warehouse/returns/new',
    label: 'New Return',
    icon: 'Package',
    moduleKey: 'warehouse',
    anyOf: ['warehouse.create'],
    includeInSidebar: false,
  },
  {
    href: '/warehouse/allotments/new',
    label: 'New Allotment',
    icon: 'Package',
    moduleKey: 'warehouse',
    anyOf: ['warehouse.create'],
    includeInSidebar: false,
  },
  { href: '/surveys', label: 'Surveys', icon: 'FileText', moduleKey: 'surveys', permission: 'surveys.view' },
  { href: '/installations', label: 'Installations', icon: 'Zap', moduleKey: 'installations', permission: 'installations.view' },
  { href: '/warehouse', label: 'Warehouse', icon: 'Package', moduleKey: 'warehouse', permission: 'warehouse.view' },
  { href: '/inspections', label: 'Inspections', icon: 'CheckCircle', moduleKey: 'inspections', permission: 'inspections.view' },
  { href: '/projects', label: 'Projects', icon: 'FolderOpen', moduleKey: 'projects', permission: 'projects.view' },
  { href: '/users', label: 'Users', icon: 'Users', moduleKey: 'users', permission: 'users.view' },
]

export const GENERAL_ROUTES: RouteConfig[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', moduleKey: 'dashboard', permission: 'dashboard.view' },
  { href: '/profile', label: 'Profile', icon: 'User', moduleKey: 'profile', permission: 'profile.view' },
  { href: '/settings', label: 'Settings', icon: 'Settings', moduleKey: 'settings', permission: 'settings.view' },
  { href: '/help', label: 'Help', icon: 'HelpCircle', moduleKey: 'help', permission: 'help.view' },
  { href: '/logout', label: 'Logout', icon: 'LogOut' },
]

/**
 * Check if a role can access a specific route
 */
export function canAccessRoute(
  role: Role,
  href: string,
  permissionMap: Record<Role, Permission[]> | null = null,
): boolean {
  
  // Check route config
  const route = ROUTE_CONFIG.find(r => href.startsWith(r.href) || href === r.href)
  const generalRoute = GENERAL_ROUTES.find((r) => href.startsWith(r.href) || href === r.href)
  const targetRoute = route ?? generalRoute
  if (!targetRoute) return false // Deny unknown app routes by default

  if (targetRoute.anyOf && targetRoute.anyOf.length > 0) {
    if (!hasAnyPermissionFromMap(role, targetRoute.anyOf, permissionMap)) {
      return false
    }
  } else if (targetRoute.permission && !hasPermissionFromMap(role, targetRoute.permission, permissionMap)) {
    return false
  }

  if (!targetRoute.allowedRoles) return true

  return targetRoute.allowedRoles.includes(role)
}

/**
 * Filter routes based on user role
 */
export function getAccessibleRoutes(
  role: Role,
  permissionMap: Record<Role, Permission[]> | null = null,
): RouteConfig[] {
  return ROUTE_CONFIG.filter(route => {
    if (route.includeInSidebar === false) return false
    if (route.anyOf && route.anyOf.length > 0) {
      if (!hasAnyPermissionFromMap(role, route.anyOf, permissionMap)) return false
    } else if (route.permission && !hasPermissionFromMap(role, route.permission, permissionMap)) return false
    if (!route.allowedRoles) return true
    return route.allowedRoles.includes(role)
  })
}
