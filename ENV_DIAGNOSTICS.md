# Environment Variables Diagnostics - May 11, 2026 (updated)

## Current model: one public URL + optional internal server URL

- **`NEXT_PUBLIC_SUPABASE_URL`** — Single canonical API base for the **browser** (e.g. `https://solarepc.brihaspathi.com/supabase`).
- **`SUPABASE_URL`** (optional) — Internal Kong URL for **service-role** server code only (`getSupabaseAdminClient`). **Middleware ignores it** and always uses `NEXT_PUBLIC_SUPABASE_URL` so session cookie names match the browser (otherwise login loops).

The app **no longer** uses `NEXT_PUBLIC_SUPABASE_URL_LAN` (removed to avoid split-brain and slow/confusing behavior).

## CURL checks (reference)

1. **Public (HTTPS):** `https://solarepc.brihaspathi.com/supabase` — expect e.g. `{"message":"No API key found in request"}` without headers.
2. **Internal Kong (if used as `SUPABASE_URL`):** your LAN or `localhost` Kong port — same idea.

**Do not** curl or paste `.env.local` contents in shared channels (secrets).

## Next.js

- `.env.local` should list `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and usually `SUPABASE_SERVICE_ROLE_KEY`.
- After env changes, restart `npm run dev` / the Node process.

## `/test-env`

Shows public env vars in the browser. `SUPABASE_URL` is documented there as server-only (not visible in the client bundle).

## If loading still feels slow

1. Browser DevTools → Network: time to first byte on the document, `/auth/v1/user`, and `/rest/v1/`.
2. Dashboard runs many parallel Supabase queries; DB/Kong tuning may be needed separately.
3. See `docs/CONNECTION_TROUBLESHOOTING.md` for connectivity issues.
