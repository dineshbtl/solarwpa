# Self-hosted Supabase – Quick start

Use this when **Supabase is already running in Docker** (you ran `docker compose up -d` in `supabase/docker` and see containers like `supabase-db`, `supabase-kong` in `docker ps`).

---

## 1. Run the setup script (recommended)

From the **Solar EPC project root**:

```bash
chmod +x scripts/setup-selfhosted-supabase.sh
./scripts/setup-selfhosted-supabase.sh
```

This will:

- Run the Solar EPC migrations against the `supabase-db` container (tables + RLS + auth trigger).
- If `supabase/docker/.env` exists in this repo, create or overwrite `.env.local` with:
  - `NEXT_PUBLIC_SUPABASE_URL` (from `API_EXTERNAL_URL` or `http://localhost:8000`)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from `ANON_KEY`)
  - `SUPABASE_SERVICE_ROLE_KEY` (from `SERVICE_ROLE_KEY`)

---

## 2. Or do it manually

### 2.1 Run migrations

**Option A – Docker exec (from Solar EPC project root):**

```bash
docker exec -i supabase-db psql -U postgres -d postgres < db/migrations/00001_solar_epc_schema.sql
docker exec -i supabase-db psql -U postgres -d postgres < db/migrations/00002_rls_and_auth.sql
```

**Option B – Supabase Studio**

1. Open **Studio** at **http://localhost:3000** (or the port where `supabase-studio` is running).
2. Go to **SQL Editor**.
3. Paste and run the contents of `db/migrations/00001_solar_epc_schema.sql`, then `db/migrations/00002_rls_and_auth.sql`.

### 2.2 Get keys and set `.env.local`

1. Open the **Supabase Docker** `.env` file (e.g. `supabase/docker/.env` in this repo, or wherever you ran `docker compose up -d`).
2. Copy into this project’s **`.env.local`** (create it from `.env.example` if needed):

| In Supabase Docker `.env` | In Solar EPC `.env.local` |
|---------------------------|----------------------------|
| `API_EXTERNAL_URL` or use `http://localhost:8000` | `NEXT_PUBLIC_SUPABASE_URL` |
| `ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |

Example `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...paste-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...paste-service-role-key...
```

---

## 3. Run the app

- **Supabase Studio** in Docker is usually on **port 3000**, so run the Next.js app on another port:

```bash
npm run dev -- -p 3001
```

- Open **http://localhost:3001**, sign up with email/password, then log in.
- To get admin rights: open **Studio** at **http://localhost:3000** → **Table Editor** → **profiles** → find your row (by email) → set **role** to `admin`.

---

## 4. Port reference (from your `docker ps`)

| Service | Port | URL |
|--------|------|-----|
| Kong (API) | 8000 | `http://localhost:8000` → use as `NEXT_PUBLIC_SUPABASE_URL` |
| Studio | 3000 | http://localhost:3000 |
| Solar EPC app | 3001 | http://localhost:3001 (run with `-p 3001`) |

You’re done. The app now uses your self-hosted Supabase for auth and data.
