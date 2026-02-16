import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

/**
 * Browser-safe Supabase client for self-hosted or cloud Supabase.
 * Uses NEXT_PUBLIC_ env vars so it works in the browser.
 *
 * Dual URL (LAN + public):
 * - When NEXT_PUBLIC_SUPABASE_URL_LAN is set, we use it when the app is opened
 *   via the same host as in that URL (e.g. 172.30.0.191) or via localhost (so
 *   same-machine access works). Otherwise we use NEXT_PUBLIC_SUPABASE_URL.
 * - So: open at http://172.30.0.191:3000 or http://localhost:3000 → URL_LAN;
 *   open at http://183.82.117.36:3000 → NEXT_PUBLIC_SUPABASE_URL.
 *
 * Fallback when only NEXT_PUBLIC_SUPABASE_URL is localhost: if the page is
 * opened via a different host (e.g. LAN IP), we use that host with the same port.
 */
function getEnv() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (process.env.NEXT_PUBLIC_SUPABASE_URL_LAN) {
      try {
        const lanUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_LAN
        const lanHost = new URL(lanUrl).hostname
        if (hostname === lanHost || hostname === 'localhost' || hostname === '127.0.0.1') {
          url = lanUrl
        }
      } catch {
        // keep url as NEXT_PUBLIC_SUPABASE_URL
      }
    } else if (url && (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1'))) {
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        try {
          const parsed = new URL(url)
          const port = parsed.port || '8000'
          url = `http://${hostname}:${port}`
        } catch {
          url = `http://${hostname}:8000`
        }
      }
    }
  }
  return { url, key }
}

export function createSupabaseBrowserClient() {
  const { url, key } = getEnv()
  if (!url || !key) {
    throw new Error(
      'Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. See .env.example and docs/SUPABASE_SELFHOSTED.md.'
    )
  }
  return createClient<Database>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

// Singleton for client components (same as createSupabaseBrowserClient() but cached per request in Next)
let browserClient: ReturnType<typeof createClient<Database>> | null = null

export function getSupabaseBrowserClient() {
  if (typeof window === 'undefined') {
    return createSupabaseBrowserClient()
  }
  if (!browserClient) {
    browserClient = createSupabaseBrowserClient()
  }
  return browserClient
}

/** Returns client only when env is set; use for optional Supabase flows (e.g. data layer, auth fallback). */
export function getSupabaseBrowserClientIfConfigured(): ReturnType<typeof createClient<Database>> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return getSupabaseBrowserClient()
}
