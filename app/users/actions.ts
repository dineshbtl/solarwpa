"use server"

import type { CreateUserInput, UpdateUserInput } from "@/lib/store/users"
import type { User } from "@/lib/store/users"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createUserInSupabase, updateUserInSupabaseAdmin, deleteUserInSupabaseAdmin } from "@/lib/supabase/users"

/**
 * Server Action: create a user. Runs on the server so SUPABASE_SERVICE_ROLE_KEY
 * is available. Use this from client components instead of calling createUser()
 * from the data layer when Supabase is configured.
 */
export async function createUserAction(input: CreateUserInput): Promise<User> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.")
  }
  return createUserInSupabase(input)
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
 * Server Action: delete a user. Uses admin client so SUPABASE_SERVICE_ROLE_KEY is available.
 */
export async function deleteUserAction(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.")
  }
  return deleteUserInSupabaseAdmin(userId)
}
