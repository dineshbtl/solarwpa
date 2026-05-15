import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/supabase/database.types'

/** Server-only: read SUPABASE_SERVICE_ROLE_KEY from .env.local if not in process.env (e.g. some Server Action contexts). */
function getServiceRoleKeyFromEnvFile(): string | undefined {
  if (typeof window !== 'undefined') return undefined
  try {
    const fs = require('fs')
    const path = require('path')
    const envPath = path.join(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) return undefined
    const content = fs.readFileSync(envPath, 'utf8')
    const line = content
      .split(/\r?\n/)
      .find((l: string) => /^\s*SUPABASE_SERVICE_ROLE_KEY\s*=/.test(l.trim()))
    if (!line) return undefined
    const match = line.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)
    const value = match?.[1]?.trim().replace(/^["']|["']$/g, '')
    return value || undefined
  } catch {
    return undefined
  }
}

/** Port when `NEXT_PUBLIC_SUPABASE_URL` is `http://localhost` without `:port` (dev LAN rewrite). Default 8000 (Supabase); use 7100 etc. if Kong is on the 7000 range. */
function defaultLocalSupabaseApiPort(): string {
  const p = process.env.NEXT_PUBLIC_SUPABASE_LOCAL_API_PORT
  if (p && /^\d+$/.test(p)) return p
  return '8000'
}

/**
 * Browser-safe Supabase client for self-hosted or cloud Supabase.
 * Uses a single canonical `NEXT_PUBLIC_SUPABASE_URL` (HTTPS domain recommended).
 *
 * Dev-only: if `NEXT_PUBLIC_SUPABASE_URL` points at localhost but the app is opened
 * via another hostname (e.g. LAN IP), rewrite the API host to match so the browser
 * can reach Kong without mixed origins.
 */
function getEnv() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (typeof window !== 'undefined' && url) {
    const hostname = window.location.hostname
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        const fallbackPort = defaultLocalSupabaseApiPort()
        try {
          const parsed = new URL(url)
          const port = parsed.port || fallbackPort
          url = `http://${hostname}:${port}`
        } catch {
          url = `http://${hostname}:${fallbackPort}`
        }
      }
    }
  }
  return { url, key }
}

const SUPABASE_REQUEST_TIMEOUT_MS = 15_000

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), SUPABASE_REQUEST_TIMEOUT_MS)
  try {
    return await fetch(input, {
      ...init,
      signal: init?.signal ?? ctrl.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Server is taking too long to respond. Please refresh and try again.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export function createSupabaseBrowserClient() {
  const { url, key } = getEnv()
  if (!url || !key) {
    throw new Error(
      'Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. See .env.example and docs/SUPABASE_SELFHOSTED.md.'
    )
  }
  return createBrowserClient<Database>(url, key, {
    global: {
      fetch: fetchWithTimeout,
    },
    cookieOptions: {
      path: '/',
      sameSite: 'lax',
      secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
    },
  })
}

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function getSupabaseBrowserClient() {
  if (typeof window === 'undefined') {
    throw new Error(
      'getSupabaseBrowserClient() must run in the browser only. On the server use createSupabaseServerClient().'
    )
  }
  if (!browserClient) {
    browserClient = createSupabaseBrowserClient()
  }
  return browserClient
}

/** Returns client only when env is set; use for optional Supabase flows (e.g. data layer, auth fallback). */
export function getSupabaseBrowserClientIfConfigured(): ReturnType<typeof createClient<Database>> | null {
  if (typeof window === 'undefined') return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return getSupabaseBrowserClient()
}

/** Admin client for server-side operations (requires SUPABASE_SERVICE_ROLE_KEY). */
let adminClient: ReturnType<typeof createClient<Database>> | null = null

export function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  // Check process.env first, then .env.local (for Server Actions where env may not be passed)
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    getServiceRoleKeyFromEnvFile()
  if (!url) {
    throw new Error(
      'Admin client requires NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL in .env.local (required for server-side Supabase)'
    )
  }
  if (!serviceKey) {
    throw new Error(
      'Admin client requires SUPABASE_SERVICE_ROLE_KEY in .env.local. ' +
        'Get it from Supabase: Project Settings → API → service_role key. Restart the dev server after adding it.'
    )
  }
  if (!adminClient) {
    adminClient = createClient<Database>(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }
  return adminClient
}
