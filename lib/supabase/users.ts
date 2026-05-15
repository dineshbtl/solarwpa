/**
 * Supabase-backed profiles (users) CRUD. Maps DB rows to app User type.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { Role } from '@/lib/rbac'
import type { User, CreateUserInput, UpdateUserInput } from '@/lib/store/users'
import { getSupabaseBrowserClient, getSupabaseAdminClient } from '@/lib/supabase/client'

// Bypass Supabase v2 complex generic type inference to prevent `never` types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function q(client: any): { from: (table: string) => any } {
  return client as unknown as { from: (table: string) => any }
}

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type SupabaseAdmin = SupabaseClient<Database>

/**
 * listUsers returns one page only (default 50). Walk pages so existing auth accounts
 * are found even when there are many users.
 */
async function findAuthUserByEmail(admin: SupabaseAdmin, email: string) {
  const target = email.toLowerCase().trim()
  let page = 1
  const perPage = 200
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const found = data.users.find((u) => u.email?.toLowerCase() === target)
    if (found) return found
    if (!data.users?.length || data.users.length < perPage) break
    page += 1
  }
  return undefined
}

function rowToUser(row: ProfileRow & { assigned_locations?: string[] | null }): User {
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
    assignedLocations: row.assigned_locations ?? undefined,
  }
}

export async function listUsersFromSupabase(): Promise<User[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await q(supabase).from('profiles').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToUser)
}

export async function getUserByIdFromSupabase(id: string): Promise<User | undefined> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await q(supabase).from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? rowToUser(data) : undefined
}

function nextUserId(existing: Array<{ id: string }>): string {
  const nums = existing.map((u) => parseInt(u.id.replace(/^USR-/, ''), 10)).filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `USR-${(max + 1).toString().padStart(3, '0')}`
}

/** Create profile with auth user. Admin creates both profile and auth account so user can login immediately. */
export async function createUserInSupabase(input: CreateUserInput): Promise<User> {
  const adminClient = getSupabaseAdminClient()
  const email = input.email.trim().toLowerCase()

  const existingAuthUser = await findAuthUserByEmail(adminClient, email)
  
  let authUserId: string
  
  if (existingAuthUser) {
    authUserId = existingAuthUser.id
    console.log('[createUserInSupabase] Using existing auth user:', authUserId)
    
    // Update the auth user's password so login works with the newly provided password
    if (input.password) {
      const { error: updateError } = await adminClient.auth.admin.updateUserById(authUserId, {
        password: input.password,
        email_confirm: true,
      })
      if (updateError) {
        console.error('[createUserInSupabase] Failed to update auth user password:', updateError)
        throw new Error(`Failed to update auth account password: ${updateError.message}`)
      }
      console.log('[createUserInSupabase] Updated password for existing auth user:', authUserId)
    }
  } else {
    // Create new auth user using Admin API (bypasses email confirmation)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
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
  
  // Query profiles with admin client only (avoid anon/RLS issues in server actions)
  const { data: existingProfiles, error: existingProfilesError } = await q(adminClient)
    .from('profiles')
    .select('id,email,auth_user_id')
  if (existingProfilesError) {
    throw new Error(`Could not verify existing profiles: ${existingProfilesError.message}`)
  }

  const existing = (existingProfiles ?? []) as Array<{ id: string; email: string | null; auth_user_id: string | null }>

  // Check if profile already exists for this email
  const existingProfile = existing.find((u) => (u.email ?? "").toLowerCase() === email)
  if (existingProfile) {
    const { data: profileRow, error: fetchProfileError } = await q(adminClient)
      .from('profiles')
      .select('*')
      .eq('id', existingProfile.id)
      .single()
    if (fetchProfileError) throw fetchProfileError
    if (!profileRow) throw new Error('Profile row missing for existing email')

    const { data: updatedExisting, error: updateExistingError } = await q(adminClient)
      .from('profiles')
      .update({
        auth_user_id: authUserId,
        name: input.name,
        email,
        role: input.role,
        status: input.status ?? 'active',
        phone: input.phone?.trim() || null,
        aadhar_no: input.aadharNo?.trim() || null,
        city: input.city?.trim() || null,
        state: input.state?.trim() || null,
        district: input.district?.trim() || null,
        full_address: input.fullAddress?.trim() || null,
        assigned_locations: input.assignedLocations ?? [],
      })
      .eq('id', existingProfile.id)
      .select()
      .single()
    if (updateExistingError) throw updateExistingError
    console.log('[createUserInSupabase] Updated existing profile:', existingProfile.id)
    return rowToUser(updatedExisting)
  }
  
  const id = nextUserId(existing.map((u) => ({ id: u.id })))
  console.log('[createUserInSupabase] Creating profile with id:', id, 'authUserId:', authUserId)
  
  const { data, error } = await q(adminClient)
    .from('profiles')
    .insert({
      id,
      auth_user_id: authUserId,
      name: input.name,
      email,
      role: input.role,
      status: input.status ?? 'active',
      phone: input.phone?.trim() || null,
      aadhar_no: input.aadharNo?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      district: input.district?.trim() || null,
      full_address: input.fullAddress?.trim() || null,
      assigned_locations: input.assignedLocations ?? [],
    })
    .select()
    .single()
  if (error) {
    // Some environments auto-create a profile row via trigger when auth user is created.
    // In that case, insert fails on unique auth_user_id; patch that row instead.
    if (error.code === '23505' && String(error.message || '').includes('profiles_auth_user_id_key')) {
      const { data: existingByAuth, error: byAuthErr } = await q(adminClient)
        .from('profiles')
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle()
      if (byAuthErr) {
        throw new Error(`Profile insert conflicted and fallback lookup failed: ${byAuthErr.message}`)
      }
      if (!existingByAuth) {
        throw new Error('Profile insert conflicted on auth_user_id but no matching profile row found.')
      }
      const { data: patched, error: patchErr } = await q(adminClient)
        .from('profiles')
        .update({
          name: input.name,
          email,
          role: input.role,
          status: input.status ?? 'active',
          phone: input.phone?.trim() || null,
          aadhar_no: input.aadharNo?.trim() || null,
          city: input.city?.trim() || null,
          state: input.state?.trim() || null,
          district: input.district?.trim() || null,
          full_address: input.fullAddress?.trim() || null,
          assigned_locations: input.assignedLocations ?? [],
        })
        .eq('id', existingByAuth.id)
        .select()
        .single()
      if (patchErr) {
        throw new Error(`Profile auto-row exists but update failed: ${patchErr.message}`)
      }
      return rowToUser(patched)
    }
    console.error('[createUserInSupabase] Profile creation error:', error)
    throw new Error(`Database error creating new user: ${error.message}`)
  }
  return rowToUser(data)
}

export async function updateUserInSupabase(userId: string, input: UpdateUserInput): Promise<User> {
  const supabase = getSupabaseBrowserClient()
  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.email !== undefined) updates.email = input.email.trim().toLowerCase()
  if (input.role !== undefined) updates.role = input.role
  if (input.status !== undefined) updates.status = input.status
  if (input.phone !== undefined) updates.phone = input.phone?.trim() || null
  if (input.aadharNo !== undefined) updates.aadhar_no = input.aadharNo?.trim() || null
  if (input.city !== undefined) updates.city = input.city?.trim() || null
  if (input.state !== undefined) updates.state = input.state?.trim() || null
  if (input.district !== undefined) updates.district = input.district?.trim() || null
  if (input.fullAddress !== undefined) updates.full_address = input.fullAddress?.trim() || null
  if (input.assignedLocations !== undefined) updates.assigned_locations = input.assignedLocations
  const { data, error } = await q(supabase).from('profiles').update(updates).eq('id', userId).select().single()
  if (error) throw error
  return rowToUser(data)
}

