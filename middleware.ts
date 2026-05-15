import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/logout']

/** Sessions that can't be refreshed — wipe cookies so the next request stops retrying. */
const CLEAR_SESSION_CODES = new Set([
  'refresh_token_not_found',
  'invalid_refresh_token',
  'session_not_found',
  'bad_jwt',
])

function mergeSetCookieHeaders(from: NextResponse, into: NextResponse) {
  const headers = from.headers
  if (typeof headers.getSetCookie === 'function') {
    for (const cookie of headers.getSetCookie()) {
      into.headers.append('Set-Cookie', cookie)
    }
    return
  }
  const single = headers.get('set-cookie')
  if (single) into.headers.append('Set-Cookie', single)
}

/** Fallback if signOut did not emit Set-Cookie (older runtimes). */
function clearSupabaseAuthCookiesFromRequest(request: NextRequest, into: NextResponse) {
  const isHttps = request.nextUrl.protocol === 'https:'
  for (const c of request.cookies.getAll()) {
    if (!c.name.startsWith('sb-')) continue
    into.cookies.set(c.name, '', {
      path: '/',
      maxAge: 0,
      sameSite: 'lax',
      secure: isHttps,
    })
  }
}

export async function middleware(request: NextRequest) {
  // MUST match NEXT_PUBLIC_SUPABASE_URL: Supabase auth cookie names are derived from the API
  // hostname (e.g. sb-solarepc-auth-token). If middleware used SUPABASE_URL (127.0.0.1), it would
  // look for sb-127-auth-token and never see the browser session → endless login redirect.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request })
  }

  /** Single response object so every `setAll` accumulates Set-Cookie (clear + refresh). */
  let res = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options)
        })
      },
    },
  })

  let user: User | null = null
  let shouldClearStaleSession = false

  try {
    const { data, error } = await supabase.auth.getUser()
    if (!error && data?.user) {
      user = data.user
    } else if (error && (CLEAR_SESSION_CODES.has(error.code ?? '') || /refresh.?token/i.test(error.message ?? ''))) {
      shouldClearStaleSession = true
    }
  } catch {
    user = null
    // Possible network flake — don't auto-clear cookies
  }

  if (shouldClearStaleSession && !user) {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      clearSupabaseAuthCookiesFromRequest(request, res)
    }
  }

  const { pathname } = request.nextUrl
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname)

  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/'
    loginUrl.searchParams.set('redirectTo', pathname)
    const redirectRes = NextResponse.redirect(loginUrl)
    mergeSetCookieHeaders(res, redirectRes)
    if (shouldClearStaleSession) {
      clearSupabaseAuthCookiesFromRequest(request, redirectRes)
    }
    return redirectRes
  }

  if (user && pathname === '/') {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    const redirectRes = NextResponse.redirect(dashboardUrl)
    mergeSetCookieHeaders(res, redirectRes)
    return redirectRes
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
