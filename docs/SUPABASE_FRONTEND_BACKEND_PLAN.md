# Supabase Frontend–Backend Integration Plan

Planning document for connecting the Solar EPC Next.js frontend to Supabase (Auth, Postgres, Storage) with RBAC and CRUD.

---

## 1. Overview

| Current | Target |
|--------|--------|
| Next.js app + `lib/store/*` (localStorage) | Next.js app + Supabase (Postgres, Auth, Storage) |
| No auth (role from context/mock) | Supabase Auth + JWT + `profiles.role` |
| CRUD via `readLocalStorageJSON` / `writeLocalStorageJSON` | CRUD via `@supabase/supabase-js` + RLS |
| File uploads: metadata only | Supabase Storage buckets |

**Goals:** Auth (login/sessions), RBAC (admin, manager, engineer, surveyor, government), full CRUD on users, projects, surveys, installations, inspections, and real file uploads for survey/installation docs.

---

## 2. Prerequisites

- [ ] Supabase project (cloud or self-hosted)
- [ ] Project URL and anon key (and service role key for admin/seed scripts only)
- [ ] Node: existing `@supabase/supabase-js` in `package.json`

---

## 3. Environment Variables

Create `.env.local` (and `.env.example` without values):

```env
# Supabase (public keys safe in frontend)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Optional: server-side or seed scripts only (never expose in client bundle)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Use `NEXT_PUBLIC_*` in the browser Supabase client; use service role only in API routes or one-off scripts, never in client code.

---

## 4. Supabase Client Setup

**New file: `lib/supabase/client.ts`** (browser)

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Optional:** `lib/supabase/server.ts` for Server Components / Route Handlers using `createServerClient` from `@supabase/ssr` (with cookies).

Install if using server client: `npm i @supabase/ssr`.

---

## 5. Database Schema (Postgres)

Tables below align with existing app types and RBAC. Use `auth.uid()` in RLS to identify the user and `profiles.role` for RBAC.

### 5.1 Core tables

- **`profiles`** – Extends Supabase Auth; holds app-specific fields (e.g. `role`, `name`, `phone`).
- **`projects`** – Same shape as `lib/store/projects.ts` (id, project_name, description, state, city, district, pincode, address, assignments jsonb, created_at).
- **`surveys`** – Same shape as `lib/store/surveys.ts`; use jsonb for `site_location`, `site_details`, `bank_details`, `uploads` (metadata), `activity`.
- **`installations`** – Same shape as `lib/store/installations.ts`; use jsonb for `materials`, `photos` (metadata).
- **`inspections`** – Same shape as `lib/store/inspections.ts`; use jsonb for `manager_approval`, `government_inspection`, `activity`.

### 5.2 Suggested SQL (high level)

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (one row per auth user)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null check (role in ('admin','manager','engineer','surveyor','government')),
  status text default 'active' check (status in ('active','inactive')),
  phone text,
  aadhar_no text,
  city text,
  state text,
  district text,
  full_address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Projects
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  project_name text not null,
  description text,
  state text,
  city text,
  district text,
  pincode text,
  address text,
  additional_info text,
  assignments jsonb default '{}',
  created_at timestamptz default now()
);

-- Surveys (jsonb for nested objects)
create table public.surveys (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete set null,
  beneficiary_name text not null,
  service_no text not null,
  aadhar_no text not null,
  mobile text,
  pan_no text not null,
  contracted_load numeric,
  status text not null check (status in ('pending','approved','rejected','completed')),
  upload_date date,
  approved_date date,
  submitted_by_id uuid references public.profiles(id),
  submitted_at timestamptz,
  installer_id uuid references public.profiles(id),
  discom_name text not null,
  plant_type text default 'On Grid',
  building_height int default 0,
  total_roofs text,
  roof_type text,
  site_details jsonb,
  site_location jsonb not null,
  bank_details jsonb not null,
  uploads jsonb default '{}',
  activity jsonb default '[]',
  created_at timestamptz default now()
);

-- Installations
create table public.installations (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id),
  survey_id uuid references public.surveys(id),
  customer_name text not null,
  address text not null,
  engineer_id uuid references public.profiles(id),
  engineer_name text,
  status text not null check (status in ('pending','in_progress','completed','inspection_pending')),
  started_at timestamptz,
  completed_at timestamptz,
  materials jsonb default '[]',
  photos jsonb default '[]',
  created_at timestamptz default now()
);

-- Inspections
create table public.inspections (
  id uuid primary key default uuid_generate_v4(),
  installation_id uuid not null references public.installations(id) on delete cascade,
  project_id uuid references public.projects(id),
  survey_id uuid references public.surveys(id),
  customer_name text not null,
  address text not null,
  status text not null check (status in ('pending','approved','rejected','reopened')),
  inspector_id uuid references public.profiles(id),
  manager_approval jsonb not null default '{"approved":false,"remarks":""}',
  government_inspection jsonb,
  activity jsonb default '[]',
  created_at timestamptz default now()
);

-- Trigger: create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'surveyor')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

Adjust column names (e.g. `project_name` vs `projectName`) to match your frontend or add a thin mapping layer in the client.

---

## 6. Row Level Security (RLS) and RBAC

- Enable RLS on all tables: `alter table public.<table> enable row level security;`
- Add policies that use `auth.uid()` and, where needed, `(select role from public.profiles where id = auth.uid())`.

**Example policy ideas (customize to your rules):**

| Role      | Projects     | Surveys        | Installations | Inspections   |
|----------|--------------|----------------|---------------|---------------|
| admin    | all CRUD     | all CRUD       | all CRUD      | all CRUD      |
| manager  | all read; assign | read/update (approve) | read/update | read/update (approve) |
| engineer | read assigned | read          | CRUD assigned | read          |
| surveyor | read assigned | CRUD own      | read          | read          |
| government | read       | read           | read          | read/update (inspect) |

**Example:** Surveys – surveyors can insert their own and update rows where `submitted_by_id = auth.uid()`; managers can select/update all; admins can do everything.

```sql
-- Example: surveys select (managers and admins see all; surveyors see own)
create policy "surveys_select" on public.surveys for select
using (
  (select role from public.profiles where id = auth.uid()) in ('admin','manager')
  or submitted_by_id = auth.uid()
  or installer_id = auth.uid()
);