/** Update profile using admin client (for edit-user from server so status/role etc. work regardless of RLS). */
export async function updateUserInSupabaseAdmin(userId: string, input: UpdateUserInput): Promise<User> {
  const admin = getSupabaseAdminClient()

  const { data: prevProfile, error: prevErr } = await q(admin).from('profiles').select('*').eq('id', userId).maybeSingle()
  if (prevErr) throw prevErr
  if (!prevProfile) throw new Error('User not found')

  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.email !== undefined) updates.email = input.email.trim().toLowerCase()
  if (input.role !== undefined) updates.role = input.role
  if (input.status !== undefined) updates.status = input.status
  if (input.phone !== undefined) updates.phone = input.phone?.trim() || null
  if (input.aadharNo !== undefined) updates.aadhar_no = input.aadharNo?.trim() || null
  if (input.city !== undefined) updates.city = input.city?.trim() || null
  if (input.state !== undefined) updates.state = input.state?.trim() || null
  if (input.district !== undefined) updates.district = input.district?.trim() || null
  if (input.fullAddress !== undefined) updates.full_address = input.fullAddress?.trim() || null
  if (input.assignedLocations !== undefined) updates.assigned_locations = input.assignedLocations
  let { data, error } = await q(admin).from('profiles').update(updates).eq('id', userId).select().single()
  if (error) throw error

  const row = data as ProfileRow

  // Keep GoTrue email in sync when admin changes profile email (otherwise login email ≠ form email).
  if (row.auth_user_id && input.email !== undefined) {
    const prevEmail = (prevProfile as ProfileRow).email?.trim().toLowerCase() ?? ''
    const nextEmail = row.email.trim().toLowerCase()
    if (prevEmail !== nextEmail) {
      const { error: emailAuthErr } = await admin.auth.admin.updateUserById(row.auth_user_id, {
        email: nextEmail,
        email_confirm: true,
      })
      if (emailAuthErr) {
        console.error('[updateUserInSupabaseAdmin] Failed to sync auth email:', emailAuthErr)
        throw new Error(`Profile updated but login email could not be synced: ${emailAuthErr.message}`)
      }
    }
  }

  // If password was provided, ensure auth.users exists and passwords match
  if (input.password && input.password.trim() !== '') {
    const emailForAuth = row.email.trim()
    let authUserId = row.auth_user_id as string | undefined

    if (!authUserId) {
      const found = await findAuthUserByEmail(admin, emailForAuth)
      if (found) {
        authUserId = found.id
        const { error: linkError } = await q(admin)
          .from('profiles')
          .update({ auth_user_id: authUserId })
          .eq('id', userId)
        if (linkError) {
          console.error('[updateUserInSupabaseAdmin] Failed to link auth user:', linkError)
          throw new Error(`Failed to link login account: ${linkError.message}`)
        }
        const { error: authError } = await admin.auth.admin.updateUserById(authUserId, {
          email: emailForAuth.trim().toLowerCase(),
          password: input.password,
          email_confirm: true,
        })
        if (authError) {
          console.error('[updateUserInSupabaseAdmin] Failed to update auth password:', authError)
          throw new Error(`Profile updated but failed to set login password: ${authError.message}`)
        }
        console.log('[updateUserInSupabaseAdmin] Linked profile to auth user and updated password:', authUserId)
      } else {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: emailForAuth,
          password: input.password,
          email_confirm: true,
          user_metadata: { full_name: row.name },
        })
        if (createErr || !created.user?.id) {
          console.error('[updateUserInSupabaseAdmin] Failed to create auth user:', createErr)
          throw new Error(
            `Could not create login for this profile: ${createErr?.message ?? 'unknown error'}`
          )
        }
        authUserId = created.user.id
        const { error: linkError } = await q(admin)
          .from('profiles')
          .update({ auth_user_id: authUserId })
          .eq('id', userId)
        if (linkError) throw new Error(`Auth account created but failed to link profile: ${linkError.message}`)
        console.log('[updateUserInSupabaseAdmin] Created auth user and linked:', authUserId)
      }
    } else {
      const { error: authError } = await admin.auth.admin.updateUserById(authUserId, {
        email: row.email.trim().toLowerCase(),
        password: input.password,
        email_confirm: true,
      })
      if (authError) {
        console.error('[updateUserInSupabaseAdmin] Failed to update auth password:', authError)
        throw new Error(`Profile updated but failed to update login password: ${authError.message}`)
      }
      console.log('[updateUserInSupabaseAdmin] Updated auth password for user:', authUserId)
    }

    const reread = await q(admin).from('profiles').select('*').eq('id', userId).maybeSingle()
    if (reread.data) data = reread.data
  }

  return rowToUser(data as ProfileRow)
}

