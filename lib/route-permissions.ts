/**
 * Route-based permissions for navigation and access control
 */
import type { Role } from './rbac'

export interface RouteConfig {
  href: string
  label: string
  icon: string
  /** Roles that can access this route. If undefined, accessible to all */
  allowedRoles?: Role[]
  /** Permission required to access this route */
  permission?: string
}

export const ROUTE_CONFIG: RouteConfig[] = [
  // Core workflow routes - accessible to specific roles
  { href: '/surveys', label: 'Surveys', icon: 'FileText', allowedRoles: ['admin', 'manager', 'surveyor'] },
  { href: '/installations', label: 'Installations', icon: 'Zap', allowedRoles: ['admin', 'manager', 'engineer'] },
  { href: '/inspections', label: 'Inspections', icon: 'CheckCircle', allowedRoles: ['admin', 'manager', 'government'] },
  { href: '/projects', label: 'Projects', icon: 'FolderOpen', allowedRoles: ['admin', 'manager'] },
  { href: '/users', label: 'Users', icon: 'Users', allowedRoles: ['admin'] },
]

export const GENERAL_ROUTES: RouteConfig[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/settings', label: 'Settings', icon: 'Settings' },
  { href: '/help', label: 'Help', icon: 'HelpCircle' },
  { href: '/logout', label: 'Logout', icon: 'LogOut' },
]

/**
 * Check if a role can access a specific route
 */
export function canAccessRoute(role: Role, href: string): boolean {
  // Dashboard is always accessible
  if (href === '/dashboard') return true
  
  // Check route config
  const route = ROUTE_CONFIG.find(r => href.startsWith(r.href) || href === r.href)
  if (!route) return true // Unknown routes are accessible
  
  if (!route.allowedRoles) return true
  
  return route.allowedRoles.includes(role)
}

/**
 * Filter routes based on user role
 */
export function getAccessibleRoutes(role: Role): RouteConfig[] {
  return ROUTE_CONFIG.filter(route => {
    if (!route.allowedRoles) return true
    return route.allowedRoles.includes(role)
  })
}
