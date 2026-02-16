/**
 * Auth helpers for self-hosted Supabase (GoTrue).
 * Use getSupabaseBrowserClient() for client-side auth; createSupabaseServerClient() for server.
 */
import { getSupabaseBrowserClient } from './client'

export async function getSession() {
  const supabase = getSupabaseBrowserClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  return session
}

export async function getUser() {
  const supabase = getSupabaseBrowserClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}