export async function updateUserRoleInSupabase(userId: string, role: Role): Promise<User> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await q(supabase).from('profiles').update({ role }).eq('id', userId).select().single()
  if (error) throw error
  return rowToUser(data)
}

export async function deleteUserInSupabase(userId: string): Promise<void> {
  // First get the profile to find auth_user_id
  const supabase = getSupabaseBrowserClient()
  const { data: profile, error: fetchError } = await q(supabase)
    .from('profiles')
    .select('auth_user_id')
    .eq('id', userId)
    .maybeSingle()
  
  if (fetchError) throw fetchError
  
  // Delete the profile
  const { error } = await q(supabase).from('profiles').delete().eq('id', userId)
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

/** Delete user using admin client (for delete from server so service role key is available). */
export async function deleteUserInSupabaseAdmin(userId: string): Promise<void> {
  const admin = getSupabaseAdminClient()
  const { data: profile, error: fetchError } = await q(admin)
    .from('profiles')
    .select('auth_user_id')
    .eq('id', userId)
    .maybeSingle()

  if (fetchError) throw fetchError

  const { error } = await q(admin).from('profiles').delete().eq('id', userId)
  if (error) throw error

  const authUserId = (profile as { auth_user_id?: string } | null)?.auth_user_id
  if (authUserId) {
    try {
      await admin.auth.admin.deleteUser(authUserId)
    } catch (e) {
      console.error('[deleteUserInSupabaseAdmin] Failed to delete auth user:', e)
    }
  }
}

/** Get current user's profile by auth session (auth.uid() -> profiles.auth_user_id). */
export async function getCurrentProfileFromSupabase(): Promise<User | null> {
  // Session is hydrated from localStorage asynchronously. Without waiting, the first call
  // after a hard refresh can return null even when the user is signed in, which causes the
  // sidebar/RoleContext to fall back to the surveyor default and the menu to disappear.
  const { waitForSessionReady } = await import('@/lib/supabase/auth')
  const session = await waitForSessionReady()
  const supabase = getSupabaseBrowserClient()
  let authUserId = session?.user?.id ?? null
  if (!authUserId) {
    const { data: { user } } = await supabase.auth.getUser()
    authUserId = user?.id ?? null
  }
  if (!authUserId) return null
  const { data, error } = await q(supabase)
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  if (error) throw error
  return data ? rowToUser(data) : null
}
