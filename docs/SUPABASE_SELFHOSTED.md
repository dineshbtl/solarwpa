# Supabase Self-Hosted Setup

This project is configured to work with **self-hosted Supabase** (Docker) or Supabase Cloud. Use this guide to connect the Next.js app to your own Supabase instance.

---

## 1. Run self-hosted Supabase (Docker)

If you haven’t already:

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

**Important:** Before starting, generate real secrets (do **not** use the example values in production):

```bash
# From supabase/docker
./utils/generate-keys.sh
```

Then start the stack:

```bash
docker compose up -d
```

Default API (Kong) is at **http://localhost:8000**. Studio is usually at **http://localhost:3000** (check `.env` for `STUDIO_URL`). For production, put a reverse proxy (e.g. Caddy, Nginx) in front and use HTTPS.

**Apply Solar EPC schema:** After the stack is up, run this project's migrations (see [db/README.md](../db/README.md)):

```bash
# From this repo root; container name may be supabase-db or similar (check `docker ps`)
docker exec -i supabase-db psql -U postgres -d postgres < db/migrations/00001_solar_epc_schema.sql
docker exec -i supabase-db psql -U postgres -d postgres < db/migrations/00002_rls_and_auth.sql
```

---

## 2. Get URL and keys for this app

From your **Supabase Docker** `.env`:

| Next.js env var | Self-hosted source | Example |
|-----------------|--------------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `API_EXTERNAL_URL` or `SUPABASE_PUBLIC_URL` | `http://localhost:8000` (local) or `https://api.yourdomain.com` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ANON_KEY` | JWT string from `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SERVICE_ROLE_KEY` | JWT string from `.env` (server-only) |

- **Local Docker:** `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000`
- **Production:** Use the public URL of your Kong/API (e.g. `https://api.yourdomain.com`). Set `API_EXTERNAL_URL` (and `SITE_URL` for auth) in the Supabase Docker `.env` to that URL.

---

## 3. Configure this Next.js app

1. Copy the example env file:

   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and set:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste ANON_KEY from supabase/docker/.env>
   SUPABASE_SERVICE_ROLE_KEY=<paste SERVICE_ROLE_KEY from supabase/docker/.env>
   ```

3. Restart the dev server:

   ```bash
   npm run dev
   ```

---

## 4. Use Supabase in the app

- **Browser (Client Components):** use `getSupabaseBrowserClient()` from `@/lib/supabase/client`.
- **Server (Server Components, Route Handlers, API routes):** use `createSupabaseServerClient()` from `@/lib/supabase/server`. Pass `{ useServiceRole: true }` only when you need to bypass RLS (admin).

Example (client):

```ts
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

const supabase = getSupabaseBrowserClient()
const { data, error } = await supabase.from('projects').select('*')
```

Example (server, with RLS):

```ts
import { createSupabaseServerClient } from '@/lib/supabase/server'

const supabase = createSupabaseServerClient()
const { data } = await supabase.from('projects').select('*')
```

---

## 5. Auth (optional)

GoTrue runs in the self-hosted stack. Configure in Supabase Docker `.env`:

- `SITE_URL` – your Next.js app URL (e.g. `http://localhost:3000` or `https://app.yourdomain.com`)
- `ADDITIONAL_REDIRECT_URLS` – extra redirect URLs after sign-in
- SMTP settings if you use email signup/confirmation

In the app, use the same client; auth is on the same API URL:

```ts
const supabase = getSupabaseBrowserClient()
await supabase.auth.signInWithPassword({ email, password })
await supabase.auth.getSession()
```

---

## 6. Generate TypeScript types (optional)

Once your database has tables, generate types:

**Self-hosted (direct DB URL):**

```bash
npx supabase gen types typescript --db-url "postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:54322/postgres" > lib/supabase/database.types.ts
```

**Supabase Cloud:**

```bash
npx supabase gen types typescript --project-id <project-ref> > lib/supabase/database.types.ts
```

Then update `lib/supabase/database.types.ts` so the `Database` type matches your schema.

---

## Troubleshooting

- **CORS:** If the app runs on a different origin (e.g. different port), configure Kong/CORS for your API URL.
- **Auth redirects:** Ensure `SITE_URL` and redirect URLs in GoTrue match your app URL.
- **Realtime:** Works with the same self-hosted URL; ensure Realtime is enabled in the Docker stack.
