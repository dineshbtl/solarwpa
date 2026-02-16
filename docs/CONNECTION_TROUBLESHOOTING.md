# "Could not reach the server" – Self-hosted Supabase (Docker)

When the Solar EPC app shows **"Could not reach the server. Check your connection and try again"**, the browser or Next.js server cannot reach your Supabase API.

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

### Dual URL (LAN + public / internet)

When the app is opened from **both** the local network (e.g. `172.30.0.191`) and from the **internet** (e.g. public IP `183.82.117.36`), set both so the browser uses the right Supabase URL:

- **NEXT_PUBLIC_SUPABASE_URL** – used when the app is opened via this host (e.g. public IP or domain). Example: `http://183.82.117.36:3004` if Supabase is exposed on port 3004 from outside.
- **NEXT_PUBLIC_SUPABASE_URL_LAN** – used when the app is opened via the *host* in this URL (e.g. LAN IP). Example: `http://172.30.0.191:8000`.

The app picks the URL by **hostname**: if you open the app at `http://172.30.0.191:3000`, it uses `NEXT_PUBLIC_SUPABASE_URL_LAN`; if you open at `http://183.82.117.36:3000`, it uses `NEXT_PUBLIC_SUPABASE_URL`. Both must be reachable (correct host and port) from the client.

If you open the app via a **LAN IP** but only set `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000`, the browser would try *its own* localhost and fail. Use the dual-URL setup above or set `NEXT_PUBLIC_SUPABASE_URL` to the server IP.

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

If the app runs on a different machine than the browser (e.g. server at 192.168.1.100), ensure **port 8000** is allowed (e.g. `sudo ufw allow 8000` or equivalent).
