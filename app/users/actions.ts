"use server"

import type { CreateUserInput, UpdateUserInput } from "@/lib/store/users"
import type { User } from "@/lib/store/users"
import type { Role } from "@/lib/rbac"
import { ROLES_LIST } from "@/lib/rbac"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createUserInSupabase, updateUserInSupabaseAdmin, deleteUserInSupabaseAdmin } from "@/lib/supabase/users"
import { CreateUserSchema } from "@/lib/store/users"

/**
 * Server Action: create a user. Runs on the server so SUPABASE_SERVICE_ROLE_KEY
 * is available. Use this from client components instead of calling createUser()
 * from the data layer when Supabase is configured.
 */
export async function createUserAction(input: CreateUserInput): Promise<User> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.")
  }
  const parsed = CreateUserSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((e) => e.message).join("; "))
  }
  try {
    return await createUserInSupabase(parsed.data)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown create-user error"
    throw new Error(`Create user failed: ${message}`)
  }
}

/**
 * Server Action: update a user (including status active/inactive). Uses admin client so edits work regardless of RLS.
 */
export async function updateUserAction(userId: string, input: UpdateUserInput): Promise<User> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.")
  }
  return updateUserInSupabaseAdmin(userId, input)
}

/**
 * Server Action: change a user's role from the users table. Uses admin client (RLS allows only self-update via anon key).
 */
export async function updateUserRoleAction(userId: string, role: Role): Promise<User> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.")
  }
  if (!ROLES_LIST.includes(role)) {
    throw new Error("Invalid role.")
  }
  return updateUserInSupabaseAdmin(userId, { role })
}

/**
 * Server Action: delete a user. Uses admin client so SUPABASE_SERVICE_ROLE_KEY is available.
 */
export async function deleteUserAction(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.")
  }
  return deleteUserInSupabaseAdmin(userId)
}
