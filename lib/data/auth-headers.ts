/**
 * Build Authorization header from the live Supabase session.
 *
 * Critical: if the cached access token is within REFRESH_SKEW_SECONDS of expiry,
 * call refreshSession() before stamping the header. Otherwise mobile clients
 * that have been idle on a form for hours will POST with a stale JWT, get a
 * 401 from the API, and see the "session expired" toast even though the
 * refresh token is still valid.
 */
const REFRESH_SKEW_SECONDS = 120

export async function buildAuthHeaders(required = false): Promise<Record<string, string>> {
  try {
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client")
    const supabaseClient = getSupabaseBrowserClient()
    let {
      data: { session },
    } = await supabaseClient.auth.getSession()

    if (session?.expires_at) {
      const nowSeconds = Math.floor(Date.now() / 1000)
      const secondsToExpiry = session.expires_at - nowSeconds
      if (secondsToExpiry <= REFRESH_SKEW_SECONDS) {
        try {
          const { data: refreshed } = await supabaseClient.auth.refreshSession()
          if (refreshed?.session) session = refreshed.session
        } catch {
          // Fall through to whatever we already have; the caller can retry on 401.
        }
      }
    }

    const token = session?.access_token
    if (!token) {
      if (required) throw new Error("Please sign in again to continue.")
      return {}
    }
    return { Authorization: `Bearer ${token}` }
  } catch (error) {
    if (required) {
      throw error instanceof Error ? error : new Error("Unable to validate user session.")
    }
    return {}
  }
}

/**
 * Force a session refresh. Use when the server returned 401 to give the
 * upload one more chance with a fresh JWT before showing "session expired".
 */
export async function refreshSupabaseSession(): Promise<boolean> {
  try {
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client")
    const supabaseClient = getSupabaseBrowserClient()
    const { data, error } = await supabaseClient.auth.refreshSession()
    if (error) return false
    return !!data?.session?.access_token
  } catch {
    return false
  }
}
