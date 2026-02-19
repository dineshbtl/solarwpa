/**
 * Supabase-backed profiles (users) CRUD. Maps DB rows to app User type.
 */
import type { Database } from '@/lib/supabase/database.types'
import type { Role } from '@/lib/rbac'
import type { User, CreateUserInput, UpdateUserInput } from '@/lib/store/users'
import { getSupabaseBrowserClient, getSupabaseAdminClient } from '@/lib/supabase/client'

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

/** Create profile with auth user. Admin creates both profile and auth account so user can login immediately. */
export async function createUserInSupabase(input: CreateUserInput): Promise<User> {
  const adminClient = getSupabaseAdminClient()
  
  // Check if user already exists in auth
  const { data: existingUsers } = await adminClient.auth.admin.listUsers()
  const existingAuthUser = existingUsers?.users.find(u => u.email?.toLowerCase() === input.email.toLowerCase())
  
  let authUserId: string
  
  if (existingAuthUser) {
    // Use existing auth user
    authUserId = existingAuthUser.id
    console.log('[createUserInSupabase] Using existing auth user:', authUserId)
  } else {
    // Create new auth user using Admin API (bypasses email confirmation)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true, // Auto-confirm email so user can login immediately
      user_metadata: { full_name: input.name },
    })
    
    if (authError) {
      console.error('[createUserInSupabase] Auth creation error:', authError)
      throw new Error(`Failed to create auth account: ${authError.message}`)
    }
    
    authUserId = authData.user?.id
    if (!authUserId) {
      throw new Error('Failed to get auth user ID')
    }
    console.log('[createUserInSupabase] Created new auth user:', authUserId)
  }
  
  // Now create profile linked to auth user using admin client (bypasses RLS)
  const existing = await listUsersFromSupabase()
  
  // Check if profile already exists for this auth user
  const existingProfile = existing.find(u => u.email.toLowerCase() === input.email.toLowerCase())
  if (existingProfile) {
    console.log('[createUserInSupabase] Profile already exists:', existingProfile)
    return existingProfile
  }
  
  const id = nextUserId(existing)
  console.log('[createUserInSupabase] Creating profile with id:', id, 'authUserId:', authUserId)
  
  const { data, error } = await adminClient
    .from('profiles')
    .insert({
      id,
      auth_user_id: authUserId,
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
  if (error) {
    console.error('[createUserInSupabase] Profile creation error:', error)
    throw new Error(`Database error creating new user: ${error.message}`)
  }
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
  // First get the profile to find auth_user_id
  const supabase = getSupabaseBrowserClient()
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('auth_user_id')
    .eq('id', userId)
    .maybeSingle()
  
  if (fetchError) throw fetchError
  
  // Delete the profile
  const { error } = await supabase.from('profiles').delete().eq('id', userId)
  if (error) throw error
  
  // If there's an auth_user_id, delete the auth user too
  const authUserId = (profile as { auth_user_id?: string } | null)?.auth_user_id
  if (authUserId) {
    try {
      const adminClient = getSupabaseAdminClient()
      await adminClient.auth.admin.deleteUser(authUserId)
    } catch (e) {
      console.error('[deleteUserInSupabase] Failed to delete auth user:', e)
      // Profile is already deleted, so we don't throw
    }
  }
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
