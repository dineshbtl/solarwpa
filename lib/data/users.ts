/**
 * Unified data layer: Supabase (profiles) when configured, else localStorage store.
 */
import type { Role } from '@/lib/rbac'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import * as store from '@/lib/store/users'
import * as supabase from '@/lib/supabase/users'
import type { User, CreateUserInput, UpdateUserInput } from '@/lib/store/users'

export type { User, CreateUserInput, UpdateUserInput }

export async function listUsers(): Promise<User[]> {
  if (isSupabaseConfigured()) return supabase.listUsersFromSupabase()
  return Promise.resolve(store.listUsers())
}

export async function getUserById(id: string): Promise<User | undefined> {
  if (isSupabaseConfigured()) return supabase.getUserByIdFromSupabase(id)
  return Promise.resolve(store.getUserById(id))
}

/** Seed users only when using store (no-op when Supabase). Returns current users. */
export async function seedUsers(): Promise<User[]> {
  if (isSupabaseConfigured()) return listUsers()
  return Promise.resolve(store.seedUsers())
}

export async function createUser(input: CreateUserInput): Promise<User> {
  if (isSupabaseConfigured()) return supabase.createUserInSupabase(input)
  return Promise.resolve(store.createUser(input))
}

export async function updateUser(userId: string, input: UpdateUserInput): Promise<User> {
  if (isSupabaseConfigured()) return supabase.updateUserInSupabase(userId, input)
  return Promise.resolve(store.updateUser(userId, input))
}

export async function updateUserRole(userId: string, role: Role): Promise<User> {
  if (isSupabaseConfigured()) return supabase.updateUserRoleInSupabase(userId, role)
  return Promise.resolve(store.updateUserRole(userId, role))
}

export async function deleteUser(userId: string): Promise<void> {
  if (isSupabaseConfigured()) return supabase.deleteUserInSupabase(userId)
  store.deleteUser(userId)
  return Promise.resolve()
}

/** Current logged-in user profile (Supabase only). Returns null when using store or not logged in. */
export async function getCurrentProfile(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null
  return supabase.getCurrentProfileFromSupabase()
}
