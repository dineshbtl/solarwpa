/**
 * Supabase-backed profiles (users) CRUD. Maps DB rows to app User type.
 */
import type { Database } from '@/lib/supabase/database.types'
import type { Role } from '@/lib/rbac'
import type { User, CreateUserInput, UpdateUserInput } from '@/lib/store/users'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

type ProfileRow = Database['public']['Tables']['profiles']['Row']

function rowToUser(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    status: row.status,
    createdAt: row.created_at,
    phone: row.phone ?? undefined,
    aadharNo: row.aadhar_no ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    district: row.district ?? undefined,
    fullAddress: row.full_address ?? undefined,
  }
}

export async function listUsersFromSupabase(): Promise<User[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToUser)
}

export async function getUserByIdFromSupabase(id: string): Promise<User | undefined> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? rowToUser(data) : undefined
}

function nextUserId(existing: User[]): string {
  const nums = existing.map((u) => parseInt(u.id.replace(/^USR-/, ''), 10)).filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `USR-${(max + 1).toString().padStart(3, '0')}`
}

/** Create profile only (auth user must be created separately via signUp). Used when admin creates user and we create profile with auth_user_id null until user signs in. */
export async function createUserInSupabase(input: CreateUserInput): Promise<User> {
  const supabase = getSupabaseBrowserClient()
  const existing = await listUsersFromSupabase()
  const id = nextUserId(existing)
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id,
      auth_user_id: null,
      name: input.name,
      email: input.email,
      role: input.role,
      status: input.status ?? 'active',
      phone: input.phone?.trim() || null,
      aadhar_no: input.aadharNo?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      district: input.district?.trim() || null,
      full_address: input.fullAddress?.trim() || null,
    })
    .select()
    .single()
  if (error) throw error
  return rowToUser(data)
}

export async function updateUserInSupabase(userId: string, input: UpdateUserInput): Promise<User> {
  const supabase = getSupabaseBrowserClient()
  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.email !== undefined) updates.email = input.email
  if (input.role !== undefined) updates.role = input.role
  if (input.status !== undefined) updates.status = input.status
  if (input.phone !== undefined) updates.phone = input.phone?.trim() || null
  if (input.aadharNo !== undefined) updates.aadhar_no = input.aadharNo?.trim() || null
  if (input.city !== undefined) updates.city = input.city?.trim() || null
  if (input.state !== undefined) updates.state = input.state?.trim() || null
  if (input.district !== undefined) updates.district = input.district?.trim() || null
  if (input.fullAddress !== undefined) updates.full_address = input.fullAddress?.trim() || null
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single()
  if (error) throw error
  return rowToUser(data)
}

export async function updateUserRoleInSupabase(userId: string, role: Role): Promise<User> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.from('profiles').update({ role }).eq('id', userId).select().single()
  if (error) throw error
  return rowToUser(data)
}

export async function deleteUserInSupabase(userId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from('profiles').delete().eq('id', userId)
  if (error) throw error
}

/** Get current user's profile by auth session (auth.uid() -> profiles.auth_user_id). */
export async function getCurrentProfileFromSupabase(): Promise<User | null> {
  const supabase = getSupabaseBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (error) throw error
  return data ? rowToUser(data) : null
}
