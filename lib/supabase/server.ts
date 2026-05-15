import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

/**
 * Server-side Supabase client (Node/Next server).
 * Use this in Server Components, Route Handlers, and API routes.
 *
 * - With SUPABASE_SERVICE_ROLE_KEY: bypasses RLS (admin). Use only on server.
 * - With anon key or no key: same as browser client (respects RLS).
 *
 * URL: uses SUPABASE_URL when set (e.g. http://host.docker.internal:8000 when app runs in Docker),
 * otherwise NEXT_PUBLIC_SUPABASE_URL so the server can reach Supabase.
 */
export function createSupabaseServerClient(options?: { useServiceRole?: boolean }) {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL. See .env.example and docs/SUPABASE_SELFHOSTED.md.')
  }
  const key = options?.useServiceRole ? serviceRoleKey : anonKey
  if (!key) {
    throw new Error(
      'Missing Supabase key: set NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY for server admin access.'
    )
  }
  return createClient<Database>(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
