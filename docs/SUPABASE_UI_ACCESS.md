# How to access the Supabase UI (Studio)

Your **frontend** is in `/opt/solar-epc` and talks to Supabase. The **Supabase UI** (Studio – database, auth users, SQL) is reached through the **same API gateway** as the API.

---

## Port 8000 = API + Studio UI

- **Port 8000** is **Kong** (the gateway). It serves:
  - The **Supabase API** (auth, database REST, etc.) – your app uses this.
  - The **Supabase Studio UI** at the root path `/`.

So you **do** use **8000** for the UI. The important part is **how** you open it and **how you log in**.

---

## Steps to open the Supabase UI

1. **Open in a browser**
   - On the same machine as Docker: **http://localhost:8000**
   - From another machine (e.g. your laptop): **http://&lt;server-ip&gt;:8000**  
     Example: **http://172.30.0.191:8000** (use the IP where Docker is running).

2. **Log in when the browser asks**
   - A **browser login popup** (HTTP Basic Auth) should appear.
   - **Username:** `supabase`
   - **Password:** value of `DASHBOARD_PASSWORD` from `supabase/docker/.env`  
     Default in that file: `this_password_is_insecure_and_should_be_updated`

3. After that you should see the **Supabase Studio** dashboard (project selector, then Table Editor, SQL Editor, Authentication, etc.).

---

## If “8000 is not working”

- **Nothing loads / connection refused**
  - Check that Kong and Studio are running:
    ```bash
    cd /opt/solar-epc/supabase/docker
    docker compose ps
    ```
    You should see `supabase-kong` and `supabase-studio` (or similar) as running.
  - If you’re not on the same machine as Docker, use the **server’s IP** (e.g. `172.30.0.191`) instead of `localhost`.

- **Page loads but asks for username/password and then fails or keeps asking**
  - Use exactly:
    - Username: `supabase`
    - Password: the value of `DASHBOARD_PASSWORD` from `supabase/docker/.env` (copy-paste, no spaces).
  - Try **http://127.0.0.1:8000** or an **incognito/private** window (to avoid cached 401).

- **Blank page or “cannot connect” after login**
  - Ensure in `supabase/docker/.env` you have:
    ```env
    SUPABASE_PUBLIC_URL=http://localhost:8000
    ```
    (If you use another host/IP, set that URL here.)
  - Restart the stack:
    ```bash
    cd /opt/solar-epc/supabase/docker
    docker compose restart studio kong
    ```

---

## Quick reference

| What            | URL                        | Login / notes                          |
|-----------------|----------------------------|----------------------------------------|
| Supabase UI     | http://localhost:8000      | Basic auth: `supabase` / DASHBOARD_PASSWORD |
| Your app        | http://localhost:3001      | Your app login (e.g. superadmin email) |
| API (for app)   | http://localhost:8000      | No browser login; app uses anon key    |

So: **8000 is correct for the Supabase UI**; use that URL and the dashboard username/password above. If it still doesn’t work, the checklist above should help narrow it down.
