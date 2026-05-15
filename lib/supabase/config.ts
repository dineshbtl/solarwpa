/**
 * Check if Supabase is configured (env vars set).
 */
export function isSupabaseConfigured(): boolean {
  if (typeof window !== 'undefined') {
    return !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  }
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

const CONFIG_MSG =
  'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'

/** Throws if env is missing; data layer uses Supabase only (no local mock store). */
export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(CONFIG_MSG)
  }
}
