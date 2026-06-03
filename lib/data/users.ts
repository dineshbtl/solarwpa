/**
 * User/profile data from Supabase only.
 */
import type { Role } from '@/lib/rbac'
import { assertSupabaseConfigured } from '@/lib/supabase/config'
import * as supabase from '@/lib/supabase/users'
import type { User, CreateUserInput, UpdateUserInput } from '@/lib/store/users'

import { offlineDB } from '@/lib/data/offline-db'

export type { User, CreateUserInput, UpdateUserInput }

let listUsersInflight: Promise<User[]> | null = null

export async function listUsers(): Promise<User[]> {
  assertSupabaseConfigured()
  try {
    const list = await supabase.listUsersFromSupabase()
    if (typeof window !== 'undefined') {
      await offlineDB.putMany('users', list, { silent: true })
    }
    return list
  } catch (err) {
    const local = await offlineDB.getAll('users')
    if (local.length > 0) return local
    throw err
  }
}

export async function getUserById(id: string): Promise<User | undefined> {
  assertSupabaseConfigured()
  try {
    const one = await supabase.getUserByIdFromSupabase(id)
    if (one && typeof window !== 'undefined') {
      await offlineDB.putOne('users', one)
    }
    return one
  } catch (err) {
    const local = await offlineDB.getOne('users', id)
    if (local) return local as User
    throw err
  }
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
