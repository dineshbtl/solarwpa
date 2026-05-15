/**
 * User/profile data from Supabase only.
 */
import type { Role } from '@/lib/rbac'
import { assertSupabaseConfigured } from '@/lib/supabase/config'
import * as supabase from '@/lib/supabase/users'
import type { User, CreateUserInput, UpdateUserInput } from '@/lib/store/users'

export type { User, CreateUserInput, UpdateUserInput }

let listUsersInflight: Promise<User[]> | null = null

export async function listUsers(): Promise<User[]> {
  assertSupabaseConfigured()
  if (!listUsersInflight) {
    listUsersInflight = supabase.listUsersFromSupabase().finally(() => {
      listUsersInflight = null
    })
  }
  return listUsersInflight
}

export async function getUserById(id: string): Promise<User | undefined> {
  assertSupabaseConfigured()
  return supabase.getUserByIdFromSupabase(id)
}

/** No-op: data lives in Supabase. Kept so callers can still chain refetch after “seed”. */
export async function seedUsers(): Promise<User[]> {
  assertSupabaseConfigured()
  return []
}

export async function createUser(input: CreateUserInput): Promise<User> {
  assertSupabaseConfigured()
  return supabase.createUserInSupabase(input)
}

export async function updateUser(userId: string, input: UpdateUserInput): Promise<User> {
  assertSupabaseConfigured()
  return supabase.updateUserInSupabase(userId, input)
}

export async function updateUserRole(userId: string, role: Role): Promise<User> {
  assertSupabaseConfigured()
  return supabase.updateUserRoleInSupabase(userId, role)
}

export async function deleteUser(userId: string): Promise<void> {
  assertSupabaseConfigured()
  return supabase.deleteUserInSupabase(userId)
}

export async function getCurrentProfile(): Promise<User | null> {
  assertSupabaseConfigured()
  return supabase.getCurrentProfileFromSupabase()
}
