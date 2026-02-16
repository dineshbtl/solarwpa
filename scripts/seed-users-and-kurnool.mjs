#!/usr/bin/env node
/**
 * Seed: create one user per role (admin already exists), create project "Kurnool",
 * and attach all surveys to that project.
 *
 * Prerequisites:
 *   - Run migration 00003_surveys_project_id.sql (adds project_id to surveys)
 *   - .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage: node scripts/seed-users-and-kurnool.mjs
 *
 * Optional env:
 *   SEED_PASSWORD=YourPass123  (default: Qazplm@4#2)
 *   SEED_DOMAIN=brihaspathi.com (default; used for emails like manager@brihaspathi.com)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const DEFAULT_PASSWORD = 'Qazplm@4#2'
const DEFAULT_DOMAIN = 'brihaspathi.com'

function buildUserList(domain) {
  return [
    { role: 'admin', email: `superadmin@${domain}`, name: 'Super Admin' },
    { role: 'manager', email: `manager@${domain}`, name: 'Manager User' },
    { role: 'engineer', email: `engineer@${domain}`, name: 'Engineer User' },
    { role: 'surveyor', email: `surveyor@${domain}`, name: 'Surveyor User' },
    { role: 'government', email: `government@${domain}`, name: 'Government User' },
  ]
}

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim()
    })
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.SEED_PASSWORD || DEFAULT_PASSWORD
const domain = process.env.SEED_DOMAIN || DEFAULT_DOMAIN

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function ensureUser({ role, email, name }) {
  const { data: list } = await supabase.auth.admin.listUsers()
  const existing = list?.users?.find((u) => u.email === email)

  if (existing) {
    const { error: up } = await supabase
      .from('profiles')
      .update({ role, name })
      .eq('auth_user_id', existing.id)
    if (up) console.warn('Profile update warning for', email, up.message)
    else console.log('OK (exists):', email, '→', role)
    return existing.id
  }

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  })

  if (createErr) {
    console.error('Create failed:', email, createErr.message)
    return null
  }

  const uid = created?.user?.id
  if (uid) {
    const { error: up } = await supabase.from('profiles').update({ role, name }).eq('auth_user_id', uid)
    if (up) console.warn('Profile update warning for', email, up.message)
    else console.log('Created:', email, '→', role)
  }
  return uid
}

async function nextProjectId() {
  const { data } = await supabase.from('projects').select('id').order('created_at', { ascending: false }).limit(2000)
  const nums = (data ?? []).map((r) => parseInt(String(r.id).replace(/^PROJ-/, ''), 10)).filter((n) => !Number.isNaN(n))
  const next = nums.length ? Math.max(...nums) + 1 : 1
  return `PROJ-${next.toString().padStart(3, '0')}`
}

async function main() {
  const usersToEnsure = buildUserList(domain)
  console.log('--- Seed: users for all roles (domain:', domain + ') ---')
  for (const u of usersToEnsure) {
    await ensureUser(u)
  }

  console.log('\n--- Create project Kurnool ---')
  const projectId = await nextProjectId()
  const { error: projErr } = await supabase.from('projects').insert({
    id: projectId,
    project_name: 'Kurnool',
    description: 'Kurnool project – all imported survey list attached',
    district: 'Kurnool',
    state: 'Andhra Pradesh',
    assignments: {},
  })

  if (projErr) {
    if (projErr.code === '23505') {
      const { data: existing } = await supabase.from('projects').select('id').ilike('project_name', 'Kurnool').limit(1).single()
      if (existing) {
        console.log('Project Kurnool already exists:', existing.id)
        await attachSurveysToProject(existing.id)
        return
      }
    }
    console.error('Project create error:', projErr.message)
    process.exit(1)
  }
  console.log('Created project:', projectId, 'Kurnool')

  await attachSurveysToProject(projectId)
}

async function attachSurveysToProject(projectId) {
  console.log('\n--- Attach all surveys to project', projectId, '---')

  const { data: surveys, error: listErr } = await supabase.from('surveys').select('id')
  if (listErr) {
    console.error('Failed to list surveys:', listErr.message)
    process.exit(1)
  }

  const count = surveys?.length ?? 0
  if (count === 0) {
    console.log('No surveys to attach.')
    return
  }

  const { error: updateErr } = await supabase.from('surveys').update({ project_id: projectId }).not('id', 'is', null)
  if (updateErr) {
    console.error('Failed to update surveys (project_id may not exist). Run migration 00003_surveys_project_id.sql first:', updateErr.message)
    process.exit(1)
  }
  console.log('Attached', count, 'surveys to project', projectId)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
