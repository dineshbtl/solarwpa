import { z } from 'zod'

import type { Role } from '@/lib/rbac'
import { readLocalStorageJSON, writeLocalStorageJSON } from '@/lib/store/storage'

export type UserStatus = 'active' | 'inactive'

export type User = {
  id: string
  name: string
  email: string
  password?: string
  role: Role
  createdAt: string
  status?: UserStatus
  phone?: string
  aadharNo?: string
  city?: string
  state?: string
  district?: string
  fullAddress?: string
}

const STORAGE_KEY = 'solarepc.users.v1'

const RoleSchema = z.enum(['admin', 'manager', 'engineer', 'surveyor', 'government'])
const StatusSchema = z.enum(['active', 'inactive'])

export const UserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().email('Enter a valid email').max(120),
  password: z.string().optional(),
  role: RoleSchema,
  createdAt: z.string().min(1),
  status: StatusSchema.optional(),
  phone: z.string().max(20).optional(),
  aadharNo: z.string().max(12).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  district: z.string().max(80).optional(),
  fullAddress: z.string().max(500).optional(),
})

const roleOptions = ['admin', 'manager', 'engineer', 'surveyor', 'government'] as const
export const CreateUserSchema = z.object({
  name: z.string().min(2, 'Full name must be at least 2 characters').max(80),
  email: z.string().email('Enter a valid email').max(120),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  role: z.string().refine((v) => roleOptions.includes(v as (typeof roleOptions)[number]), { message: 'Please select a role' }),
  status: StatusSchema.default('active'),
  phone: z.string().max(20).optional().or(z.literal('')),
  aadharNo: z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits').optional().or(z.literal('')),
  city: z.string().max(80).optional().or(z.literal('')),
  state: z.string().max(80).optional().or(z.literal('')),
  district: z.string().max(80).optional().or(z.literal('')),
  fullAddress: z.string().max(500).optional().or(z.literal('')),
})

export const UpdateUserSchema = z.object({
  name: z.string().min(2, 'Full name must be at least 2 characters').max(80).optional(),
  email: z.string().email('Enter a valid email').max(120).optional(),
  password: z.union([z.string().min(6, 'Password must be at least 6 characters').max(100), z.literal('')]).optional(),
  role: RoleSchema.optional(),
  status: StatusSchema.optional(),
  phone: z.string().max(20).optional().or(z.literal('')),
  aadharNo: z.string().regex(/^\d{12}$/, 'Aadhaar must be 12 digits').optional().or(z.literal('')),
  city: z.string().max(80).optional().or(z.literal('')),
  state: z.string().max(80).optional().or(z.literal('')),
  district: z.string().max(80).optional().or(z.literal('')),
  fullAddress: z.string().max(500).optional().or(z.literal('')),
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>

function nowISO() {
  return new Date().toISOString()
}

function genUserId(existingCount: number) {
  const n = (existingCount + 1).toString().padStart(3, '0')
  return `USR-${n}`
}

export function seedUsers(): User[] {
  const existing = readLocalStorageJSON<unknown>(STORAGE_KEY)
  if (existing) return listUsers()

  const seeded: User[] = [
    { id: 'USR-001', name: 'Admin User', email: 'admin@solarepc.com', role: 'admin', createdAt: nowISO() },
    { id: 'USR-002', name: 'Priya Singh', email: 'priya@solarepc.com', role: 'manager', createdAt: nowISO() },
    { id: 'USR-003', name: 'Amit Sharma', email: 'amit@solarepc.com', role: 'surveyor', createdAt: nowISO() },
    { id: 'USR-004', name: 'Rahul Verma', email: 'rahul@solarepc.com', role: 'engineer', createdAt: nowISO() },
    { id: 'USR-005', name: 'Gov Inspector', email: 'gov@solarepc.com', role: 'government', createdAt: nowISO() },
  ]
  writeLocalStorageJSON(STORAGE_KEY, seeded)
  return seeded
}

export function listUsers(): User[] {
  const raw = readLocalStorageJSON<unknown>(STORAGE_KEY)
  const parsed = z.array(UserSchema).safeParse(raw)
  if (!parsed.success) {
    writeLocalStorageJSON<User[]>(STORAGE_KEY, [])
    return []
  }
  return parsed.data
}

export function getUserById(id: string): User | undefined {
  return listUsers().find((u) => u.id === id)
}

export function createUser(input: CreateUserInput): User {
  const validated = CreateUserSchema.parse(input)
  const users = listUsers()

  const emailTaken = users.some((u) => u.email.toLowerCase() === validated.email.toLowerCase())
  if (emailTaken) {
    throw new Error('Email already exists')
  }

  const user: User = {
    id: genUserId(users.length),
    createdAt: nowISO(),
    name: validated.name,
    email: validated.email,
    password: validated.password,
    role: validated.role,
    status: validated.status ?? 'active',
    phone: validated.phone?.trim() || undefined,
    aadharNo: validated.aadharNo?.trim() || undefined,
    city: validated.city?.trim() || undefined,
    state: validated.state?.trim() || undefined,
    district: validated.district?.trim() || undefined,
    fullAddress: validated.fullAddress?.trim() || undefined,
  }

  const next = [user, ...users]
  writeLocalStorageJSON(STORAGE_KEY, next)
  return user
}

export function updateUser(userId: string, input: UpdateUserInput): User {
  const parsed = UpdateUserSchema.safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.errors.map((e) => e.message).join('; '))
  const users = listUsers()
  const idx = users.findIndex((u) => u.id === userId)
  if (idx === -1) throw new Error('User not found')

  const prev = users[idx]
  const nextUser: User = {
    ...prev,
    ...(parsed.data.name !== undefined && { name: parsed.data.name }),
    ...(parsed.data.email !== undefined && { email: parsed.data.email }),
    ...(parsed.data.role !== undefined && { role: parsed.data.role }),
    ...(parsed.data.password !== undefined && parsed.data.password !== '' && { password: parsed.data.password }),
    ...(parsed.data.status !== undefined && { status: parsed.data.status }),
    ...(parsed.data.phone !== undefined && { phone: parsed.data.phone?.trim() || undefined }),
    ...(parsed.data.aadharNo !== undefined && { aadharNo: parsed.data.aadharNo?.trim() || undefined }),
    ...(parsed.data.city !== undefined && { city: parsed.data.city?.trim() || undefined }),
    ...(parsed.data.state !== undefined && { state: parsed.data.state?.trim() || undefined }),
    ...(parsed.data.district !== undefined && { district: parsed.data.district?.trim() || undefined }),
    ...(parsed.data.fullAddress !== undefined && { fullAddress: parsed.data.fullAddress?.trim() || undefined }),
  }

  if (parsed.data.email !== undefined && parsed.data.email !== prev.email) {
    const emailTaken = users.some((u) => u.id !== userId && u.email.toLowerCase() === parsed.data!.email!.toLowerCase())
    if (emailTaken) throw new Error('Email already exists')
  }

  const next = [...users]
  next[idx] = nextUser
  writeLocalStorageJSON(STORAGE_KEY, next)
  return nextUser
}

export function updateUserRole(userId: string, role: Role): User {
  const users = listUsers()
  const idx = users.findIndex((u) => u.id === userId)
  if (idx === -1) throw new Error('User not found')

  const nextUser: User = { ...users[idx], role }
  const next = [...users]
  next[idx] = nextUser
  writeLocalStorageJSON(STORAGE_KEY, next)
  return nextUser
}

export function deleteUser(userId: string) {
  const users = listUsers()
  const next = users.filter((u) => u.id !== userId)
  writeLocalStorageJSON(STORAGE_KEY, next)
}

