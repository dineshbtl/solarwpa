# Supabase credentials and superadmin

## Where to get / see Supabase credentials

### Self-hosted (Docker)

- **API URL**: Your Kong gateway, e.g. **http://localhost:8000** (set as `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`).
- **Keys**: In the Supabase Docker `.env` file (e.g. `supabase/docker/.env` in this repo):
  - `ANON_KEY` → use as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SERVICE_ROLE_KEY` → use as `SUPABASE_SERVICE_ROLE_KEY`
- Your app’s **`.env.local`** was filled from that file by `scripts/setup-selfhosted-supabase.sh`. You can open `.env.local` to see the values (keep them secret).

There is no separate “credentials UI” – the keys live in those env files. The **Supabase UI** (Studio) is for database and auth management, not for “downloading” keys.

---

## Supabase UI (Studio)

**URL**: **http://localhost:3000** (when using the default Docker setup)

In Studio you can:

- **Table Editor** – view/edit tables: `profiles`, `projects`, `surveys`, etc.
- **SQL Editor** – run SQL.
- **Authentication → Users** – see and manage auth users (email, reset password, etc.).
- **Database** – inspect schema, roles, etc.

Use this UI to inspect data and auth users; credentials for the app stay in `.env.local` and `supabase/docker/.env`.

---

## Superadmin user (e.g. superadmin@brihaspathi.com)

To create a superadmin that can log in with **superadmin@brihaspathi.com** / **Qazplm@4#2**:

### Option 1: Script (recommended)

From the **project root** (with `.env.local` present):

```bash
node scripts/create-superadmin.mjs
```

This uses the default email/password above. To use different values:

```bash
SUPERADMIN_EMAIL=admin@example.com SUPERADMIN_PASSWORD=YourSecurePass node scripts/create-superadmin.mjs
```

Then open your app (e.g. http://localhost:3001), go to the login page, and sign in with that email and password.

### Option 2: Supabase Studio

1. Open **http://localhost:3000** (Studio).
2. Go to **Authentication → Users**.
3. Click **Add user** → **Create new user**.
4. Email: `superadmin@brihaspathi.com`, Password: `Qazplm@4#2`, confirm email if needed.
5. Go to **Table Editor → profiles**, find the row for that user (by email or `auth_user_id`), and set **role** to `admin`.

### Option 3: App sign-up then set role in Studio

1. In your app, open the **Sign up** page and register with **superadmin@brihaspathi.com** / **Qazplm@4#2**.
2. In Studio → **Table Editor → profiles**, find that user and set **role** to `admin`.

After that, you can use the **Login** page with that email and password.
