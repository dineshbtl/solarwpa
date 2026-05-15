# "Could not reach the server" – Self-hosted Supabase (Docker)

When the Solar EPC app shows **"Could not reach the server. Check your connection and try again"**, the browser or Next.js server cannot reach your Supabase API.

**CORS** is enforced in the **browser** between your app origin and the Supabase API origin. Use a canonical **HTTPS** nginx URL for `NEXT_PUBLIC_SUPABASE_URL`.

**Login redirect loop:** Next.js middleware **must** use the same `NEXT_PUBLIC_SUPABASE_URL` as the browser. Supabase stores sessions in cookies named from the API host (e.g. `sb-solarepc-auth-token`). If middleware used a different base URL (e.g. `http://127.0.0.1:8001`), it would look for a different cookie name and always treat you as logged out.

**`SUPABASE_URL`:** Optional, for **service-role** server code (`getSupabaseAdminClient`) to hit internal Kong. It is **not** used by middleware.

If you see **502** when middleware calls the public HTTPS URL from the same host, fix **nginx hairpin** / DNS for local outbound requests to your public name, or add a split-horizon DNS entry.

---

## 1. Check Supabase Docker is running

On the machine where Supabase runs:

```bash
docker ps
```

You should see containers such as `supabase-db`, `supabase-kong`, `supabase-auth`, etc. If not, start Supabase:

```bash
cd supabase/docker
docker compose up -d
```

---

## 2. Check the API port (Kong)

Kong (Supabase API) usually listens on **port 8000**. From the **same machine** where Docker runs:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/rest/v1/
```

- **200** or **401** → API is reachable (401 is normal without auth headers).
- **000** or connection refused → Kong is not running or port 8000 is not published. Check `docker compose ps` and `supabase/docker/.env` for `KONG_HTTP_PORT`.

---

## 3. Configure `.env.local` (do not commit or share)

**.env.local** must point to a URL that **whoever is using the app** can reach.

### Single URL

| How you open the app | NEXT_PUBLIC_SUPABASE_URL |
|----------------------|---------------------------|
| Same PC: `http://localhost:3001` | `http://localhost:8000` |
| Same PC: `http://127.0.0.1:3001` | `http://127.0.0.1:8000` |
| Another PC / LAN: `http://192.168.1.100:3001` | `http://192.168.1.100:8000` |

### One canonical URL (recommended)

Use a **single** `NEXT_PUBLIC_SUPABASE_URL` that every browser can reach—usually your public HTTPS API (e.g. `https://yourdomain.com/supabase` behind nginx to Kong). Open the app via that same hostname (or any host where that HTTPS URL is reachable). The app no longer switches to a separate LAN public URL.

**Optional `SUPABASE_URL`:** Set this to a URL the **Next.js server** (and middleware, when applicable) can reach quickly—e.g. `http://127.0.0.1:8000` or your Kong LAN URL. The browser still uses only `NEXT_PUBLIC_SUPABASE_URL`. Do **not** set `SUPABASE_URL` to a private address if you deploy middleware on a platform whose Edge cannot reach your LAN (e.g. leave it unset on Vercel and rely on the public URL).

If you open the app via a **LAN IP** but only set `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000`, the browser would try *its own* localhost and fail—either set `NEXT_PUBLIC_SUPABASE_URL` to a host every client can reach (recommended) or use localhost only when the app is opened on the same machine.

Required variables (copy from `supabase/docker/.env`):

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from supabase/docker/.env>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from supabase/docker/.env>
```

**Image uploads (survey documents):** The app uploads files via a server action using the service role (bypasses storage RLS). Ensure `SUPABASE_SERVICE_ROLE_KEY` is set. If the Next.js server cannot reach `NEXT_PUBLIC_SUPABASE_URL` (e.g. app in Docker), set `SUPABASE_URL` to a URL the server can reach (e.g. `http://172.30.0.191:8000` or `http://host.docker.internal:8000`).

**Do not** run `cat .env.local` or `curl .env.local` in shared terminals or logs; it contains secrets.

---

## 4. Verify URL only (without printing secrets)

To confirm which Supabase URL the app would use **without** showing keys:

```bash
grep NEXT_PUBLIC_SUPABASE_URL .env.local | sed 's/=.*/=***/'
```

Then test that host and port:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/rest/v1/
```

Use the same host as in your URL (e.g. replace `localhost` with your server IP if you use one).

---

## 5. Restart the Next.js app

After changing `.env.local`, restart the dev server so it picks up the new values:

```bash
# Stop the current process (Ctrl+C), then:
npm run dev -- -p 3001
```

---

## 6. Firewall

If the app runs on a different machine than the browser (e.g. server at 192.168.1.100), ensure the **Kong HTTP port** you use (often **8000**, or **8001** / **7100** if you remapped it) is allowed (e.g. `sudo ufw allow 8000/tcp` or the port you chose).

---

## 7. Port conflicts (8000 vs 7000 range, Studio vs app)

Typical defaults from Supabase Docker:

| Service | Default port | Notes |
|--------|---------------|--------|
| Kong (REST, Auth, Storage API) | **8000** | Often changed to **8001** or **7100** if 8000 is already in use. Set in `supabase/docker/.env` (e.g. `KONG_HTTP_PORT`). |
| Supabase Studio | **3000** | Run this Next app on **3001**, **6001** (PM2 in this repo), etc. |
| Postgres (db) | **5432** (internal) | Usually not the same conflict as Kong. |

**This Solar EPC repo** does not start Docker; it only reads URLs from `.env.local`.

- Set **`NEXT_PUBLIC_SUPABASE_URL`** to whatever URL reaches Kong (including port), e.g. `http://192.168.1.10:7100` or your HTTPS nginx URL.
- Set **`SUPABASE_URL`** (optional) to **`http://127.0.0.1:<your-kong-port>`** for service-role calls from the same host (e.g. `8001` or `7100`).
- For **dev** where `NEXT_PUBLIC_SUPABASE_URL` is `http://localhost` **without** a port and you open the app via a **LAN hostname**, the client rewrites the host to your LAN IP. The implied port defaults to **8000** unless you set **`NEXT_PUBLIC_SUPABASE_LOCAL_API_PORT`** (e.g. `7100` if Kong listens on 7100).

After changing Kong’s port in Docker, update **`API_EXTERNAL_URL` / `SUPABASE_PUBLIC_URL`** in `supabase/docker/.env` and restart `docker compose`, then align `.env.local`.
