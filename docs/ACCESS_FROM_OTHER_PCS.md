# Accessing the app from other PCs (fix ERR_CONNECTION_REFUSED on login)

When you open the app from **another computer** (e.g. `http://server-ip:3001`), login can fail with:

```text
localhost:8000/auth/v1/token?grant_type=... ERR_CONNECTION_REFUSED
```

**Cause:** The app is configured with `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000`. The browser runs on the **user’s machine**, so it tries to reach **that machine’s** `localhost:8000`, not the server where Supabase is running.

**Fix:** Use the **server’s IP or hostname** instead of `localhost` for the Supabase URL, so every client talks to the same server.

---

## 1. Get the server’s IP or hostname

On the **machine where Supabase and the app run**:

- **Linux/macOS:** `hostname -I | awk '{print $1}'` or `ip addr`
- **Windows:** `ipconfig` → use the IPv4 address (e.g. `192.168.1.100`)

Or use the server’s hostname if other PCs can resolve it (e.g. `brihaspathi` or `brihaspathi.local`).

---

## 2. Configure the Next.js app (this project)

Edit **`.env.local`** on the server:

```bash
# Use the server's IP or hostname so other PCs can reach Supabase
NEXT_PUBLIC_SUPABASE_URL=http://YOUR_SERVER_IP:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Example:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://192.168.1.100:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

Then **restart the Next.js app** (e.g. `npm run dev`) so the new URL is used.

---

## 3. Configure Supabase Docker (so auth redirects work)

On the server, in **`supabase/docker/.env`**, set the same base URL:

```bash
# Reachable URL so auth works from other PCs
API_EXTERNAL_URL=http://YOUR_SERVER_IP:8000
SUPABASE_PUBLIC_URL=http://YOUR_SERVER_IP:8000

# If users open the app at http://YOUR_SERVER_IP:3001, add it for redirects
SITE_URL=http://YOUR_SERVER_IP:3001
ADDITIONAL_REDIRECT_URLS=http://YOUR_SERVER_IP:3001,http://YOUR_SERVER_IP:3001/**
```

Replace `YOUR_SERVER_IP` with the same IP or hostname (e.g. `192.168.1.100`).

Restart the Supabase stack so Kong/auth use the new URLs:

```bash
cd supabase/docker
docker compose down
docker compose up -d
```

---

## 4. Firewall

Ensure the **server** allows:

- **8000** (Supabase API) from other machines
- **3001** (or whatever port the Next.js app uses) if you want them to open the app in the browser

Example (Linux with ufw):

```bash
sudo ufw allow 8000/tcp
sudo ufw allow 3001/tcp
sudo ufw reload
```

---

## 5. How to open the app from another PC

Use the **server’s** IP (or hostname) and the app port, for example:

- App: `http://192.168.1.100:3001`
- Supabase (used by the app): `http://192.168.1.100:8000` (set in `.env.local`)

Do **not** use `localhost` when opening the app from another computer.

---

## Quick checklist

| Item | Where | Value |
|------|--------|--------|
| Supabase API URL | `.env.local` → `NEXT_PUBLIC_SUPABASE_URL` | `http://<server-ip>:8000` |
| Kong / public URL | `supabase/docker/.env` → `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL` | Same as above |
| App redirect URL | `supabase/docker/.env` → `SITE_URL`, `ADDITIONAL_REDIRECT_URLS` | `http://<server-ip>:3001` (and `/ **` if needed) |
| Restart | Next.js app + Supabase Docker | After changing env |

After this, login from other systems should hit the server’s Supabase at `http://<server-ip>:8000` instead of `localhost:8000`, and the connection refused error should go away.
