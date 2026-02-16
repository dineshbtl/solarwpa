# Database migrations (Supabase self-hosted)

Run these migrations against your self-hosted Supabase Postgres so the Solar EPC app has all tables and auth wiring.

## Option 1: Supabase Studio (easiest)

1. Open **Supabase Studio** (e.g. http://localhost:3000 if running Docker, or your Studio URL).
2. Go to **SQL Editor**.
3. Run in order:
   - Copy-paste and run `db/migrations/00001_solar_epc_schema.sql`.
   - Then run `db/migrations/00002_rls_and_auth.sql`.
   - Then run `db/migrations/00006_anon_rls_app_tables.sql` (allows anon to create/edit surveys; required for survey submit when using anon key).
   - **Image uploads:** Run `db/migrations/00005_survey_uploads_bucket.sql` (creates `solar_bucket`) and `db/migrations/00007_anon_storage_policies.sql` (allows anon to upload). If you still see "new row violates row-level security policy" on upload, run `db/migrations/00009_fix_rls_and_storage_for_anon.sql` instead (bucket + anon storage policies in one go).

## Option 2: psql

If you have direct Postgres access (e.g. from the host where Docker runs):

```bash
# From your Supabase Docker .env you need: POSTGRES_PASSWORD, and host (e.g. localhost if port 5432 is exposed).
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=postgres
export PGUSER=postgres
export PGPASSWORD=your-postgres-password

psql -f db/migrations/00001_solar_epc_schema.sql
psql -f db/migrations/00002_rls_and_auth.sql
psql -f db/migrations/00006_anon_rls_app_tables.sql
psql -f db/migrations/00005_survey_uploads_bucket.sql
psql -f db/migrations/00007_anon_storage_policies.sql
```

## Option 3: Docker exec

From the project root, if Supabase is running in Docker:

```bash
docker exec -i supabase-db psql -U postgres -d postgres < db/migrations/00001_solar_epc_schema.sql
docker exec -i supabase-db psql -U postgres -d postgres < db/migrations/00002_rls_and_auth.sql
docker exec -i supabase-db psql -U postgres -d postgres < db/migrations/00003_surveys_project_id.sql
docker exec -i supabase-db psql -U postgres -d postgres < db/migrations/00004_surveys_optional_fields.sql
docker exec -i supabase-db psql -U postgres -d postgres < db/migrations/00006_anon_rls_app_tables.sql
docker exec -i supabase-db psql -U postgres -d postgres < db/migrations/00005_survey_uploads_bucket.sql
docker exec -i supabase-db psql -U postgres -d postgres < db/migrations/00007_anon_storage_policies.sql
```

Or run the setup script (applies all migrations): `./scripts/setup-selfhosted-supabase.sh`

(Use the actual DB container name from `docker ps`; it might be `supabase-db` or similar.)

## Image upload failed: "new row violates row-level security policy"

Survey image uploads use the storage bucket **solar_bucket**. Ensure the bucket exists and the **anon** role can insert/update objects:

1. **Create bucket and anon policies:** Run `db/migrations/00005_survey_uploads_bucket.sql` then `db/migrations/00007_anon_storage_policies.sql`, **or** run `db/migrations/00009_fix_rls_and_storage_for_anon.sql` (does bucket + anon storage policies; also disables RLS on app tables).
2. In **Supabase Studio** → Storage: confirm a bucket named **solar_bucket** exists and is Public. If not, create it (name: `solar_bucket`, Public: on) and run `00007_anon_storage_policies.sql` or `00009_fix_rls_and_storage_for_anon.sql` so anon can upload.

## Disable RLS (if you get "new row violates row-level security policy" on app tables)

If RBAC is not required for this project, disable RLS on app tables so the anon key can create/update/delete without policies:

- **Supabase Studio:** SQL Editor → paste and run `db/migrations/00008_disable_rls_app_tables.sql`
- **psql:** `psql -f db/migrations/00008_disable_rls_app_tables.sql`
- **Docker:** `docker exec -i <postgres-container> psql -U postgres -d postgres < db/migrations/00008_disable_rls_app_tables.sql`

## After migrations

- **Auth:** Sign up / sign in with email in the app. The trigger `on_auth_user_created` creates a row in `public.profiles` linked to `auth.users`.
- **First admin:** Either create a profile manually in Studio with `role = 'admin'` and link it to an auth user, or sign up and then update that profile’s role in Studio to `admin`.
