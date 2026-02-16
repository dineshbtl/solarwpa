# Seed: All-Role Users and Kurnool Project

## What was done

1. **Migration** `db/migrations/00003_surveys_project_id.sql`  
   - Adds `project_id` to the `surveys` table so surveys can be linked to a project.

2. **Seed script** `scripts/seed-users-and-kurnool.mjs`  
   - Creates one user per role (if missing) and creates the **Kurnool** project with all imported surveys attached.

## Users (all roles)

| Role       | Email                      | Password (default) |
|-----------|----------------------------|---------------------|
| Admin     | superadmin@brihaspathi.com | Qazplm@4#2          |
| Manager   | manager@brihaspathi.com    | Qazplm@4#2          |
| Engineer  | engineer@brihaspathi.com   | Qazplm@4#2          |
| Surveyor  | surveyor@brihaspathi.com   | Qazplm@4#2          |
| Government| government@brihaspathi.com| Qazplm@4#2          |

Override domain/password with env:

- `SEED_DOMAIN=example.com` → emails like manager@example.com  
- `SEED_PASSWORD=YourPass123`

## Kurnool project

- **Project name:** Kurnool  
- **Project ID:** PROJ-001  
- **Surveys:** All 9,361 imported surveys are attached to this project.

On **Projects** (`/projects`), Kurnool appears with “9361 surveys”; you can open one survey from the card or go to **Surveys** to see the full list.

## Run again

1. **Apply migration** (if not already applied):

   ```bash
   docker exec -i supabase-db psql -U postgres -d postgres < db/migrations/00003_surveys_project_id.sql
   ```

   Or run the full setup script (includes 00001–00003):

   ```bash
   ./scripts/setup-selfhosted-supabase.sh
   ```

2. **Run seed** (idempotent: skips existing users, reuses existing Kurnool project):

   ```bash
   node scripts/seed-users-and-kurnool.mjs
   ```

## Testing one flow

1. Log in as **surveyor** (surveyor@brihaspathi.com) and confirm you see surveys and can open one.
2. Log in as **manager** and confirm you can approve surveys / manage projects.
3. Log in as **admin** (superadmin@brihaspathi.com) and confirm Users and Projects (including Kurnool with 9361 surveys) work as expected.

After one flow is verified, you can repeat for other roles (engineer, government) as needed.
