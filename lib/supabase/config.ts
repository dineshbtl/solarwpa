/**
 * Check if Supabase is configured (env vars set).
 * Use this to decide whether to use Supabase or localStorage store.
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