-- Example: surveys insert (surveyors create with submitted_by_id = auth.uid())
create policy "surveys_insert" on public.surveys for insert
with check (
  (select role from public.profiles where id = auth.uid()) in ('admin','surveyor')
  and (submitted_by_id is null or submitted_by_id = auth.uid())
);
```

Repeat for `update`/`delete` and for `projects`, `installations`, `inspections`, and `profiles` (e.g. only admin updates `profiles.role`).

---

## 7. Auth Flow and Linking to Frontend RBAC

- **Sign up:** `supabase.auth.signUp({ email, password, options: { data: { full_name, role } } })`. Use `role` in `handle_new_user` to set `profiles.role`.
- **Sign in:** `supabase.auth.signInWithPassword({ email, password })`.
- **Session:** Use `supabase.auth.getSession()` / `onAuthStateChange()` and read `profiles` (e.g. `from('profiles').select('role').single()`) to get current user role.
- **Frontend:** Keep existing `lib/rbac.ts` and role context; source the role from Supabase profile instead of mock/localStorage (e.g. in a layout or provider that fetches profile after auth).

---

## 8. Storage Buckets (File Uploads)

Create two buckets (e.g. in Supabase Dashboard or via SQL):

- **`survey-documents`** – Aadhaar, PAN, bank proof, eBill, beneficiary photo, site layout. Paths e.g. `{survey_id}/{document_type}/{filename}`.
- **`installation-photos`** – Panel, wiring, inverter, meter, overall. Paths e.g. `{installation_id}/{category}/{filename}`.

Policies: allow authenticated users to upload/read according to RBAC (e.g. surveyor can upload to `survey-documents` for surveys they created; engineers for `installation-photos` for their installations).

Frontend: replace “metadata only” with `supabase.storage.from('survey-documents').upload(path, file)` and store the returned path in `surveys.uploads` or in the relevant jsonb column.

---

## 9. Frontend Integration Map (Store → Supabase)

Keep the same **function names and call sites** in the app; swap the implementation from localStorage to Supabase.

| Module         | Current (store) | New implementation |
|----------------|------------------|---------------------|
| **users**      | `listUsers`, `getUserById`, `createUser`, `updateUser`, `updateUserRole`, `deleteUser`, `seedUsers` | `from('profiles').select/insert/update/delete` (admin only; createUser may also create auth user via Edge Function or backend). |
| **projects**   | `listProjects`, `getProjectById`, `createProject`, `updateProject`, `updateProjectAssignments`, `deleteProject` | `from('projects').select/insert/update/delete`. |
| **surveys**    | `listSurveys`, `getSurveyById`, `createSurvey`, `updateSurvey`, `updateSurveyStatus`, `assignSurveyInstaller`, `appendSurveyActivity` | `from('surveys').select/insert/update`; upload files to Storage then set paths in jsonb. |
| **installations** | `listInstallations`, `getInstallationById`, `createInstallation`, `updateInstallation`, `updateInstallationStatus` | `from('installations').select/insert/update`; photos to Storage + metadata in jsonb. |
| **inspections** | `listInspections`, `getInspectionById`, `getInspectionByInstallationId`, `createInspection`, `updateInspectionStatus`, `assignInspectionInspector`, `updateInspectionDetails`, `setManagerApproval`, `setGovernmentInspection` | `from('inspections').select/insert/update`. |

Implement in one of two ways:

- **Option A:** New files `lib/supabase/users.ts`, `lib/supabase/projects.ts`, etc., and switch imports from `@/lib/store/users` to `@/lib/supabase/users` (and so on) when ready.
- **Option B:** Replace the bodies of the existing store functions to call Supabase (and optionally keep a small localStorage fallback behind a feature flag during migration).

---

## 10. Migration Order (Checklist)

1. [ ] Create Supabase project and add `.env.local`.
2. [ ] Add `lib/supabase/client.ts` (and optionally `lib/supabase/server.ts`).
3. [ ] Run SQL: tables + RLS policies + trigger for `profiles`.
4. [ ] Create Storage buckets and policies.
5. [ ] Auth: sign-up/sign-in UI and profile fetch; wire role into existing RBAC/context.
6. [ ] Migrate one entity at a time (e.g. **projects** first, then **users**, **surveys**, **installations**, **inspections**).
7. [ ] For each entity: implement Supabase CRUD in store or in `lib/supabase/*`, then remove localStorage usage for that entity.
8. [ ] Replace survey/installation file uploads with Storage uploads and path storage in DB.
9. [ ] Remove or refactor `seedUsers` / mock data to use Supabase (e.g. seed script with service role).
10. [ ] Remove “metadata only / real upload later in Supabase” comments from the app.

---

## 11. References

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Next.js + Supabase](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- App RBAC: `lib/rbac.ts` (roles and permissions)
- App types: `lib/store/*.ts` (User, Project, Survey, Installation, Inspection)

---

*Document version: 1.0. Use this as the single plan for attaching the frontend to the Supabase backend.*
