export type Role = 'admin' | 'manager' | 'engineer' | 'surveyor' | 'government'

export type Permission =
  | 'manage_users'
  | 'manage_projects'
  | 'assign_staff'
  | 'create_surveys'
  | 'read_surveys'
  | 'create_installations'
  | 'approve_surveys'
  | 'approve_installations'
  | 'perform_inspections'

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  engineer: 'Engineer',
  surveyor: 'Surveyor',
  government: 'Government',
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'manage_users',
    'manage_projects',
    'assign_staff',
    'create_surveys',
    'create_installations',
    'approve_surveys',
    'approve_installations',
    'perform_inspections',
  ],
  manager: [
    'manage_projects',
    'assign_staff',
    'approve_surveys',
    'approve_installations',
    'perform_inspections',
  ],
  engineer: ['create_installations', 'read_surveys'],
  surveyor: ['create_surveys'],
  government: ['perform_inspections'],
}

export function roleLabel(role: Role) {
  return ROLE_LABEL[role]
}

export function permissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role]
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

