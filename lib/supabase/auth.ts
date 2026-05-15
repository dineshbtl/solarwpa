/**
 * Auth helpers for self-hosted Supabase (GoTrue).
 * Use getSupabaseBrowserClient() for client-side auth; createSupabaseServerClient() for server.
 */
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from './client'
import { isSupabaseConfigured } from './config'

let sessionReadyInflight: Promise<Session | null> | null = null

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) return error.name === 'AbortError'
  if (error instanceof Error) {
    return error.name === 'AbortError' || /aborted without reason/i.test(error.message)
  }
  return typeof error === 'string' && /aborted without reason/i.test(error)
}

export async function getSession() {
  if (typeof window === 'undefined') return null
  const supabase = getSupabaseBrowserClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  return session
}

/**
 * After a client-side route transition, the Supabase client may not have applied the
 * stored session to the client yet, so the first query can run as anonymous and hang or
 * return before RLS-backed data is visible. Wait until a session is present (or auth
 * state has settled) before calling authenticated table APIs.
 */
export async function waitForSessionReady(maxWaitMs = 2_000): Promise<Session | null> {
  if (typeof window === 'undefined' || !isSupabaseConfigured()) {
    return null
  }
  if (sessionReadyInflight) return sessionReadyInflight

  sessionReadyInflight = (async () => {
    const supabase = getSupabaseBrowserClient()

    const readSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        return data.session ?? null
      } catch (error) {
        if (isAbortError(error)) return null
        throw error
      }
    }

    // Session is hydrated from storage asynchronously; retry a few ticks first (covers SPA navigations).
    for (let i = 0; i < 10; i++) {
      const s = await readSession()
      if (s) return s
      await new Promise((r) => setTimeout(r, i < 5 ? 0 : 40))
    }

    // Ensure JWT is validated/refreshed before RLS-backed reads (also helps first paint after login).
    try {
      const { data: userData, error } = await supabase.auth.getUser()
      if (!error && userData.user) {
        const afterUser = await readSession()
        if (afterUser) return afterUser
      }
    } catch (error) {
      if (!isAbortError(error)) {
        // non-abort errors are intentionally ignored, preserving existing behavior
      }
    }

    return new Promise<Session | null>((resolve) => {
      let settled = false
      let timer: ReturnType<typeof setTimeout>
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event: AuthChangeEvent, session) => {
          if (
            session &&
            (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')
          ) {
            if (settled) return
            settled = true
            clearTimeout(timer)
            subscription.unsubscribe()
            resolve(session)
          }
        }
      )

      timer = setTimeout(() => {
        if (settled) return
        settled = true
        subscription.unsubscribe()
        resolve(null)
      }, maxWaitMs)
    })
  })()

  try {
    return await sessionReadyInflight
  } finally {
    sessionReadyInflight = null
  }
}

export async function getUser() {
  if (typeof window === 'undefined') {
    throw new Error('getUser() is only available in the browser.')
  }
  const supabase = getSupabaseBrowserClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}
